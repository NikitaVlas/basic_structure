import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planPresetApplication } from "../scripts/lib/composition.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { configurationFromPreset, listPresets, loadPreset } from "../scripts/lib/presets.mjs";
import { applyProjectUpgrade, planProjectUpgrade } from "../scripts/lib/upgrade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(config, run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-preset-"));
  const project = path.join(temporaryRoot, "project");
  try { await initializeProject(root, project, config); await run(project); }
  finally { await rm(temporaryRoot, { recursive: true, force: true }); }
}

test("preset inheritance resolves deterministic catalog and semantic constraints", async () => {
  const presets = await listPresets(root);
  assert.deepEqual(presets.map((preset) => preset.id), ["backend-service", "documentation", "frontend-app", "fullstack-complete", "fullstack-minimal", "node-library", "production", "saas", "security-hardened"]);
  const complete = await loadPreset(root, "fullstack-complete");
  assert.deepEqual(complete.lineage, ["fullstack-minimal", "saas", "production", "security-hardened", "fullstack-complete"]);
  assert.equal(complete.modules["auth-session"], "^1.0.0");
  assert.equal(complete.adapters["github-security"], "^1.0.0");
});

test("preset configuration recursively adds extension requirements", async () => {
  const preset = { id: "requirements-test", version: "1.0.0", profile: { id: "fullstack-web", version: "^1.0.0" }, modules: { "auth-session": "^1.0.0" }, adapters: {}, lineage: ["requirements-test"] };
  const config = await configurationFromPreset(root, preset, { name: "preset-requirements", description: "Preset requirements fixture" });
  assert.ok(config.modules.includes("shared-contracts"));
  assert.ok(config.modules.includes("database-postgres"));
  assert.ok(config.modules.includes("transactional-email"));
  assert.ok(config.modules.includes("rate-limit-valkey"));
});

test("additive preset application preserves compatible selections", async () => {
  const docs = await configurationFromPreset(root, await loadPreset(root, "documentation"), { name: "preset-additive", description: "Preset additive fixture" });
  await fixture(docs, async (project) => {
    const plan = await planPresetApplication(root, project, { preset: await loadPreset(root, "saas") });
    assert.equal(plan.presetChange.mode, "additive");
    assert.ok(plan.presetChange.added.includes("module:auth-session"));
    await applyProjectUpgrade(plan);
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.equal(config.project.profile, "fullstack-web");
    assert.ok(config.modules.includes("auth-session"));
    assert.equal((await planProjectUpgrade(root, project)).blocked, false);
  });
});

test("exact preset pruning removes extras transactionally", async () => {
  const complete = await configurationFromPreset(root, await loadPreset(root, "fullstack-complete"), { name: "preset-prune", description: "Preset prune fixture" });
  await fixture(complete, async (project) => {
    const minimal = await loadPreset(root, "fullstack-minimal");
    const additive = await planPresetApplication(root, project, { preset: minimal });
    assert.deepEqual(additive.presetChange.removed, []);
    const exact = await planPresetApplication(root, project, { preset: minimal, prune: true });
    assert.ok(exact.presetChange.removed.includes("module:auth-session"));
    assert.ok(exact.presetChange.removed.includes("adapter:github-security"));
    await applyProjectUpgrade(exact);
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.deepEqual(config.modules, ["shared-contracts"]);
    assert.deepEqual(config.adapters, []);
  });
});
