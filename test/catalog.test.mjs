import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCatalogEntry, recommendCapabilities, searchCatalog } from "../scripts/lib/catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("catalog search covers extension and inherited preset metadata", async () => {
  const results = await searchCatalog(root, "authentication");
  assert.ok(results.some((entry) => entry.identity === "module:auth-session"));
  assert.ok(results.some((entry) => entry.identity === "preset:saas"));
  const presets = await searchCatalog(root, "production", { kind: "preset" });
  assert.ok(presets.length > 0 && presets.every((entry) => entry.type === "preset"));
});

test("catalog inspection exposes dependency and capability evidence", async () => {
  const extension = await inspectCatalogEntry(root, "module", "auth-session");
  assert.ok(extension.capabilities.includes("authentication"));
  assert.ok(Object.hasOwn(extension.requires, "module:database-postgres"));
  const preset = await inspectCatalogEntry(root, "preset", "saas");
  assert.ok(preset.capabilities.includes("postgresql"));
  assert.deepEqual(preset.lineage, ["fullstack-minimal", "saas"]);
});

test("recommendation returns deterministic providers dependencies and presets", async () => {
  const result = await recommendCapabilities(root, ["authentication", "database"], { profile: "fullstack-web" });
  assert.deepEqual(result.providers.map((entry) => entry.identity), ["module:auth-session", "module:database-postgres"]);
  assert.ok(result.composition.identities.includes("module:rate-limit-valkey"));
  assert.equal(result.presetMatches[0].identity, "preset:saas");
  assert.deepEqual(result.uncovered, []);

  const missing = await recommendCapabilities(root, ["quantum-computing"], { profile: "fullstack-web" });
  assert.deepEqual(missing.uncovered, ["quantum-computing"]);
  assert.equal(missing.composition, null);
});

