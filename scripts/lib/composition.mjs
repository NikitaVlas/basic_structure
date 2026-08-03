import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadExtension, readJson, resolveConfiguration } from "./configuration.mjs";
import { findUnfinishedUpgradeReports } from "./doctor.mjs";
import { satisfiesSemver } from "./semver.mjs";
import { configurationFromPreset } from "./presets.mjs";
import { planProjectUpgrade } from "./upgrade.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const SYNCHRONIZED_FILE_STATUSES = new Set(["unchanged", "user-modified"]);

export class CompositionError extends Error {
  constructor(message, code = "COMPOSITION_INVALID", exitCode = 1, data) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.data = data;
  }
}

function assertKindAndId(kind, id) {
  if (!new Set(["module", "adapter"]).has(kind)) throw new CompositionError("Composition changes support module or adapter kinds; profile replacement is not supported.");
  if (!ID_PATTERN.test(id ?? "")) throw new CompositionError("Extension id must be a lowercase kebab-case identifier.");
}

function selectedIdentities(config) {
  return new Set([`profile:${config.project.profile}`, ...config.modules.map((id) => `module:${id}`), ...config.adapters.map((id) => `adapter:${id}`)]);
}

function assertSynchronized(plan) {
  const fileChanges = plan.changes.filter((change) => !SYNCHRONIZED_FILE_STATUSES.has(change.status));
  const extensionChanges = plan.extensionChanges.filter((change) => change.status !== "unchanged");
  if (plan.blocked || fileChanges.length || extensionChanges.length || plan.configChange.changed) {
    throw new CompositionError(
      "Project must be updated to the current starter before changing composition.",
      "PROJECT_UPDATE_REQUIRED",
      2,
      { blocked: plan.blocked, fileChanges, extensionChanges }
    );
  }
}

async function assertCompositionReady(starterRoot, projectRoot) {
  const unfinishedReports = await findUnfinishedUpgradeReports(projectRoot);
  if (unfinishedReports.length) {
    throw new CompositionError(
      "Unfinished upgrade reports require review before changing composition.",
      "UNFINISHED_UPGRADE",
      2,
      { reports: unfinishedReports }
    );
  }
  assertSynchronized(await planProjectUpgrade(starterRoot, projectRoot));
}

async function collectProfileSlots(directory) {
  const slots = new Set();
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile()) {
        const content = await readFile(candidate, "utf8");
        for (const match of content.matchAll(/\{\{SLOT:([A-Z][A-Z0-9_]*)\}\}/g)) slots.add(match[1]);
      }
    }
  }
  await visit(directory);
  return slots;
}

function identityOf(extension) {
  return `${extension.manifest.kind}:${extension.manifest.id}`;
}

function findIncompatibleExtensions(extensions, targetProfile, targetSlots) {
  const targetIdentity = identityOf(targetProfile);
  const selected = new Map([[targetIdentity, targetProfile.manifest.version], ...extensions.map((extension) => [identityOf(extension), extension.manifest.version])]);
  const pruned = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const extension of extensions) {
      const identity = identityOf(extension);
      if (pruned.has(identity)) continue;
      const missingSlot = Object.keys(extension.manifest.contributions ?? {}).some((slot) => !targetSlots.has(slot));
      const invalidRequirement = Object.entries(extension.manifest.requires).some(([requirement, range]) => requirement.startsWith("profile:")
        ? requirement !== targetIdentity || !satisfiesSemver(targetProfile.manifest.version, range)
        : pruned.has(requirement) || !selected.has(requirement) || !satisfiesSemver(selected.get(requirement), range));
      const conflict = extension.manifest.conflicts.includes(targetIdentity) || targetProfile.manifest.conflicts.includes(identity);
      if (missingSlot || invalidRequirement || conflict) {
        pruned.add(identity);
        changed = true;
      }
    }
  }
  return [...pruned].sort();
}

