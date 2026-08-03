import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkProjectDrift, checkProjectGate } from "../scripts/lib/gates.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { configurationFromPreset, loadPreset } from "../scripts/lib/presets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const probe = (command) => ({ available: true, version: `${command} test` });
async function fixture(run) { const temp = await mkdtemp(path.join(os.tmpdir(), "basic-structure-gate-")); const project = path.join(temp, "project"); try { const preset = await loadPreset(root, "documentation"); await initializeProject(root, project, await configurationFromPreset(root, preset, { name: "gate-fixture", description: "Gate fixture" })); await run(project); } finally { await rm(temp, { recursive: true, force: true }); } }

test("fresh generated project passes drift and unified gate", async () => {
  await fixture(async (project) => { assert.equal((await checkProjectDrift(root, project)).clean, true); const gate = await checkProjectGate(root, project, { probeExecutable: probe }); assert.equal(gate.compliant, true); assert.ok(gate.checks.every((entry) => ["pass", "skip"].includes(entry.status))); });
});

test("managed edits fail drift and policy gate with evidence", async () => {
  await fixture(async (project) => { await writeFile(path.join(project, "AGENTS.md"), "changed managed file\n", "utf8"); const drift = await checkProjectDrift(root, project); assert.equal(drift.clean, false); assert.equal(drift.changes.find((entry) => entry.path === "AGENTS.md").status, "user-modified"); const gate = await checkProjectGate(root, project, { probeExecutable: probe }); assert.equal(gate.compliant, false); assert.equal(gate.checks.find((entry) => entry.id === "drift").status, "fail"); });
});

