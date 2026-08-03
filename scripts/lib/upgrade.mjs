import { randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeProject } from "./initializer.mjs";
import { pathExists, readJson } from "./configuration.mjs";
import { hashGeneratedContent } from "./content-hash.mjs";

const BLOCKING_STATUSES = new Set(["conflict", "legacy-conflict"]);

function validateManagedPath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || path.posix.isAbsolute(value)) {
    throw new Error(`Invalid managed path: ${JSON.stringify(value)}.`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized.startsWith("../") || value.split("/").includes("")) {
    throw new Error(`Invalid managed path: ${JSON.stringify(value)}.`);
  }
  return value;
}

function validateState(state) {
  if (![1, 2].includes(state?.schemaVersion)) throw new Error(`Unsupported generated state schema: ${state?.schemaVersion}.`);
  if (!Array.isArray(state.generatedFiles)) throw new Error("Generated state must contain generatedFiles.");
  const seen = new Set();
  for (const entry of state.generatedFiles) {
    validateManagedPath(entry?.path);
    if (typeof entry.owner !== "string" || !entry.owner) throw new Error(`Invalid owner for '${entry.path}'.`);
    if (seen.has(entry.path)) throw new Error(`Duplicate managed path in state: ${entry.path}.`);
    seen.add(entry.path);
    if (state.schemaVersion === 2 && (entry.hashAlgorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(entry.hash ?? ""))) {
      throw new Error(`Invalid SHA-256 baseline for '${entry.path}'.`);
    }
  }
}

async function readCurrent(projectRoot, relative) {
  await assertNoSymlinkTraversal(projectRoot, relative);
  const absolute = path.join(projectRoot, ...relative.split("/"));
  if (!(await pathExists(absolute))) return { exists: false, absolute };
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw new Error(`Managed path must not be a symbolic link: ${relative}.`);
  if (!info.isFile()) throw new Error(`Managed path must be a regular file: ${relative}.`);
  const content = await readFile(absolute);
  return { exists: true, absolute, content, hash: hashGeneratedContent(content, relative) };
}

async function assertNoSymlinkTraversal(projectRoot, relative) {
  let current = projectRoot;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`Managed path must not traverse a symbolic link: ${relative}.`);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}

