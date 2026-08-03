import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readJson, resolveConfiguration, validateProjectConfig } from "../scripts/lib/configuration.mjs";

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
