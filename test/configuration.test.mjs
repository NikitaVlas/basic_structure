import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readJson, resolveConfiguration, validateExtensionManifest, validateProjectConfig } from "../scripts/lib/configuration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("example configuration resolves its profile", async () => {
  const config = await readJson(path.join(root, "project.config.example.json"));
  const resolved = await resolveConfiguration(root, config);
  assert.equal(resolved.profile.manifest.id, "documentation-only");
});

test("configuration rejects duplicate modules", () => {
  const errors = validateProjectConfig({
    schemaVersion: 1,
    project: { name: "valid-project", description: "Valid", profile: "documentation-only" },
    surfaces: [],
    modules: ["auth", "auth"],
    adapters: [],
    verification: { required: true }
  });
  assert.ok(errors.includes("modules must not contain duplicates."));
});

test("configuration rejects invalid project names", () => {
  const errors = validateProjectConfig({
    schemaVersion: 1,
    project: { name: "Invalid Name", description: "Valid", profile: "documentation-only" },
    surfaces: [], modules: [], adapters: [], verification: { required: true }
  });
  assert.ok(errors.some((error) => error.startsWith("project.name")));
});

test("extension manifests reject unsafe contribution slot names", () => {
  const errors = validateExtensionManifest({
    schemaVersion: 2, kind: "module", id: "sample", version: "1.0.0", starter: "^0.1.0", name: "Sample", description: "Sample module", files: "template",
    requires: {}, conflicts: [], contributions: { "../../escape": "fragment.txt" }
  }, "module", "sample");
  assert.ok(errors.some((error) => error.includes("invalid contribution slot")));
});

test("extension manifests reject invalid version and migration metadata", () => {
  const errors = validateExtensionManifest({
    schemaVersion: 2, kind: "module", id: "sample", version: "v1", starter: "*", name: "Sample", description: "Sample module", files: "template",
    requires: { "bad identity": "latest" }, conflicts: [],
    migrations: [{ from: "*", to: "2.0.0", required: "yes", description: "" }]
  }, "module", "sample");
  assert.ok(errors.some((error) => error.startsWith("version must")));
  assert.ok(errors.some((error) => error.startsWith("starter must")));
  assert.ok(errors.some((error) => error.includes("invalid requirement id")));
  assert.ok(errors.some((error) => error.includes("migration.to must equal")));
  assert.ok(errors.some((error) => error.includes("migration.required")));
});