async function addWithRequirements(starterRoot, proposed, identity, requestedIdentity, automatic, visiting = []) {
  const [kind, id] = identity.split(":");
  if (!new Set(["profile", "module", "adapter"]).has(kind) || !ID_PATTERN.test(id ?? "")) throw new CompositionError(`Invalid requirement identity: ${identity}.`);
  const selected = selectedIdentities(proposed);
  if (selected.has(identity)) return;
  if (visiting.includes(identity)) throw new CompositionError(`Extension requirement cycle: ${[...visiting, identity].join(" -> ")}.`);
  if (kind === "profile") throw new CompositionError(`${requestedIdentity} requires ${identity}, but the selected profile is profile:${proposed.project.profile}.`);

  const extension = await loadExtension(starterRoot, kind, id);
  for (const requirement of Object.keys(extension.manifest.requires)) {
    await addWithRequirements(starterRoot, proposed, requirement, requestedIdentity, automatic, [...visiting, identity]);
  }
  const target = kind === "module" ? proposed.modules : proposed.adapters;
  if (!target.includes(id)) {
    target.push(id);
    if (identity !== requestedIdentity) automatic.push(identity);
  }
}

export async function planCompositionChange(starterRoot, projectRoot, request) {
  const { action, kind, id } = request;
  if (!new Set(["add", "remove"]).has(action)) throw new CompositionError("Composition action must be add or remove.");
  assertKindAndId(kind, id);
  const resolvedProject = path.resolve(projectRoot);
  await assertCompositionReady(starterRoot, resolvedProject);

  const configPath = path.join(resolvedProject, "project.config.json");
  const currentConfig = await readJson(configPath);
  const proposed = structuredClone(currentConfig);
  const identity = `${kind}:${id}`;
  const selected = selectedIdentities(proposed);
  const automatic = [];

  if (action === "add") {
    if (selected.has(identity)) throw new CompositionError(`${identity} is already selected.`);
    await addWithRequirements(starterRoot, proposed, identity, identity, automatic);
  } else {
    if (!selected.has(identity)) throw new CompositionError(`${identity} is not selected.`);
    const resolved = await resolveConfiguration(starterRoot, currentConfig);
    const dependents = [resolved.profile, ...resolved.modules, ...resolved.adapters]
      .filter(({ manifest }) => Object.hasOwn(manifest.requires, identity))
      .map(({ manifest }) => `${manifest.kind}:${manifest.id}`)
      .sort();
    if (dependents.length) throw new CompositionError(`Cannot remove ${identity}; required by ${dependents.join(", ")}.`, "EXTENSION_REQUIRED", 1, { identity, dependents });
    const target = kind === "module" ? proposed.modules : proposed.adapters;
    proposed[kind === "module" ? "modules" : "adapters"] = target.filter((candidate) => candidate !== id);
  }

  await resolveConfiguration(starterRoot, proposed);
  const plan = await planProjectUpgrade(starterRoot, resolvedProject, { config: proposed, acknowledgements: request.acknowledgements ?? [] });
  plan.compositionChange = {
    action,
    requested: identity,
    automatic,
    before: { modules: currentConfig.modules, adapters: currentConfig.adapters },
    after: { modules: proposed.modules, adapters: proposed.adapters }
  };
  return plan;
}

