import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathExists, readJson, resolveConfiguration } from "./configuration.mjs";
import { planProjectUpgrade, summarizeUpgradePlan } from "./upgrade.mjs";
import { satisfiesSemver } from "./semver.mjs";

export function probeExecutable(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
  if (result.error) return { available: false, message: result.error.message };
  if (result.status !== 0) return { available: false, message: (result.stderr || result.stdout || `${command} exited ${result.status}`).trim() };
  return { available: true, version: (result.stdout || result.stderr).trim().split(/\r?\n/, 1)[0] };
}

function check(id, status, required, message, details) {
  return { id, status, required, message, ...(details === undefined ? {} : { details }) };
}

async function assertRegularFile(filePath, label) {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} must be a regular non-symbolic-link file.`);
}

async function inspectReports(projectRoot) {
  const reportsRoot = path.join(projectRoot, ".basic-structure", "reports");
  if (!(await pathExists(reportsRoot))) return [];
  const info = await lstat(reportsRoot);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Upgrade reports path must be a regular directory.");
  const unfinished = [];
  for (const entry of await readdir(reportsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const reportPath = path.join(reportsRoot, entry.name);
    await assertRegularFile(reportPath, "Upgrade report");
    const report = await readJson(reportPath);
    if (report.status !== "applied") unfinished.push({ file: entry.name, status: report.status ?? "unknown" });
  }
  return unfinished;
}

export async function diagnoseProject(starterRoot, projectRoot, options = {}) {
  const resolvedProject = path.resolve(projectRoot);
  const probe = options.probeExecutable ?? probeExecutable;
  const checks = [];
  const nodeVersion = process.versions.node;
  const nodeSupported = satisfiesSemver(nodeVersion, ">=22.12.0 <23.0.0") || satisfiesSemver(nodeVersion, ">=23.0.0");
  checks.push(check("node", nodeSupported ? "pass" : "fail", true, nodeSupported ? `Node.js ${nodeVersion} is supported.` : `Node.js ${nodeVersion} is unsupported; require >=22.12.0.`, { version: nodeVersion }));

  if (!(await pathExists(resolvedProject))) {
    checks.push(check("project", "fail", true, `Project directory does not exist: ${resolvedProject}`));
    return { projectRoot: resolvedProject, healthy: false, checks };
  }
  const projectInfo = await lstat(resolvedProject);
  if (projectInfo.isSymbolicLink() || !projectInfo.isDirectory()) {
    checks.push(check("project", "fail", true, `Project root must be a regular non-symbolic-link directory: ${resolvedProject}`));
    return { projectRoot: resolvedProject, healthy: false, checks };
  }
  checks.push(check("project", "pass", true, `Project directory exists: ${resolvedProject}`));

  let config;
  let resolved;
  const configPath = path.join(resolvedProject, "project.config.json");
  try {
    await assertRegularFile(configPath, "Project configuration");
    config = await readJson(configPath);
    resolved = await resolveConfiguration(starterRoot, config);
    checks.push(check("configuration", "pass", true, `Configuration and ${Object.keys(resolved.extensionVersions).length} extension versions are compatible.`, { starterVersion: resolved.starterVersion, extensionVersions: resolved.extensionVersions }));
  } catch (error) {
    checks.push(check("configuration", "fail", true, error.message));
  }

  try {
    const plan = await planProjectUpgrade(starterRoot, resolvedProject);
    checks.push(check("state", plan.blocked ? "fail" : "pass", true, plan.blocked ? "Generated state or upgrade plan is blocked." : "Generated state and upgrade plan are valid.", { blocked: plan.blocked, files: summarizeUpgradePlan(plan), extensions: plan.extensionChanges }));
  } catch (error) {
    checks.push(check("state", "fail", true, error.message));
  }

  const git = probe("git");
  checks.push(check("git", git.available ? "pass" : "fail", true, git.available ? git.version : `Git is unavailable: ${git.message}`));

  if (config?.adapters?.includes("docker-production")) {
    const docker = probe("docker");
    checks.push(check("docker", docker.available ? "pass" : "fail", true, docker.available ? docker.version : `Docker is required by adapter:docker-production and unavailable: ${docker.message}`));
  } else {
    checks.push(check("docker", "skip", false, "Docker is not required by the selected adapters."));
  }

  const packagePath = path.join(resolvedProject, "package.json");
  if (await pathExists(packagePath)) {
    try {
      await assertRegularFile(packagePath, "Package manifest");
      const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
      const hasVerify = typeof packageJson.scripts?.verify === "string" && packageJson.scripts.verify.trim();
      checks.push(check("verification-entrypoint", hasVerify ? "pass" : "fail", true, hasVerify ? `Verification command: ${packageJson.scripts.verify}` : "package.json must define scripts.verify."));
    } catch (error) {
      checks.push(check("verification-entrypoint", "fail", true, error.message));
    }
  } else {
    checks.push(check("verification-entrypoint", "skip", false, "No package.json; verification entry point is project-specific."));
  }

  try {
    const unfinished = await inspectReports(resolvedProject);
    checks.push(check("upgrade-reports", unfinished.length ? "fail" : "pass", true, unfinished.length ? `${unfinished.length} unfinished upgrade report(s) require review.` : "No unfinished upgrade reports.", unfinished));
  } catch (error) {
    checks.push(check("upgrade-reports", "fail", true, error.message));
  }

  return { projectRoot: resolvedProject, healthy: !checks.some((entry) => entry.required && entry.status === "fail"), checks };
}
