import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadExtension, pathExists, resolveConfiguration } from "./configuration.mjs";
import { configurationFromPreset, listPresets, loadPreset } from "./presets.mjs";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export class CatalogError extends Error {
  constructor(message, code = "CATALOG_INVALID", exitCode = 1, data) { super(message); this.code = code; this.exitCode = exitCode; this.data = data; }
}

export async function listCatalogExtensions(starterRoot) {
  const entries = [];
  for (const kind of ["profile", "module", "adapter"]) {
    const parent = path.join(starterRoot, `${kind}s`);
    if (!(await pathExists(parent))) continue;
    for (const item of await readdir(parent, { withFileTypes: true })) if (item.isDirectory()) {
      const { manifest } = await loadExtension(starterRoot, kind, item.name);
      entries.push({ type: "extension", identity: `${kind}:${manifest.id}`, kind, id: manifest.id, version: manifest.version, name: manifest.name, description: manifest.description, capabilities: manifest.capabilities ?? [], tags: manifest.tags ?? [], maturity: manifest.maturity ?? "experimental", requires: manifest.requires, conflicts: manifest.conflicts });
    }
  }
  return entries.sort((a, b) => a.identity.localeCompare(b.identity));
}

async function enrichedPresets(starterRoot) {
  const results = [];
  for (const preset of await listPresets(starterRoot)) {
    const config = await configurationFromPreset(starterRoot, preset, { name: `${preset.id}-catalog`, description: preset.description });
    const resolved = await resolveConfiguration(starterRoot, config);
    const capabilities = new Set(preset.capabilities);
    for (const extension of [resolved.profile, ...resolved.modules, ...resolved.adapters]) for (const capability of extension.manifest.capabilities ?? []) capabilities.add(capability);
    results.push({ type: "preset", identity: `preset:${preset.id}`, id: preset.id, version: preset.version, name: preset.name, description: preset.description, capabilities: [...capabilities].sort(), tags: preset.tags, maturity: preset.maturity, profile: preset.profile, modules: preset.modules, adapters: preset.adapters, lineage: preset.lineage, extensionCount: 1 + config.modules.length + config.adapters.length });
  }
  return results;
}

export async function searchCatalog(starterRoot, query, options = {}) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) throw new CatalogError("Search query must be non-empty.");
  const entries = [...await listCatalogExtensions(starterRoot), ...await enrichedPresets(starterRoot)];
  return entries.filter((entry) => (!options.kind || entry.type === options.kind || entry.kind === options.kind) && [entry.identity, entry.name, entry.description, ...entry.capabilities, ...entry.tags].some((value) => value.toLowerCase().includes(needle)));
}

export async function inspectCatalogEntry(starterRoot, kind, id) {
  if (!ID_PATTERN.test(id ?? "")) throw new CatalogError("Catalog id must be lowercase kebab-case.");
  if (kind === "preset") return (await enrichedPresets(starterRoot)).find((entry) => entry.id === id) ?? Promise.reject(new CatalogError(`Unknown preset '${id}'.`, "CATALOG_NOT_FOUND"));
  if (!["profile", "module", "adapter"].includes(kind)) throw new CatalogError("Inspect kind must be profile, module, adapter, or preset.");
  return (await listCatalogExtensions(starterRoot)).find((entry) => entry.kind === kind && entry.id === id) ?? Promise.reject(new CatalogError(`Unknown ${kind} '${id}'.`, "CATALOG_NOT_FOUND"));
}

export async function recommendCapabilities(starterRoot, requested, options = {}) {
  const capabilities = [...new Set(requested)];
  if (!capabilities.length || capabilities.some((value) => !ID_PATTERN.test(value))) throw new CatalogError("At least one valid --capability is required.");
  const extensions = await listCatalogExtensions(starterRoot);
  const presets = await enrichedPresets(starterRoot);
  const presetMatches = presets.filter((preset) => (!options.profile || preset.profile.id === options.profile) && capabilities.every((capability) => preset.capabilities.includes(capability))).sort((a, b) => a.extensionCount - b.extensionCount || a.id.localeCompare(b.id));
  let profile = options.profile;
  if (!profile) profile = extensions.find((entry) => entry.kind === "profile" && capabilities.some((capability) => entry.capabilities.includes(capability)))?.id ?? presetMatches[0]?.profile.id ?? "fullstack-web";
  const profileEntry = extensions.find((entry) => entry.identity === `profile:${profile}`);
  if (!profileEntry) throw new CatalogError(`Unknown profile '${profile}'.`, "CATALOG_NOT_FOUND");
  const uncovered = new Set(capabilities.filter((capability) => !profileEntry.capabilities.includes(capability)));
  const selected = [];
  while (uncovered.size) {
    const candidates = extensions.filter((entry) => entry.kind !== "profile" && !selected.includes(entry) && entry.capabilities.some((capability) => uncovered.has(capability))).sort((a, b) => b.capabilities.filter((capability) => uncovered.has(capability)).length - a.capabilities.filter((capability) => uncovered.has(capability)).length || a.identity.localeCompare(b.identity));
    if (!candidates.length) break;
    selected.push(candidates[0]);
    for (const capability of candidates[0].capabilities) uncovered.delete(capability);
  }
  let composition = null;
  let compositionError = null;
  if (!uncovered.size) try {
    const synthetic = { id: "recommendation", version: "1.0.0", profile: { id: profile, version: ">=0.0.0" }, modules: Object.fromEntries(selected.filter((entry) => entry.kind === "module").map((entry) => [entry.id, ">=0.0.0"])), adapters: Object.fromEntries(selected.filter((entry) => entry.kind === "adapter").map((entry) => [entry.id, ">=0.0.0"])), lineage: ["recommendation"] };
    const config = await configurationFromPreset(starterRoot, synthetic, { name: "capability-recommendation", description: "Capability recommendation" });
    composition = { profile: config.project.profile, modules: config.modules, adapters: config.adapters, identities: [`profile:${config.project.profile}`, ...config.modules.map((id) => `module:${id}`), ...config.adapters.map((id) => `adapter:${id}`)] };
  } catch (error) { compositionError = error.message; }
  return { requested: capabilities, profile, covered: capabilities.filter((capability) => !uncovered.has(capability)), uncovered: [...uncovered], providers: selected.map((entry) => ({ identity: entry.identity, capabilities: entry.capabilities.filter((capability) => capabilities.includes(capability)), reason: `Provides ${entry.capabilities.filter((capability) => capabilities.includes(capability)).join(", ")}.` })), composition, compositionError, presetMatches: presetMatches.map(({ identity, version, description, extensionCount }) => ({ identity, version, description, extensionCount })) };
}