export async function planProfileMigration(starterRoot, projectRoot, request) {
  const targetId = request.id;
  if (!ID_PATTERN.test(targetId ?? "")) throw new CompositionError("Profile id must be a lowercase kebab-case identifier.");
  const resolvedProject = path.resolve(projectRoot);
  await assertCompositionReady(starterRoot, resolvedProject);

  const currentConfig = await readJson(path.join(resolvedProject, "project.config.json"));
  if (currentConfig.project.profile === targetId) throw new CompositionError(`profile:${targetId} is already selected.`);

  const targetProfile = await loadExtension(starterRoot, "profile", targetId);
  const current = await resolveConfiguration(starterRoot, currentConfig);
  const proposed = structuredClone(currentConfig);
  proposed.project.profile = targetId;
  proposed.surfaces = [...targetProfile.manifest.surfaces];
  const automatic = [];
  for (const requirement of Object.keys(targetProfile.manifest.requires)) {
    await addWithRequirements(starterRoot, proposed, requirement, `profile:${targetId}`, automatic);
  }

  const extensions = [...current.modules, ...current.adapters];
  const targetSlots = await collectProfileSlots(path.join(targetProfile.root, targetProfile.manifest.files));
  const incompatible = findIncompatibleExtensions(extensions, targetProfile, targetSlots);
  if (incompatible.length && !request.pruneIncompatible) {
    throw new CompositionError(
      `Profile migration requires pruning incompatible extensions: ${incompatible.join(", ")}.`,
      "PROFILE_PRUNE_REQUIRED",
      2,
      { from: `profile:${currentConfig.project.profile}`, to: `profile:${targetId}`, incompatible }
    );
  }
  if (incompatible.length) {
    const remove = new Set(incompatible);
    proposed.modules = proposed.modules.filter((id) => !remove.has(`module:${id}`));
    proposed.adapters = proposed.adapters.filter((id) => !remove.has(`adapter:${id}`));
  }

  await resolveConfiguration(starterRoot, proposed);
  const plan = await planProjectUpgrade(starterRoot, resolvedProject, { config: proposed, acknowledgements: request.acknowledgements ?? [] });
  plan.profileMigration = {
    from: `profile:${currentConfig.project.profile}`,
    to: `profile:${targetId}`,
    automatic,
    incompatible,
    pruned: request.pruneIncompatible ? incompatible : [],
    surfaces: { before: currentConfig.surfaces, after: proposed.surfaces }
  };
  plan.compositionChange = { action: "switch-profile", requested: `profile:${targetId}`, automatic, before: { profile: currentConfig.project.profile, modules: currentConfig.modules, adapters: currentConfig.adapters }, after: { profile: targetId, modules: proposed.modules, adapters: proposed.adapters } };
  return plan;
}

export async function planPresetApplication(starterRoot, projectRoot, request) {
  const resolvedProject = path.resolve(projectRoot);
  await assertCompositionReady(starterRoot, resolvedProject);
  const currentConfig = await readJson(path.join(resolvedProject, "project.config.json"));
  const exact = await configurationFromPreset(starterRoot, request.preset, currentConfig.project);
  const proposed = request.prune ? exact : {
    ...structuredClone(currentConfig),
    project: { ...currentConfig.project, profile: exact.project.profile },
    surfaces: exact.surfaces,
    modules: [...new Set([...currentConfig.modules, ...exact.modules])],
    adapters: [...new Set([...currentConfig.adapters, ...exact.adapters])]
  };
  const requested = new Set([`profile:${exact.project.profile}`, ...Object.keys(request.preset.modules).map((id) => `module:${id}`), ...Object.keys(request.preset.adapters).map((id) => `adapter:${id}`)]);
  const automatic = [`profile:${exact.project.profile}`, ...exact.modules.map((id) => `module:${id}`), ...exact.adapters.map((id) => `adapter:${id}`)].filter((identity) => !requested.has(identity));

  if (!request.prune && currentConfig.project.profile !== exact.project.profile) {
    const current = await resolveConfiguration(starterRoot, currentConfig);
    const targetProfile = await loadExtension(starterRoot, "profile", exact.project.profile);
    const incompatible = findIncompatibleExtensions([...current.modules, ...current.adapters], targetProfile, await collectProfileSlots(path.join(targetProfile.root, targetProfile.manifest.files))).filter((identity) => !requested.has(identity));
    if (incompatible.length) throw new CompositionError(`Preset requires pruning incompatible extensions: ${incompatible.join(", ")}.`, "PRESET_PRUNE_REQUIRED", 2, { preset: request.preset.id, incompatible });
  }
  await resolveConfiguration(starterRoot, proposed);
  const plan = await planProjectUpgrade(starterRoot, resolvedProject, { config: proposed, acknowledgements: request.acknowledgements ?? [] });
  const before = selectedIdentities(currentConfig);
  const after = selectedIdentities(proposed);
  plan.presetChange = {
    id: request.preset.id,
    version: request.preset.version,
    lineage: request.preset.lineage,
    mode: request.prune ? "exact" : "additive",
    automatic,
    added: [...after].filter((identity) => !before.has(identity)).sort(),
    removed: [...before].filter((identity) => !after.has(identity)).sort()
  };
  plan.compositionChange = { action: "apply-preset", requested: `preset:${request.preset.id}`, automatic, before: { profile: currentConfig.project.profile, modules: currentConfig.modules, adapters: currentConfig.adapters }, after: { profile: proposed.project.profile, modules: proposed.modules, adapters: proposed.adapters } };
  return plan;
}
