import assert from "node:assert/strict";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkProjectPolicies, listPolicies } from "../scripts/lib/policies.mjs";
import { configurationFromPreset, loadPreset } from "../scripts/lib/presets.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function fixture(presetId, run) { const temp = await mkdtemp(path.join(os.tmpdir(), "basic-structure-policy-")); const project = path.join(temp, "project"); try { const preset = await loadPreset(root, presetId); await initializeProject(root, project, await configurationFromPreset(root, preset, { name: "policy-fixture", description: "Policy fixture" })); await run(project); } finally { await rm(temp, { recursive: true, force: true }); } }

test("policy catalog is deterministic and documentation project is compliant", async () => {
  assert.deepEqual((await listPolicies(root)).map((policy) => policy.id), ["ai-harness-readiness", "documentation-baseline", "production-readiness", "security-baseline", "seo-baseline", "verification-baseline"]);
  await fixture("documentation", async (project) => { const result = await checkProjectPolicies(root, project); assert.equal(result.compliant, true); assert.equal(result.results.find((entry) => entry.id === "ai-harness-readiness").status, "pass"); });
});

test("production composition passes applicable harness policies", async () => {
  await fixture("security-hardened", async (project) => { const result = await checkProjectPolicies(root, project); assert.equal(result.compliant, true); assert.equal(result.results.find((entry) => entry.id === "production-readiness").status, "pass"); });
});

test("missing regular-file evidence produces an explicit violation", async () => {
  await fixture("documentation", async (project) => { await unlink(path.join(project, "AGENTS.md")); const result = await checkProjectPolicies(root, project, { id: "documentation-baseline" }); assert.equal(result.compliant, false); assert.deepEqual(result.results[0].missingFiles, ["AGENTS.md"]); });
});