async function assertControlFile(filePath, label) {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} must be a regular non-symbolic-link file: ${filePath}`);
}

async function renderDesired(starterRoot, config) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-upgrade-"));
  const outputRoot = path.join(temporaryRoot, "desired");
  try {
    await initializeProject(starterRoot, outputRoot, config);
    const state = await readJson(path.join(outputRoot, ".basic-structure", "state.json"));
    const files = new Map();
    for (const entry of state.generatedFiles) {
      validateManagedPath(entry.path);
      files.set(entry.path, await readFile(path.join(outputRoot, ...entry.path.split("/"))));
    }
    return { state, files };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function planProjectUpgrade(starterRoot, projectRoot) {
  const resolvedProject = await realpath(path.resolve(projectRoot));
  const statePath = path.join(resolvedProject, ".basic-structure", "state.json");
  const configPath = path.join(resolvedProject, "project.config.json");
  if (!(await pathExists(statePath))) throw new Error(`Generated state does not exist: ${statePath}`);
  if (!(await pathExists(configPath))) throw new Error(`Project configuration does not exist: ${configPath}`);
  await assertNoSymlinkTraversal(resolvedProject, ".basic-structure/state.json");
  await Promise.all([assertControlFile(statePath, "Generated state"), assertControlFile(configPath, "Project configuration")]);

  const [previousState, config] = await Promise.all([readJson(statePath), readJson(configPath)]);
  validateState(previousState);
  const desired = await renderDesired(starterRoot, config);
  validateState(desired.state);

  const previousByPath = new Map(previousState.generatedFiles.map((entry) => [entry.path, entry]));
  const desiredByPath = new Map(desired.state.generatedFiles.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...previousByPath.keys(), ...desiredByPath.keys()])].sort();
  const changes = [];

  for (const relative of paths) {
    const previous = previousByPath.get(relative);
    const next = desiredByPath.get(relative);
    const current = await readCurrent(resolvedProject, relative);
    let status;
    let reason;

    if (!previous && next) {
      status = current.exists ? "conflict" : "new";
      reason = current.exists ? "Starter path is occupied by an untracked file." : "Starter introduced this file.";
    } else if (previous && !next) {
      if (!current.exists) {
        status = "unchanged";
        reason = "Retired file is already absent.";
      } else if (previousState.schemaVersion === 1) {
        status = "legacy-conflict";
        reason = "Legacy state has no baseline for a retired file.";
      } else if (current.hash === previous.hash) {
        status = "safe-delete";
        reason = "Starter retired an unmodified generated file.";
      } else {
        status = "conflict";
        reason = "User modified a file that the starter retired.";
      }
    } else if (!current.exists) {
      status = "conflict";
      reason = "A managed file is missing but still required by the starter.";
    } else if (current.hash === next.hash) {
      status = "unchanged";
      reason = "Current content already matches the starter.";
    } else if (previousState.schemaVersion === 1) {
      status = "legacy-conflict";
      reason = "Legacy state has no baseline and current content differs from the starter.";
    } else if (current.hash === previous.hash) {
      status = "safe-update";
      reason = "Starter changed an unmodified generated file.";
    } else if (next.hash === previous.hash) {
      status = "user-modified";
      reason = "Only the user changed this generated file; it will be preserved.";
    } else {
      status = "conflict";
      reason = "User and starter both changed this generated file.";
    }
    changes.push({ path: relative, owner: next?.owner ?? previous?.owner, status, reason });
  }

  return {
    projectRoot: resolvedProject,
    previousSchemaVersion: previousState.schemaVersion,
    targetSchemaVersion: desired.state.schemaVersion,
    blocked: changes.some((change) => BLOCKING_STATUSES.has(change.status)),
    changes,
    desiredState: desired.state,
    desiredFiles: desired.files,
    previousStateContent: await readFile(statePath)
  };
}

function publicPlan(plan) {
  return {
    projectRoot: plan.projectRoot,
    previousSchemaVersion: plan.previousSchemaVersion,
    targetSchemaVersion: plan.targetSchemaVersion,
    blocked: plan.blocked,
    changes: plan.changes
  };
}

export async function applyProjectUpgrade(plan) {
  if (plan.blocked) throw new Error("Upgrade is blocked by conflicts. Resolve them and run --plan again.");
  const actionable = plan.changes.filter((change) => ["safe-update", "safe-delete", "new"].includes(change.status));
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const operationId = `${stamp}-${randomUUID().slice(0, 8)}`;
  const controlRoot = path.join(plan.projectRoot, ".basic-structure");
  const backupRoot = path.join(controlRoot, "backups", operationId);
  const reportRoot = path.join(controlRoot, "reports");
  await mkdir(reportRoot, { recursive: true });

  const backedUp = [];
  const created = [];
  try {
    for (const change of actionable.filter((entry) => entry.status !== "new")) {
      await assertNoSymlinkTraversal(plan.projectRoot, change.path);
      const source = path.join(plan.projectRoot, ...change.path.split("/"));
      if (!(await pathExists(source))) continue;
      const destination = path.join(backupRoot, ...change.path.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
      backedUp.push(change.path);
    }

    for (const change of actionable) {
      await assertNoSymlinkTraversal(plan.projectRoot, change.path);
      const destination = path.join(plan.projectRoot, ...change.path.split("/"));
      if (change.status === "safe-delete") {
        await rm(destination);
      } else {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, plan.desiredFiles.get(change.path));
        if (change.status === "new") created.push(change.path);
      }
    }

    const state = { ...plan.desiredState, updatedAt: new Date().toISOString() };
    const report = { schemaVersion: 1, operationId, status: "prepared", createdAt: new Date().toISOString(), backupRoot: backedUp.length ? path.relative(plan.projectRoot, backupRoot).split(path.sep).join("/") : null, plan: publicPlan(plan) };
    const reportPath = path.join(reportRoot, `${operationId}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(path.join(controlRoot, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    report.status = "applied";
    report.completedAt = new Date().toISOString();
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { operationId, backupRoot: backedUp.length ? backupRoot : null, reportPath, changes: actionable };
  } catch (error) {
    for (const relative of created.reverse()) await rm(path.join(plan.projectRoot, ...relative.split("/")), { force: true });
    for (const relative of backedUp.reverse()) {
      const source = path.join(backupRoot, ...relative.split("/"));
      const destination = path.join(plan.projectRoot, ...relative.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    await writeFile(path.join(controlRoot, "state.json"), plan.previousStateContent);
    throw new Error(`Upgrade failed and file changes were rolled back: ${error.message}`);
  }
}

export function summarizeUpgradePlan(plan) {
  const counts = Object.create(null);
  for (const change of plan.changes) counts[change.status] = (counts[change.status] ?? 0) + 1;
  return counts;
}
