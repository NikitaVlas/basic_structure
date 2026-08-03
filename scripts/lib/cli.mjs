import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadExtension, pathExists, readJson, resolveConfiguration } from "./configuration.mjs";
import { initializeProject } from "./initializer.mjs";
import { applyProjectUpgrade, planProjectUpgrade, summarizeUpgradePlan } from "./upgrade.mjs";
import { diagnoseProject } from "./doctor.mjs";
import { planCompositionChange } from "./composition.mjs";

class CliError extends Error {
  constructor(message, code = "INVALID_REQUEST", exitCode = 1, data) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.data = data;
  }
}

const ROOT_HELP = `Usage: basic-structure <command> [options]

Commands:
  init       Create or preview a generated project
  validate   Validate configuration and compatibility
  list       List local profiles, modules, and adapters
  update     Plan or apply a safe project upgrade
  add        Add a module or adapter with required dependencies
  remove     Remove an unreferenced module or adapter
  doctor     Run read-only project and environment diagnostics

Global options:
  --json     Emit one machine-readable JSON envelope
  --help     Show help`;

const COMMAND_HELP = {
  init: "Usage: basic-structure init --config <file> --output <empty-directory> [--dry-run] [--json]",
  validate: "Usage: basic-structure validate [--config <file>] [--json]",
  list: "Usage: basic-structure list [--kind profile|module|adapter] [--json]",
  update: "Usage: basic-structure update [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  add: "Usage: basic-structure add <module|adapter> <id> [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  remove: "Usage: basic-structure remove <module|adapter> <id> [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  doctor: "Usage: basic-structure doctor [--project <directory>] [--json]"
};

function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new CliError(`${option} requires a value.`);
  return value;
}

function rejectUnknown(argument) {
  throw new CliError(`Unknown option: ${argument}`);
}

function parseInit(argv) {
  const options = { config: "project.config.json", output: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--config") options.config = takeValue(argv, index++, "--config");
    else if (argv[index] === "--output") options.output = takeValue(argv, index++, "--output");
    else if (argv[index] === "--dry-run") options.dryRun = true;
    else rejectUnknown(argv[index]);
  }
  if (!options.output) throw new CliError("--output is required.");
  return options;
}

function parseSinglePath(argv, option, fallback) {
  let value = fallback;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === option) value = takeValue(argv, index++, option);
    else rejectUnknown(argv[index]);
  }
  return value;
}

function parseList(argv) {
  const options = { kind: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--kind") options.kind = takeValue(argv, index++, "--kind");
    else rejectUnknown(argv[index]);
  }
  if (options.kind && !["profile", "module", "adapter"].includes(options.kind)) throw new CliError("--kind must be profile, module, or adapter.");
  return options;
}

function parseUpdate(argv) {
  const options = { project: ".", apply: false, acknowledgements: [] };
  let modeSeen = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--project") options.project = takeValue(argv, index++, "--project");
    else if (argv[index] === "--plan" || argv[index] === "--apply") {
      const mode = argv[index].slice(2);
      if (modeSeen && modeSeen !== mode) throw new CliError("Choose either --plan or --apply, not both.");
      modeSeen = mode;
      options.apply = mode === "apply";
    } else if (argv[index] === "--acknowledge-migration") {
      const identity = takeValue(argv, index++, "--acknowledge-migration");
      if (!/^(profile|module|adapter):[a-z][a-z0-9-]*$/.test(identity)) throw new CliError("--acknowledge-migration requires a qualified extension id.");
      options.acknowledgements.push(identity);
    } else rejectUnknown(argv[index]);
  }
  return options;
}

function parseComposition(argv) {
  const kind = argv.shift();
  const id = argv.shift();
  if (!kind || !id) throw new CliError("Composition command requires <module|adapter> <id>.");
  const options = parseUpdate(argv);
  return { ...options, kind, id };
}

async function listExtensions(starterRoot, kindFilter) {
  const result = [];
  for (const kind of ["profile", "module", "adapter"]) {
    if (kindFilter && kind !== kindFilter) continue;
    const parent = path.join(starterRoot, `${kind}s`);
    if (!(await pathExists(parent))) continue;
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const { manifest } = await loadExtension(starterRoot, kind, entry.name);
      result.push({ kind, id: manifest.id, version: manifest.version, starter: manifest.starter, description: manifest.description, requires: manifest.requires, conflicts: manifest.conflicts, migrations: manifest.migrations ?? [] });
    }
  }
  return result.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

function success(command, data, lines = []) {
  return { schemaVersion: 1, command, ok: true, exitCode: 0, data, lines };
}

