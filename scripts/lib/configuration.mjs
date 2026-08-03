import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parseSemver, parseSemverRange, satisfiesSemver } from "./semver.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const EXTENSION_KINDS = ["profile", "module", "adapter"];
const QUALIFIED_EXTENSION_PATTERN = /^(profile|module|adapter):[a-z][a-z0-9-]*$/;

export async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON file ${filePath}: ${error.message}`);
  }
}

export function validateProjectConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["Configuration must be a JSON object."];
  }
  if (config.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!config.project || typeof config.project !== "object") {
    errors.push("project must be an object.");
  } else {
    if (!PROJECT_NAME_PATTERN.test(config.project.name ?? "")) {
      errors.push("project.name must be a lowercase kebab-case identifier with 2-63 characters.");
    }
    if (typeof config.project.description !== "string" || !config.project.description.trim()) {
      errors.push("project.description must be a non-empty string.");
    }
    if (!ID_PATTERN.test(config.project.profile ?? "")) {
      errors.push("project.profile must be a lowercase kebab-case identifier.");
    }
  }
  for (const key of ["surfaces", "modules", "adapters"]) {
    const values = config[key];
    if (!Array.isArray(values)) {
      errors.push(`${key} must be an array.`);
      continue;
    }
    if (new Set(values).size !== values.length) errors.push(`${key} must not contain duplicates.`);
    for (const value of values) {
      if (typeof value !== "string" || !ID_PATTERN.test(value)) {
        errors.push(`${key} contains invalid identifier: ${JSON.stringify(value)}.`);
      }
    }
  }
  if (typeof config.verification?.required !== "boolean") {
    errors.push("verification.required must be a boolean.");
  }
  return errors;
}

export function validateExtensionManifest(manifest, expectedKind, expectedId) {
  const errors = [];
  if (manifest.schemaVersion !== 2) errors.push("schemaVersion must be 2.");
  if (!EXTENSION_KINDS.includes(manifest.kind)) errors.push("kind must be profile, module, or adapter.");
  if (manifest.kind !== expectedKind) errors.push(`kind must be ${expectedKind}.`);
  if (manifest.id !== expectedId) errors.push(`id must match directory name ${expectedId}.`);
  if (!ID_PATTERN.test(manifest.id ?? "")) errors.push("id must be a lowercase kebab-case identifier.");
  for (const key of ["name", "description", "files"]) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) errors.push(`${key} must be a non-empty string.`);
  }
  for (const key of ["capabilities", "tags"]) {
    if (manifest[key] !== undefined && (!Array.isArray(manifest[key]) || new Set(manifest[key]).size !== manifest[key].length || manifest[key].some((value) => typeof value !== "string" || !ID_PATTERN.test(value)))) errors.push(`${key} must be a unique array of lowercase kebab-case identifiers.`);
  }
  if (manifest.maturity !== undefined && !["experimental", "beta", "stable", "deprecated"].includes(manifest.maturity)) errors.push("maturity must be experimental, beta, stable, or deprecated.");
  if (expectedKind === "profile") {
    if (manifest.surfaces !== undefined && (!Array.isArray(manifest.surfaces) || new Set(manifest.surfaces).size !== manifest.surfaces.length || manifest.surfaces.some((value) => typeof value !== "string" || !ID_PATTERN.test(value)))) {
      errors.push("profile surfaces must be a unique array of lowercase kebab-case identifiers.");
    }
  } else if (manifest.surfaces !== undefined) {
    errors.push("surfaces is supported only by profiles.");
  }
  try { parseSemver(manifest.version); } catch { errors.push("version must be a strict MAJOR.MINOR.PATCH semantic version."); }
  try { parseSemverRange(manifest.starter); } catch { errors.push("starter must be a supported semantic version range."); }
  if (!manifest.requires || typeof manifest.requires !== "object" || Array.isArray(manifest.requires)) {
    errors.push("requires must be an object of qualified extension ids and version ranges.");
  } else {
    for (const [requirement, range] of Object.entries(manifest.requires)) {
      if (!QUALIFIED_EXTENSION_PATTERN.test(requirement)) errors.push(`invalid requirement id: ${requirement}.`);
      try { parseSemverRange(range); } catch { errors.push(`invalid requirement range for ${requirement}.`); }
    }
  }
  if (!Array.isArray(manifest.conflicts) || manifest.conflicts.some((value) => !QUALIFIED_EXTENSION_PATTERN.test(value))) {
    errors.push("conflicts must be an array of qualified extension ids.");
  }
  if (manifest.migrations !== undefined) {
    if (!Array.isArray(manifest.migrations)) errors.push("migrations must be an array.");
    else for (const migration of manifest.migrations) {
      try { parseSemverRange(migration?.from); } catch { errors.push("migration.from must be a supported semantic version range."); }
      try { parseSemver(migration?.to); } catch { errors.push("migration.to must be a strict semantic version."); }
      if (migration?.to !== manifest.version) errors.push("migration.to must equal the manifest version.");
      if (typeof migration?.required !== "boolean") errors.push("migration.required must be a boolean.");
      if (typeof migration?.description !== "string" || !migration.description.trim() || /[\u0000-\u001f\u007f]/.test(migration.description)) errors.push("migration.description must be non-empty single-line text without control characters.");
    }
  }
  if (manifest.contributions !== undefined) {
    if (!manifest.contributions || typeof manifest.contributions !== "object" || Array.isArray(manifest.contributions)) {
      errors.push("contributions must be an object.");
    } else {
      for (const [slot, contributionPath] of Object.entries(manifest.contributions)) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(slot)) errors.push(`invalid contribution slot: ${slot}.`);
        if (typeof contributionPath !== "string" || !contributionPath.trim()) errors.push(`contribution ${slot} must reference a file.`);
      }
    }
  }
  if (manifest.packageDependencies !== undefined && (!manifest.packageDependencies || typeof manifest.packageDependencies !== "object" || Array.isArray(manifest.packageDependencies))) {
    errors.push("packageDependencies must be an object.");
  }
  return errors;
}

function catalogContext(root) {
  if (typeof root === "string") return { starterRoot: root, roots: [{ root, provenance: { source: "built-in" } }] };
  if (!root || typeof root.starterRoot !== "string" || !Array.isArray(root.roots) || !root.roots.length) throw new Error("Invalid lifecycle catalog context.");
  return root;
}

export async function loadExtension(root, kind, id) {
  const context = catalogContext(root);
  const folder = `${kind}s`;
  const manifestName = kind === "profile" ? "profile.json" : `${kind}.json`;
  let selected;
  for (const candidate of context.roots) {
    const extensionRoot = path.join(candidate.root, folder, id);
    const manifestPath = path.join(extensionRoot, manifestName);
    if (await pathExists(manifestPath)) {
      if (selected) throw new Error(`Ambiguous ${kind} '${id}' is provided by multiple catalog roots.`);
      selected = { extensionRoot, manifestPath, provenance: candidate.provenance };
    }
  }
  if (!selected) throw new Error(`Unknown ${kind} '${id}' in the lifecycle catalog.`);
  const { extensionRoot, manifestPath, provenance } = selected;
  const manifest = await readJson(manifestPath);
  if (kind === "profile" && manifest.surfaces === undefined) manifest.surfaces = [];
  const errors = validateExtensionManifest(manifest, kind, id);
  if (errors.length) throw new Error(`Invalid ${kind} '${id}':\n- ${errors.join("\n- ")}`);
  if (!(await pathExists(path.join(extensionRoot, manifest.files)))) {
    throw new Error(`Invalid ${kind} '${id}': files directory '${manifest.files}' does not exist.`);
  }
  for (const contributionPath of Object.values(manifest.contributions ?? {})) {
    if (!(await pathExists(path.join(extensionRoot, contributionPath)))) {
      throw new Error(`Invalid ${kind} '${id}': contribution file '${contributionPath}' does not exist.`);
    }
  }
  return { manifest, root: extensionRoot, provenance };
}

function assertAcyclicRequirements(extensions) {
  const graph = new Map(extensions.map(({ manifest }) => [`${manifest.kind}:${manifest.id}`, Object.keys(manifest.requires)]));
  const visiting = new Set();
  const visited = new Set();
  function visit(identity, trail) {
    if (visiting.has(identity)) throw new Error(`Extension requirement cycle: ${[...trail, identity].join(" -> ")}.`);
    if (visited.has(identity)) return;
    visiting.add(identity);
    for (const requirement of graph.get(identity) ?? []) visit(requirement, [...trail, identity]);
    visiting.delete(identity);
    visited.add(identity);
  }
  for (const identity of graph.keys()) visit(identity, []);
}

export async function resolveConfiguration(root, config) {
  const context = catalogContext(root);
  const configErrors = validateProjectConfig(config);
  if (configErrors.length) throw new Error(`Invalid project configuration:\n- ${configErrors.join("\n- ")}`);

  const profile = await loadExtension(context, "profile", config.project.profile);
  const modules = await Promise.all(config.modules.map((id) => loadExtension(context, "module", id)));
  const adapters = await Promise.all(config.adapters.map((id) => loadExtension(context, "adapter", id)));
  const starterPackage = await readJson(path.join(context.starterRoot, "package.json"));
  parseSemver(starterPackage.version);
  const extensions = [profile, ...modules, ...adapters];
  const selected = new Map(extensions.map(({ manifest }) => [`${manifest.kind}:${manifest.id}`, manifest.version]));

  for (const extension of extensions) {
    const identity = `${extension.manifest.kind}:${extension.manifest.id}`;
    if (!satisfiesSemver(starterPackage.version, extension.manifest.starter)) {
      throw new Error(`${identity}@${extension.manifest.version} does not support starter ${starterPackage.version}; expected ${extension.manifest.starter}.`);
    }
    for (const [requirement, range] of Object.entries(extension.manifest.requires)) {
      if (!selected.has(requirement)) throw new Error(`${identity} requires ${requirement}@${range}.`);
      if (!satisfiesSemver(selected.get(requirement), range)) {
        throw new Error(`${identity} requires ${requirement}@${range}, selected ${selected.get(requirement)}.`);
      }
    }
    for (const conflict of extension.manifest.conflicts) {
      if (selected.has(conflict)) throw new Error(`${identity} conflicts with ${conflict}.`);
    }
  }
  assertAcyclicRequirements(extensions);
  return { profile, modules, adapters, starterVersion: starterPackage.version, extensionVersions: Object.fromEntries(selected), extensionProvenance: Object.fromEntries(extensions.map(({ manifest, provenance }) => [`${manifest.kind}:${manifest.id}`, provenance])) };
}
