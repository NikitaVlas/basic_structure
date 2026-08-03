import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJson, resolveConfiguration } from "./configuration.mjs";

const ID = /^[a-z][a-z0-9-]*$/;

export class PolicyError extends Error {
  constructor(message, code = "POLICY_INVALID", exitCode = 1, data) { super(message); this.code = code; this.exitCode = exitCode; this.data = data; }
}

function validate(policy, id) {
  if (policy.schemaVersion !== 1 || policy.id !== id || !ID.test(id)) throw new PolicyError(`Invalid policy identity: ${id}.`);
  if (!["error", "warning"].includes(policy.severity)) throw new PolicyError(`Invalid severity in policy ${id}.`);
  for (const key of ["appliesWhen", "requiresCapabilities", "requiresFiles", "requiresScripts"]) if (!Array.isArray(policy[key])) throw new PolicyError(`${id}.${key} must be an array.`);
  for (const capability of [...policy.appliesWhen, ...policy.requiresCapabilities]) if (!ID.test(capability)) throw new PolicyError(`Invalid capability '${capability}' in ${id}.`);
  for (const file of policy.requiresFiles) if (typeof file !== "string" || path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) throw new PolicyError(`Unsafe required file '${file}' in ${id}.`);
  if (!ID.test(policy.remediationPreset ?? "")) throw new PolicyError(`Invalid remediation preset in ${id}.`);
}

export async function loadPolicy(starterRoot, id) {
  if (!ID.test(id ?? "")) throw new PolicyError("Policy id must be lowercase kebab-case.");
  const file = path.join(starterRoot, "policies", `${id}.json`);
  if (!(await pathExists(file))) throw new PolicyError(`Unknown policy '${id}'.`, "POLICY_NOT_FOUND");
  const policy = await readJson(file); validate(policy, id); return policy;
}

export async function listPolicies(starterRoot) {
  const entries = await readdir(path.join(starterRoot, "policies"), { withFileTypes: true });
  const policies = [];
  for (const entry of entries) if (entry.isFile() && entry.name.endsWith(".json")) policies.push(await loadPolicy(starterRoot, entry.name.slice(0, -5)));
  return policies.sort((a, b) => a.id.localeCompare(b.id));
}

export async function checkProjectPolicies(starterRoot, projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const config = await readJson(path.join(root, "project.config.json"));
  const resolved = await resolveConfiguration(starterRoot, config);
  const capabilities = new Set();
  for (const extension of [resolved.profile, ...resolved.modules, ...resolved.adapters]) for (const capability of extension.manifest.capabilities ?? []) capabilities.add(capability);
  let scripts = {};
  const packagePath = path.join(root, "package.json");
  if (await pathExists(packagePath)) scripts = JSON.parse(await readFile(packagePath, "utf8")).scripts ?? {};
  const policies = options.id ? [await loadPolicy(starterRoot, options.id)] : await listPolicies(starterRoot);
  const results = [];
  for (const policy of policies) {
    const applies = !policy.appliesWhen.length || policy.appliesWhen.some((capability) => capabilities.has(capability));
    if (!applies) { results.push({ id: policy.id, status: "skip", severity: policy.severity, message: "Policy is not applicable.", missingCapabilities: [], missingFiles: [], missingScripts: [], remediationPreset: policy.remediationPreset }); continue; }
    const missingCapabilities = policy.requiresCapabilities.filter((capability) => !capabilities.has(capability));
    const missingFiles = [];
    for (const relative of policy.requiresFiles) {
      const target = path.join(root, relative);
      if (!(await pathExists(target))) missingFiles.push(relative);
      else { const info = await lstat(target); if (info.isSymbolicLink() || !info.isFile()) missingFiles.push(relative); }
    }
    const missingScripts = policy.requiresScripts.filter((script) => typeof scripts[script] !== "string" || !scripts[script].trim());
    const failed = missingCapabilities.length || missingFiles.length || missingScripts.length;
    results.push({ id: policy.id, status: failed ? "fail" : "pass", severity: policy.severity, message: failed ? "Required policy evidence is missing." : "All required evidence is present.", missingCapabilities, missingFiles, missingScripts, remediationPreset: policy.remediationPreset });
  }
  const violations = results.filter((result) => result.status === "fail" && result.severity === "error");
  return { projectRoot: root, compliant: !violations.length, capabilities: [...capabilities].sort(), results };
}