async function execute(command, argv, context) {
  const { starterRoot, cwd } = context;
  if (command === "init") {
    const options = parseInit(argv);
    const config = await readJson(path.resolve(cwd, options.config));
    const plan = await initializeProject(starterRoot, path.resolve(cwd, options.output), config, { dryRun: options.dryRun });
    const data = { project: config.project.name, outputRoot: plan.outputRoot, dryRun: options.dryRun, managedFiles: plan.files.length };
    return success(command, data, [`${options.dryRun ? "Planned" : "Initialized"} '${config.project.name}' at ${plan.outputRoot}.`, `Managed files: ${plan.files.length}`]);
  }
  if (command === "validate") {
    const configPath = parseSinglePath(argv, "--config", "project.config.json");
    const config = await readJson(path.resolve(cwd, configPath));
    const resolved = await resolveConfiguration(starterRoot, config);
    const data = { project: config.project.name, starterVersion: resolved.starterVersion, extensionVersions: resolved.extensionVersions };
    return success(command, data, [`Configuration is valid: ${config.project.name}`, ...Object.entries(resolved.extensionVersions).map(([identity, version]) => `${identity}@${version}`)]);
  }
  if (command === "list") {
    const options = parseList(argv);
    const extensions = await listExtensions(starterRoot, options.kind);
    return success(command, { extensions }, extensions.map((entry) => `${entry.kind}:${entry.id}@${entry.version} — ${entry.description}`));
  }
  if (command === "update") {
    const options = parseUpdate(argv);
    const plan = await planProjectUpgrade(starterRoot, path.resolve(cwd, options.project), { acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Upgrade is blocked by file conflicts or migration requirements.", "UPGRADE_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [...plan.extensionChanges.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.identity} ${entry.fromVersion ?? "none"} -> ${entry.toVersion ?? "none"}`), ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`), options.apply ? `Applied upgrade ${data.result.operationId}.` : "Plan only; no project files were changed."];
    return success(command, data, lines);
  }
  if (command === "add" || command === "remove") {
    const options = parseComposition(argv);
    const plan = await planCompositionChange(starterRoot, path.resolve(cwd, options.project), { action: command, kind: options.kind, id: options.id, acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, compositionChange: plan.compositionChange, configChange: plan.configChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Composition change is blocked by file conflicts or migration requirements.", "COMPOSITION_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [
      `${command.toUpperCase()} ${plan.compositionChange.requested}`,
      ...plan.compositionChange.automatic.map((identity) => `REQUIRED ${identity}`),
      ...plan.extensionChanges.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.identity}`),
      ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`),
      options.apply ? `Applied composition change ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."
    ];
    return success(command, data, lines);
  }
  if (command === "doctor") {
    const project = parseSinglePath(argv, "--project", ".");
    const diagnosis = await diagnoseProject(starterRoot, path.resolve(cwd, project), { probeExecutable: context.probeExecutable });
    if (!diagnosis.healthy) throw new CliError("Doctor found required failing checks.", "DOCTOR_UNHEALTHY", 3, diagnosis);
    return success(command, diagnosis, diagnosis.checks.map((entry) => `${entry.status.toUpperCase().padEnd(4)} ${entry.id}: ${entry.message}`));
  }
  throw new CliError(`Unknown command: ${command ?? "(none)"}`);
}

function envelopeFromError(command, error) {
  return { schemaVersion: 1, command: command ?? null, ok: false, exitCode: error.exitCode ?? 1, ...(error.data === undefined ? {} : { data: error.data }), error: { code: error.code ?? "COMMAND_FAILED", message: error.message } };
}

export async function runCli(options) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const raw = [...(options.argv ?? [])];
  const json = raw.includes("--json");
  const argv = raw.filter((argument) => argument !== "--json");
  const command = argv.shift();
  if (!command || command === "--help" || command === "-h" || command === "help") {
    const help = command === "help" && argv[0] ? COMMAND_HELP[argv[0]] : ROOT_HELP;
    if (!help) {
      const error = new CliError(`Unknown command: ${argv[0]}`);
      const envelope = envelopeFromError(argv[0], error);
      if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stderr.write(`${error.message}\n${ROOT_HELP}\n`);
      return envelope.exitCode;
    }
    const envelope = success("help", { topic: command === "help" ? argv[0] ?? null : null, text: help });
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stdout.write(`${help}\n`);
    return 0;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    const help = COMMAND_HELP[command];
    if (!help) {
      const error = new CliError(`Unknown command: ${command}`);
      const envelope = envelopeFromError(command, error);
      if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stderr.write(`${error.message}\n${ROOT_HELP}\n`);
      return envelope.exitCode;
    }
    const envelope = success("help", { topic: command, text: help });
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stdout.write(`${help}\n`);
    return 0;
  }
  try {
    const result = await execute(command, argv, options);
    if (json) stdout.write(`${JSON.stringify({ schemaVersion: result.schemaVersion, command: result.command, ok: result.ok, exitCode: result.exitCode, data: result.data })}\n`);
    else for (const line of result.lines) stdout.write(`${line}\n`);
    return result.exitCode;
  } catch (error) {
    const envelope = envelopeFromError(command, error);
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`);
    else {
      if (error.data?.checks) for (const entry of error.data.checks) stderr.write(`${entry.status.toUpperCase().padEnd(4)} ${entry.id}: ${entry.message}\n`);
      if (error.code === "UPGRADE_BLOCKED" || error.code === "COMPOSITION_BLOCKED") {
        for (const entry of error.data.extensionChanges.filter((change) => change.status !== "unchanged")) {
          stderr.write(`${entry.status.toUpperCase()} ${entry.identity} ${entry.fromVersion ?? "none"} -> ${entry.toVersion ?? "none"}${entry.acknowledged ? "" : " — acknowledgement required"}\n`);
          for (const notice of entry.notices) stderr.write(`  Migration: ${notice.description}\n`);
        }
        for (const entry of error.data.fileChanges.filter((change) => change.status !== "unchanged")) stderr.write(`${entry.status.toUpperCase()} ${entry.path}: ${entry.reason}\n`);
      }
      stderr.write(`${error.message}\n`);
      const help = COMMAND_HELP[command];
      if (error instanceof CliError && error.exitCode === 1 && help) stderr.write(`${help}\n`);
    }
    return envelope.exitCode;
  }
}
