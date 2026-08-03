import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readJson } from "./configuration.mjs";

const CATALOG_ROOTS = ["profiles", "modules", "adapters", "presets", "policies", "schemas"];

async function catalogFiles(root, relative) {
  const absolute = path.join(root, relative);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw new Error(`Catalog provenance rejects symbolic links: ${relative}`);
  if (info.isFile()) return [relative.split(path.sep).join("/")];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) nested.push(...await catalogFiles(root, path.join(relative, entry.name)));
  return nested;
}

export async function calculateCatalogDigest(starterRoot) {
  const files = [];
  for (const root of CATALOG_ROOTS) files.push(...await catalogFiles(starterRoot, root));
  files.sort();
  const hash = createHash("sha256");
  for (const relative of files) {
    hash.update(relative); hash.update("\0"); hash.update(await readFile(path.join(starterRoot, relative))); hash.update("\0");
  }
  return { algorithm: "sha256", digest: hash.digest("hex"), files: files.length };
}

export async function getPackageProvenance(starterRoot) {
  const packageJson = await readJson(path.join(starterRoot, "package.json"));
  return {
    package: { name: packageJson.name, version: packageJson.version },
    catalog: await calculateCatalogDigest(starterRoot),
    schemas: { state: 3, extensionManifest: 2, projectConfig: 1, preset: 1, policy: 1, catalogBundle: 1 },
    node: packageJson.engines.node
  };
}
