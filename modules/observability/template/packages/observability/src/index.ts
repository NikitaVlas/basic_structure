import { createHash, randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;
export type LogRecord = LogFields & { timestamp: string; level: LogLevel; message: string };
export type LogSink = (record: LogRecord) => void;

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(authorization|cookie|credential|email|password|secret|session|token)/i;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function safeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return safeError(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => safeValue(entry, seen));
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : safeValue(entry, seen)]));
}

export function redact(fields: LogFields): LogFields {
  return safeValue(fields, new WeakSet()) as LogFields;
}

export function safeError(error: unknown) {
  const name = error instanceof Error ? error.name : "NonErrorThrown";
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code.slice(0, 64) : undefined;
  const fingerprint = createHash("sha256").update(`${name}:${code ?? "unknown"}`).digest("hex").slice(0, 16);
  return { name, ...(code ? { code } : {}), fingerprint };
}

function consoleSink(record: LogRecord) {
  try { console.log(JSON.stringify(record)); }
  catch { console.log('{"level":"error","message":"log_serialization_failed"}'); }
}

export function createLogger(base: LogFields = {}, sink: LogSink = consoleSink) {
  const safeBase = redact(base);
  return {
    log(level: LogLevel, message: string, fields: LogFields = {}) {
      sink({ timestamp: new Date().toISOString(), level, message, ...safeBase, ...redact(fields) });
    },
    child(fields: LogFields) { return createLogger({ ...safeBase, ...redact(fields) }, sink); }
  };
}

const defaultLogger = createLogger({ service: process.env.OTEL_SERVICE_NAME ?? "application", environment: process.env.NODE_ENV ?? "development" });
export function log(level: LogLevel, message: string, fields: LogFields = {}) { defaultLogger.log(level, message, fields); }

export function requestIdFrom(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

type Labels = Record<string, string>;
type Metric = { help: string; type: "counter" | "gauge"; values: Map<string, number>; labels: Map<string, Labels> };
function metricKey(labels: Labels) { return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\u0000"); }
function metricName(name: string) { if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new Error("INVALID_METRIC_NAME"); return name; }
function labelValue(value: string) { return value.replace(/[\\"\n]/g, (character) => character === "\n" ? "\\n" : `\\${character}`); }

export function createMetricsRegistry() {
  const metrics = new Map<string, Metric>();
  function register(name: string, help: string, type: Metric["type"]) {
    metricName(name);
    const existing = metrics.get(name);
    if (existing && (existing.help !== help || existing.type !== type)) throw new Error("METRIC_CONFLICT");
    const metric = existing ?? { help, type, values: new Map(), labels: new Map() };
    metrics.set(name, metric);
    return {
      add(value = 1, labels: Labels = {}) {
        if (!Number.isFinite(value)) throw new Error("INVALID_METRIC_VALUE");
        const key = metricKey(labels);
        if (type === "counter" && value < 0) throw new Error("INVALID_METRIC_VALUE");
        metric.values.set(key, (metric.values.get(key) ?? 0) + value);
        metric.labels.set(key, { ...labels });
      },
      set(value: number, labels: Labels = {}) {
        if (type !== "gauge" || !Number.isFinite(value)) throw new Error("INVALID_METRIC_VALUE");
        const key = metricKey(labels); metric.values.set(key, value); metric.labels.set(key, { ...labels });
      }
    };
  }
  return {
    counter(name: string, help: string) { return register(name, help, "counter"); },
    gauge(name: string, help: string) { return register(name, help, "gauge"); },
    render() {
      const lines: string[] = [];
      for (const [name, metric] of [...metrics].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`# HELP ${name} ${metric.help.replace(/[\r\n]/g, " ")}`, `# TYPE ${name} ${metric.type}`);
        for (const [key, value] of metric.values) {
          const labels = metric.labels.get(key) ?? {};
          const suffix = Object.keys(labels).length ? `{${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([label, entry]) => `${label}="${labelValue(entry)}"`).join(",")}}` : "";
          lines.push(`${name}${suffix} ${value}`);
        }
      }
      return `${lines.join("\n")}\n`;
    }
  };
}

export interface ErrorReporter { capture(error: unknown, context?: LogFields): void | Promise<void> }
export function createSafeErrorReporter(reporter?: ErrorReporter): ErrorReporter {
  return {
    async capture(error, context = {}) {
      const normalized = safeError(error);
      log("error", "unexpected_error", { ...context, error: normalized });
      if (reporter) try { await reporter.capture(error, redact(context)); }
      catch (reporterError) { log("warn", "error_reporter_failed", { error: safeError(reporterError) }); }
    }
  };
}
