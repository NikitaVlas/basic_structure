import { randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeProject } from "./initializer.mjs";
import { pathExists, readJson } from "./configuration.mjs";
import { hashGeneratedContent } from "./content-hash.mjs";
import { compareSemver, parseSemver, satisfiesSemver } from "./semver.mjs";

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
  if (![1, 2, 3, 4, 5].includes(state?.schemaVersion)) throw new Error(`Unsupported generated state schema: ${state?.schemaVersion}.`);
  if (typeof state.profile !== "string" || !/^[a-z][a-z0-9-]*$/.test(state.profile)) throw new Error("Generated state contains an invalid profile id.");
  for (const key of ["modules", "adapters"]) {
    if (!Array.isArray(state[key]) || new Set(state[key]).size !== state[key].length || state[key].some((id) => !/^[a-z][a-z0-9-]*$/.test(id))) {
      throw new Error(`Generated state contains invalid ${key}.`);
    }
  }
  if (!Array.isArray(state.generatedFiles)) throw new Error("Generated state must contain generatedFiles.");
  const seen = new Set();
  for (const entry of state.generatedFiles) {
    validateManagedPath(entry?.path);
    if (typeof entry.owner !== "string" || !entry.owner) throw new Error(`Invalid owner for '${entry.path}'.`);
    if (seen.has(entry.path)) throw new Error(`Duplicate managed path in state: ${entry.path}.`);
    seen.add(entry.path);
    if (state.schemaVersion >= 2 && (entry.hashAlgorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(entry.hash ?? ""))) {
      throw new Error(`Invalid SHA-256 baseline for '${entry.path}'.`);
    }
  }
  if (state.schemaVersion >= 3) {
    if (!state.extensionVersions || typeof state.extensionVersions !== "object" || Array.isArray(state.extensionVersions)) {
      throw new Error("State schema 3 must contain extensionVersions.");
    }
    for (const [identity, version] of Object.entries(state.extensionVersions)) {
      if (!/^(profile|module|adapter):[a-z][a-z0-9-]*$/.test(identity)) throw new Error(`Invalid extension identity in state: ${identity}.`);
      try { parseSemver(version); } catch { throw new Error(`Invalid extension version in state for ${identity}.`); }
    }
    const expected = new Set([`profile:${state.profile}`, ...state.modules.map((id) => `module:${id}`), ...state.adapters.map((id) => `adapter:${id}`)]);
    const recorded = new Set(Object.keys(state.extensionVersions));
    if (expected.size !== recorded.size || [...expected].some((identity) => !recorded.has(identity))) {
      throw new Error("State extensionVersions must exactly match the selected profile, modules, and adapters.");
    }
    if (state.schemaVersion >= 4) {
      if (!state.extensionProvenance || typeof state.extensionProvenance !== "object" || Array.isArray(state.extensionProvenance)) throw new Error("State schema 4 must contain extensionProvenance.");
      const provenanceIds = new Set(Object.keys(state.extensionProvenance));
      if (recorded.size !== provenanceIds.size || [...recorded].some((identity) => !provenanceIds.has(identity))) throw new Error("State extensionProvenance must exactly match extensionVersions.");
      for (const [identity, provenance] of Object.entries(state.extensionProvenance)) {
        if (provenance?.source === "built-in") { if (Object.keys(provenance).length !== 1) throw new Error(`Invalid built-in provenance for ${identity}.`); continue; }
        if (provenance?.source !== "activated" || !/^[a-z][a-z0-9-]*$/.test(provenance.publisher ?? "") || !/^[a-z][a-z0-9-]*$/.test(provenance.catalog ?? "") || !/^[a-f0-9]{64}$/.test(provenance.digest ?? "") || !/^[a-z][a-z0-9-]*$/.test(provenance.keyId ?? "") || !/^sha256:[a-f0-9]{64}$/.test(provenance.fingerprint ?? "") || provenance.trust !== "trusted") throw new Error(`Invalid activated provenance for ${identity}.`);
        try { parseSemver(provenance.catalogVersion); } catch { throw new Error(`Invalid catalog version provenance for ${identity}.`); }
      }
      if(state.schemaVersion===5){if(state.adoption?.mode!=="existing-project"||!Array.isArray(state.adoption.userOwnedFiles)||!Array.isArray(state.adoption.excludedManagedPaths))throw new Error("State schema 5 must contain adoption ownership metadata.");const managed=new Set(state.generatedFiles.map((entry)=>entry.path));for(const entry of state.adoption.userOwnedFiles){validateManagedPath(entry?.path);if(entry.hashAlgorithm!=="sha256"||!/^[a-f0-9]{64}$/.test(entry.hash??""))throw new Error(`Invalid user-owned baseline for '${entry?.path}'.`);if(managed.has(entry.path))throw new Error(`Path cannot be both managed and user-owned: ${entry.path}.`);}for(const relative of state.adoption.excludedManagedPaths)validateManagedPath(relative);}
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
    const initialization = await initializeProject(starterRoot, outputRoot, config);
    const state = await readJson(path.join(outputRoot, ".basic-structure", "state.json"));
    const files = new Map();
    for (const entry of state.generatedFiles) {
      validateManagedPath(entry.path);
      files.set(entry.path, await readFile(path.join(outputRoot, ...entry.path.split("/"))));
    }
    const extensionMigrations = Object.fromEntries(
      [initialization.resolved.profile, ...initialization.resolved.modules, ...initialization.resolved.adapters]
        .map(({ manifest }) => [`${manifest.kind}:${manifest.id}`, manifest.migrations ?? []])
    );
    return { state, files, extensionMigrations };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function classifyExtensionChanges(previousState, desired, acknowledgements) {
  const previousVersions = previousState.extensionVersions ?? {};
  const desiredVersions = desired.state.extensionVersions;
  const identities = [...new Set([...Object.keys(previousVersions), ...Object.keys(desiredVersions)])].sort();
  const accepted = new Set(acknowledgements);
  return identities.map((identity) => {
    const fromVersion = previousVersions[identity] ?? null;
    const toVersion = desiredVersions[identity] ?? null;
    if (!fromVersion) {
      const added = previousState.schemaVersion >= 3;
      return { identity, fromVersion, toVersion, status: added ? "added" : "baseline-adoption", acknowledged: true, notices: [], reason: added ? "Extension is newly selected." : "Previous state did not record this extension version." };
    }
    if (!toVersion) return { identity, fromVersion, toVersion, status: "removed", acknowledged: true, notices: [], reason: "Extension is no longer selected." };
    const comparison = compareSemver(toVersion, fromVersion);
    if (comparison === 0) return { identity, fromVersion, toVersion, status: "unchanged", acknowledged: true, notices: [], reason: "Extension version is unchanged." };
    if (comparison < 0) return { identity, fromVersion, toVersion, status: "downgrade-blocked", acknowledged: false, notices: [], reason: "Extension downgrades require an explicit reverse-migration design." };

    const notices = (desired.extensionMigrations[identity] ?? []).filter((migration) => migration.to === toVersion && satisfiesSemver(fromVersion, migration.from));
    const majorChanged = parseSemver(fromVersion).major !== parseSemver(toVersion).major;
    const required = majorChanged || notices.some((notice) => notice.required);
    const acknowledged = !required || accepted.has(identity);
    return {
      identity,
      fromVersion,
      toVersion,
      status: required ? "migration-required" : "compatible",
      acknowledged,
      notices: notices.map(({ from, to, required: noticeRequired, description }) => ({ from, to, required: noticeRequired, description })),
      reason: required ? "Breaking extension upgrade requires explicit acknowledgement." : "Forward-compatible extension upgrade."
    };
  });
}

export async function planProjectUpgrade(starterRoot, projectRoot, options = {}) {
  const resolvedProject = await realpath(path.resolve(projectRoot));
  const statePath = path.join(resolvedProject, ".basic-structure", "state.json");
  const configPath = path.join(resolvedProject, "project.config.json");
  if (!(await pathExists(statePath))) throw new Error(`Generated state does not exist: ${statePath}`);
  if (!(await pathExists(configPath))) throw new Error(`Project configuration does not exist: ${configPath}`);
  await assertNoSymlinkTraversal(resolvedProject, ".basic-structure/state.json");
  await Promise.all([assertControlFile(statePath, "Generated state"), assertControlFile(configPath, "Project configuration")]);

  const [previousState, currentConfig, previousConfigContent] = await Promise.all([readJson(statePath), readJson(configPath), readFile(configPath)]);
  validateState(previousState);
  const desiredConfig = options.config ?? currentConfig;
  const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(desiredConfig);
  const desiredConfigContent = Buffer.from(`${JSON.stringify(desiredConfig, null, 2)}\n`, "utf8");
  let desired = await renderDesired(starterRoot, desiredConfig);
  if(previousState.schemaVersion===5){const excluded=new Set(previousState.adoption.excludedManagedPaths);const generatedFiles=desired.state.generatedFiles.filter((entry)=>entry.owner==="core"&&!excluded.has(entry.path));const allowed=new Set(generatedFiles.map((entry)=>entry.path));desired={...desired,state:{...desired.state,schemaVersion:5,generatedFiles,adoption:previousState.adoption},files:new Map([...desired.files].filter(([relative])=>allowed.has(relative)))};}
  validateState(desired.state);
  const extensionChanges = classifyExtensionChanges(previousState, desired, options.acknowledgements ?? []);

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
    blocked: changes.some((change) => BLOCKING_STATUSES.has(change.status)) || extensionChanges.some((change) => change.status === "downgrade-blocked" || !change.acknowledged),
    changes,
    extensionChanges,
    configChange: {
      changed: configChanged,
      before: { profile: currentConfig.project.profile, modules: currentConfig.modules, adapters: currentConfig.adapters },
      after: { profile: desiredConfig.project.profile, modules: desiredConfig.modules, adapters: desiredConfig.adapters }
    },
    desiredState: desired.state,
    desiredFiles: desired.files,
    desiredConfigContent,
    previousStateContent: await readFile(statePath),
    previousConfigContent
  };
}

function publicPlan(plan) {
  return {
    projectRoot: plan.projectRoot,
    previousSchemaVersion: plan.previousSchemaVersion,
    targetSchemaVersion: plan.targetSchemaVersion,
    blocked: plan.blocked,
    configChange: plan.configChange,
    ...(plan.compositionChange ? { compositionChange: plan.compositionChange } : {}),
    ...(plan.profileMigration ? { profileMigration: plan.profileMigration } : {}),
    ...(plan.presetChange ? { presetChange: plan.presetChange } : {}),
    ...(plan.policyChange ? { policyChange: plan.policyChange } : {}),
    changes: plan.changes,
    extensionChanges: plan.extensionChanges
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
  let configBackedUp = false;
  try {
    if (plan.configChange.changed) {
      const configBackup = path.join(backupRoot, "project.config.json");
      await mkdir(path.dirname(configBackup), { recursive: true });
      await copyFile(path.join(plan.projectRoot, "project.config.json"), configBackup);
      configBackedUp = true;
    }
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
    const hasBackup = backedUp.length > 0 || configBackedUp;
    const report = { schemaVersion: 1, operationId, status: "prepared", createdAt: new Date().toISOString(), backupRoot: hasBackup ? path.relative(plan.projectRoot, backupRoot).split(path.sep).join("/") : null, plan: publicPlan(plan) };
    const reportPath = path.join(reportRoot, `${operationId}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (plan.configChange.changed) await writeFile(path.join(plan.projectRoot, "project.config.json"), plan.desiredConfigContent);
    await writeFile(path.join(controlRoot, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    report.status = "applied";
    report.completedAt = new Date().toISOString();
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { operationId, backupRoot: hasBackup ? backupRoot : null, reportPath, changes: actionable, configChanged: plan.configChange.changed };
  } catch (error) {
    for (const relative of created.reverse()) await rm(path.join(plan.projectRoot, ...relative.split("/")), { force: true });
    for (const relative of backedUp.reverse()) {
      const source = path.join(backupRoot, ...relative.split("/"));
      const destination = path.join(plan.projectRoot, ...relative.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    if (configBackedUp) await writeFile(path.join(plan.projectRoot, "project.config.json"), plan.previousConfigContent);
    await writeFile(path.join(controlRoot, "state.json"), plan.previousStateContent);
    throw new Error(`Upgrade failed and file changes were rolled back: ${error.message}`);
  }
}

export function summarizeUpgradePlan(plan) {
  const counts = Object.create(null);
  for (const change of plan.changes) counts[change.status] = (counts[change.status] ?? 0) + 1;
  return counts;
}
