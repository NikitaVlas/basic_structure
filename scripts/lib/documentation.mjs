import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./configuration.mjs";

const TEMPLATE_PATHS = [
  /(^|\/)docs\/questionnaires\//,
  /(^|\/)docs\/specifications\//,
  /(^|\/)docs\/development\/quality-plan-template\.md$/,
  /(^|\/)docs\/architecture\/decisions\//
];
const PROJECT_EXCLUSIONS = [
  /(^|\/)tasks\//,
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)work\//,
  /(^|\/)(?:dist|build|coverage)\//
];
const PLACEHOLDERS = [/\bTBD\b/, /YYYY-MM-DD/, /Describe (?:the|what|stores|identity|configuration|logs|runtime)/, /\[ \] Question:/];

async function collectMarkdownFiles(root, relative = "") {
  if (relative && isIgnored(`${relative}${path.sep}`)) return [];
  const current = path.join(root, relative);
  if (!(await pathExists(current))) return [];
  const info = await stat(current);
  if (info.isFile()) return current.endsWith(".md") ? [relative] : [];
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => collectMarkdownFiles(root, path.join(relative, entry.name))));
  return nested.flat();
}

function normalized(relative) {
  return relative.split(path.sep).join("/");
}

function isIgnored(relative) {
  const candidate = normalized(relative);
  return PROJECT_EXCLUSIONS.some((pattern) => pattern.test(candidate));
}

function permitsPlaceholders(relative, mode) {
  if (mode === "template") return true;
  return TEMPLATE_PATHS.some((pattern) => pattern.test(normalized(relative)));
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

async function checkLinks(root, relative, content) {
  const findings = [];
  const expression = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of content.matchAll(expression)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "").split("#")[0];
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const decoded = decodeURIComponent(rawTarget);
    const target = path.resolve(path.dirname(path.join(root, relative)), decoded);
    if (!(await pathExists(target))) {
      findings.push({ file: normalized(relative), line: lineNumberAt(content, match.index), rule: "broken-link", message: `Missing local target: ${rawTarget}` });
    }
  }
  return findings;
}

export async function inspectDocumentation(root, options = {}) {
  const mode = options.mode ?? "project";
  if (!new Set(["template", "project"]).has(mode)) throw new Error(`Unknown documentation mode: ${mode}`);
  const findings = [];
  const files = await collectMarkdownFiles(root);
  for (const relative of files) {
    if (isIgnored(relative)) continue;
    const content = await readFile(path.join(root, relative), "utf8");
    findings.push(...await checkLinks(root, relative, content));
    if (permitsPlaceholders(relative, mode)) continue;
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      for (const pattern of PLACEHOLDERS) {
        if (pattern.test(lines[index])) {
          findings.push({ file: normalized(relative), line: index + 1, rule: "placeholder", message: lines[index].trim() });
          break;
        }
      }
    }
  }
  return { mode, filesChecked: files.length, findings };
}
