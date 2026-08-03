import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const EXTENSION_KINDS = ["profile", "module", "adapter"];

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
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!EXTENSION_KINDS.includes(manifest.kind)) errors.push("kind must be profile, module, or adapter.");
  if (manifest.kind !== expectedKind) errors.push(`kind must be ${expectedKind}.`);
  if (manifest.id !== expectedId) errors.push(`id must match directory name ${expectedId}.`);
  if (!ID_PATTERN.test(manifest.id ?? "")) errors.push("id must be a lowercase kebab-case identifier.");
  for (const key of ["name", "description", "files"]) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) errors.push(`${key} must be a non-empty string.`);
  }
  for (const key of ["requires", "conflicts"]) {
    if (!Array.isArray(manifest[key]) || manifest[key].some((value) => typeof value !== "string")) {
      errors.push(`${key} must be an array of strings.`);
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

export async function loadExtension(root, kind, id) {
  const folder = `${kind}s`;
  const manifestName = kind === "profile" ? "profile.json" : `${kind}.json`;
  const extensionRoot = path.join(root, folder, id);
  const manifestPath = path.join(extensionRoot, manifestName);
  if (!(await pathExists(manifestPath))) throw new Error(`Unknown ${kind} '${id}': ${manifestPath} does not exist.`);
  const manifest = await readJson(manifestPath);
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
  return { manifest, root: extensionRoot };
}

export async function resolveConfiguration(root, config) {
  const configErrors = validateProjectConfig(config);
  if (configErrors.length) throw new Error(`Invalid project configuration:\n- ${configErrors.join("\n- ")}`);

  const profile = await loadExtension(root, "profile", config.project.profile);
  const modules = await Promise.all(config.modules.map((id) => loadExtension(root, "module", id)));
  const adapters = await Promise.all(config.adapters.map((id) => loadExtension(root, "adapter", id)));
  const selected = new Set([
    `profile:${profile.manifest.id}`,
    ...modules.map(({ manifest }) => `module:${manifest.id}`),
    ...adapters.map(({ manifest }) => `adapter:${manifest.id}`)
  ]);

  for (const extension of [profile, ...modules, ...adapters]) {
    for (const requirement of extension.manifest.requires) {
      if (!selected.has(requirement)) throw new Error(`${extension.manifest.kind}:${extension.manifest.id} requires ${requirement}.`);
    }
    for (const conflict of extension.manifest.conflicts) {
      if (selected.has(conflict)) throw new Error(`${extension.manifest.kind}:${extension.manifest.id} conflicts with ${conflict}.`);
    }
  }
  return { profile, modules, adapters };
}
