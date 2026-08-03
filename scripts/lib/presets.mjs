import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadExtension, pathExists, readJson, resolveConfiguration } from "./configuration.mjs";
import { parseSemver, parseSemverRange, satisfiesSemver } from "./semver.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const KEYS = new Set(["$schema", "schemaVersion", "id", "version", "name", "description", "capabilities", "tags", "maturity", "extends", "profile", "modules", "adapters"]);

export class PresetError extends Error {
  constructor(message, code = "PRESET_INVALID", exitCode = 1, data) {
    super(message); this.code = code; this.exitCode = exitCode; this.data = data;
  }
}

function validateRawPreset(raw, expectedId) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) errors.push("preset must be an object");
  else {
    for (const key of Object.keys(raw)) if (!KEYS.has(key)) errors.push(`unknown property ${key}`);
    if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1");
    if (raw.id !== expectedId || !ID_PATTERN.test(raw.id ?? "")) errors.push(`id must match ${expectedId}`);
    try { parseSemver(raw.version); } catch { errors.push("version must be semantic MAJOR.MINOR.PATCH"); }
    if (typeof raw.name !== "string" || !raw.name.trim()) errors.push("name must be non-empty");
    if (typeof raw.description !== "string" || !raw.description.trim()) errors.push("description must be non-empty");
    for (const key of ["capabilities", "tags"]) if (!Array.isArray(raw[key]) || new Set(raw[key]).size !== raw[key].length || raw[key].some((value) => !ID_PATTERN.test(value))) errors.push(`${key} must contain unique identifiers`);
    if (!["experimental", "beta", "stable", "deprecated"].includes(raw.maturity)) errors.push("maturity is invalid");
    if (!Array.isArray(raw.extends) || new Set(raw.extends).size !== raw.extends.length || raw.extends.some((id) => !ID_PATTERN.test(id))) errors.push("extends must contain unique preset ids");
    if (raw.profile !== null && (!raw.profile || !ID_PATTERN.test(raw.profile.id ?? ""))) errors.push("profile must be null or an id/version object");
    if (raw.profile) try { parseSemverRange(raw.profile.version); } catch { errors.push("profile version range is invalid"); }
    for (const kind of ["modules", "adapters"]) {
      if (!raw[kind] || typeof raw[kind] !== "object" || Array.isArray(raw[kind])) errors.push(`${kind} must be an object`);
      else for (const [id, range] of Object.entries(raw[kind])) {
        if (!ID_PATTERN.test(id)) errors.push(`invalid ${kind} id ${id}`);
        try { parseSemverRange(range); } catch { errors.push(`invalid range for ${id}`); }
      }
    }
  }
  if (errors.length) throw new PresetError(`Invalid preset '${expectedId}':\n- ${errors.join("\n- ")}`);
}

export async function loadPreset(starterRoot, id, trail = []) {
  if (!ID_PATTERN.test(id ?? "")) throw new PresetError("Preset id must be lowercase kebab-case.");
  if (trail.includes(id)) throw new PresetError(`Preset inheritance cycle: ${[...trail, id].join(" -> ")}.`, "PRESET_CYCLE");
  const presetPath = path.join(starterRoot, "presets", `${id}.json`);
  if (!(await pathExists(presetPath))) throw new PresetError(`Unknown preset '${id}'.`, "PRESET_NOT_FOUND");
  const raw = await readJson(presetPath);
  validateRawPreset(raw, id);
  let profile = null;
  const modules = {};
  const adapters = {};
  const lineage = [];
  const capabilities = [];
  const tags = [];
  for (const parentId of raw.extends) {
    const parent = await loadPreset(starterRoot, parentId, [...trail, id]);
    if (profile && parent.profile && profile.id !== parent.profile.id) throw new PresetError(`Preset '${id}' inherits conflicting profiles.`);
    profile ??= parent.profile;
    Object.assign(modules, parent.modules);
    Object.assign(adapters, parent.adapters);
    for (const ancestor of parent.lineage) if (!lineage.includes(ancestor)) lineage.push(ancestor);
    for (const capability of parent.capabilities) if (!capabilities.includes(capability)) capabilities.push(capability);
    for (const tag of parent.tags) if (!tags.includes(tag)) tags.push(tag);
  }
  if (raw.profile) {
    if (profile && profile.id !== raw.profile.id) throw new PresetError(`Preset '${id}' replaces inherited profile ${profile.id}.`);
    profile = raw.profile;
  }
  Object.assign(modules, raw.modules);
  Object.assign(adapters, raw.adapters);
  for (const capability of raw.capabilities) if (!capabilities.includes(capability)) capabilities.push(capability);
  for (const tag of raw.tags) if (!tags.includes(tag)) tags.push(tag);
  if (!profile) throw new PresetError(`Preset '${id}' does not resolve a profile.`);
  lineage.push(id);
  return { id, version: raw.version, name: raw.name, description: raw.description, capabilities, tags, maturity: raw.maturity, profile, modules, adapters, lineage, presetPath };
}

export async function listPresets(starterRoot) {
  const root = path.join(starterRoot, "presets");
  const entries = await readdir(root, { withFileTypes: true });
  const results = [];
  for (const entry of entries) if (entry.isFile() && entry.name.endsWith(".json")) results.push(await loadPreset(starterRoot, entry.name.slice(0, -5)));
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

export async function configurationFromPreset(starterRoot, preset, project) {
  const config = { $schema: "./schemas/project-config.schema.json", schemaVersion: 1, project: { name: project.name, description: project.description, profile: preset.profile.id }, surfaces: [], modules: Object.keys(preset.modules), adapters: Object.keys(preset.adapters), verification: { required: true } };
  const profile = await loadExtension(starterRoot, "profile", preset.profile.id);
  config.surfaces = [...profile.manifest.surfaces];
  const visiting = new Set();
  async function addRequirements(identity) {
    if (visiting.has(identity)) throw new PresetError(`Extension requirement cycle while resolving preset ${preset.id}: ${identity}.`);
    visiting.add(identity);
    const [kind, id] = identity.split(":");
    if (kind === "profile") {
      if (id !== config.project.profile) throw new PresetError(`${identity} does not match preset profile:${config.project.profile}.`);
      visiting.delete(identity);
      return;
    }
    const extension = await loadExtension(starterRoot, kind, id);
    for (const requirement of Object.keys(extension.manifest.requires)) await addRequirements(requirement);
    const target = kind === "module" ? config.modules : config.adapters;
    if (!target.includes(id)) target.push(id);
    visiting.delete(identity);
  }
  for (const identity of [`profile:${preset.profile.id}`, ...config.modules.map((id) => `module:${id}`), ...config.adapters.map((id) => `adapter:${id}`)]) await addRequirements(identity);
  const resolved = await resolveConfiguration(starterRoot, config);
  if (!satisfiesSemver(resolved.profile.manifest.version, preset.profile.version)) throw new PresetError(`Preset ${preset.id} requires profile:${preset.profile.id}@${preset.profile.version}.`, "PRESET_VERSION_MISMATCH");
  for (const [id, range] of Object.entries(preset.modules)) if (!satisfiesSemver(resolved.extensionVersions[`module:${id}`], range)) throw new PresetError(`Preset ${preset.id} requires module:${id}@${range}.`, "PRESET_VERSION_MISMATCH");
  for (const [id, range] of Object.entries(preset.adapters)) if (!satisfiesSemver(resolved.extensionVersions[`adapter:${id}`], range)) throw new PresetError(`Preset ${preset.id} requires adapter:${id}@${range}.`, "PRESET_VERSION_MISMATCH");
  return config;
}
