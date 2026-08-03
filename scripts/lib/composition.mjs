import path from "node:path";
import { loadExtension, readJson, resolveConfiguration } from "./configuration.mjs";
import { findUnfinishedUpgradeReports } from "./doctor.mjs";
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
  const unfinishedReports = await findUnfinishedUpgradeReports(resolvedProject);
  if (unfinishedReports.length) {
    throw new CompositionError(
      "Unfinished upgrade reports require review before changing composition.",
      "UNFINISHED_UPGRADE",
      2,
      { reports: unfinishedReports }
    );
  }
  const baseline = await planProjectUpgrade(starterRoot, resolvedProject);
  assertSynchronized(baseline);

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
