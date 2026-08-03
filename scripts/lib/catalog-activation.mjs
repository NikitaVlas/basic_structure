import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJson } from "./configuration.mjs";
import { verifyCatalogBundleSignature } from "./catalog-bundles.mjs";
import { parseSemver } from "./semver.mjs";

const ID = /^[a-z][a-z0-9-]*$/;

export class CatalogActivationError extends Error {
  constructor(message, code = "CATALOG_ACTIVATION_INVALID", exitCode = 1, data) {
    super(message); this.code = code; this.exitCode = exitCode; this.data = data;
  }
}

function statePath(projectRoot) {
  return path.join(path.resolve(projectRoot), ".basic-structure", "catalogs", "active.json");
}

function cachedRoot(projectRoot, publisher, id, version) {
  return path.join(path.resolve(projectRoot), ".basic-structure", "catalogs", publisher, id, version);
}

function validateIdentity(publisher, id, version) {
  if (!ID.test(publisher ?? "") || !ID.test(id ?? "")) throw new CatalogActivationError("Publisher and catalog id must be lowercase kebab-case.");
  try { parseSemver(version); } catch { throw new CatalogActivationError("Catalog version must be semantic."); }
}

export async function readCatalogActivationState(projectRoot) {
  const file = statePath(projectRoot);
  if (!(await pathExists(file))) return { schemaVersion: 1, catalogs: [] };
  const state = await readJson(file);
  if (state.schemaVersion !== 1 || !Array.isArray(state.catalogs)) throw new CatalogActivationError("Invalid catalog activation state.", "CATALOG_ACTIVATION_STATE_INVALID");
  return state;
}

async function writeState(projectRoot, state) {
  const file = statePath(projectRoot);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, file);
}

export async function listActiveCatalogs(projectRoot) {
  return (await readCatalogActivationState(projectRoot)).catalogs;
}

export async function resolveActiveCatalogs(starterRoot, projectRoot) {
  const entries = await listActiveCatalogs(projectRoot);
  const resolved = [];
  for (const entry of entries) {
    const root = cachedRoot(projectRoot, entry.publisher, entry.id, entry.version);
    const verified = await verifyCatalogBundleSignature(starterRoot, projectRoot, root);
    if (verified.digest !== entry.digest || verified.keyId !== entry.keyId || verified.fingerprint !== entry.fingerprint || JSON.stringify(verified.identities) !== JSON.stringify(entry.identities)) {
      throw new CatalogActivationError(`Active catalog provenance changed: ${entry.publisher}/${entry.id}@${entry.version}.`, "CATALOG_ACTIVE_PROVENANCE_MISMATCH");
    }
    resolved.push({ ...entry, root, trust: "trusted" });
  }
  return resolved;
}

export async function createLifecycleCatalog(starterRoot, projectRoot) {
  const active = await resolveActiveCatalogs(starterRoot, projectRoot);
  return {
    starterRoot: path.resolve(starterRoot),
    projectRoot: path.resolve(projectRoot),
    roots: [
      { root: path.resolve(starterRoot), provenance: { source: "built-in" } },
      ...active.map((catalog) => ({ root: catalog.root, provenance: { source: "activated", publisher: catalog.publisher, catalog: catalog.id, catalogVersion: catalog.version, digest: catalog.digest, keyId: catalog.keyId, fingerprint: catalog.fingerprint, trust: catalog.trust } }))
    ]
  };
}

export async function activateCatalog(starterRoot, projectRoot, publisher, id, version, apply) {
  validateIdentity(publisher, id, version);
  const root = cachedRoot(projectRoot, publisher, id, version);
  if (!(await pathExists(root))) throw new CatalogActivationError("Installed catalog version was not found.", "CATALOG_NOT_INSTALLED");
  const verified = await verifyCatalogBundleSignature(starterRoot, projectRoot, root);
  const state = await readCatalogActivationState(projectRoot);
  const identity = `${publisher}/${id}@${version}`;
  if (state.catalogs.some((entry) => entry.publisher === publisher && entry.id === id && entry.version === version)) throw new CatalogActivationError("Catalog version is already active.", "CATALOG_ALREADY_ACTIVE");
  const claimed = new Set(state.catalogs.flatMap((entry) => entry.identities));
  const collisions = verified.identities.filter((entry) => claimed.has(entry));
  if (collisions.length) throw new CatalogActivationError(`Active catalog identity collision: ${collisions.join(", ")}.`, "CATALOG_ACTIVE_IDENTITY_COLLISION", 1, { collisions });
  const entry = { publisher, id, version, digest: verified.digest, keyId: verified.keyId, fingerprint: verified.fingerprint, identities: verified.identities, activatedAt: new Date().toISOString() };
  if (apply) {
    state.catalogs.push(entry);
    state.catalogs.sort((a, b) => `${a.publisher}/${a.id}/${a.version}`.localeCompare(`${b.publisher}/${b.id}/${b.version}`));
    await writeState(projectRoot, state);
  }
  return { identity, entry, applied: Boolean(apply) };
}

export async function deactivateCatalog(projectRoot, publisher, id, version, apply) {
  validateIdentity(publisher, id, version);
  const state = await readCatalogActivationState(projectRoot);
  const index = state.catalogs.findIndex((entry) => entry.publisher === publisher && entry.id === id && entry.version === version);
  if (index < 0) throw new CatalogActivationError("Active catalog version was not found.", "CATALOG_NOT_ACTIVE");
  const [entry] = state.catalogs.slice(index, index + 1);
  const generatedStateFile = path.join(path.resolve(projectRoot), ".basic-structure", "state.json");
  if (await pathExists(generatedStateFile)) {
    const generated = await readJson(generatedStateFile);
    const selected = Object.entries(generated.extensionProvenance ?? {}).filter(([, provenance]) => provenance?.source === "activated" && provenance.publisher === publisher && provenance.catalog === id && provenance.catalogVersion === version).map(([identity]) => identity).sort();
    if (selected.length) throw new CatalogActivationError(`Catalog is used by the generated project: ${selected.join(", ")}.`, "CATALOG_IN_USE", 1, { identities: selected });
  }
  if (apply) {
    state.catalogs.splice(index, 1);
    await writeState(projectRoot, state);
  }
  return { identity: `${publisher}/${id}@${version}`, entry, applied: Boolean(apply) };
}
