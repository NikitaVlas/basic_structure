import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readJson } from "../scripts/lib/configuration.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("full-stack example bootstraps a coherent repository", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-bootstrap-"));
  const output = path.join(temporaryRoot, "generated");
  try {
    const config = await readJson(path.join(root, "project.config.fullstack.example.json"));
    const plan = await initializeProject(root, output, config);
    assert.ok(plan.files.length >= 50);

    const rootPackage = JSON.parse(await readFile(path.join(output, "package.json"), "utf8"));
    assert.deepEqual(rootPackage.workspaces, ["apps/*", "packages/*"]);
    assert.equal(rootPackage.scripts.verify, "npm run docs:check && npm run typecheck && npm run test && npm run build");
    assert.match(await readFile(path.join(output, "scripts", "check-docs.mjs"), "utf8"), /inspectDocumentation/);

    const workflow = await readFile(path.join(output, ".github", "workflows", "verify.yml"), "utf8");
    assert.match(workflow, /npm install --ignore-scripts/);
    assert.match(workflow, /npm run verify/);

    const state = JSON.parse(await readFile(path.join(output, ".basic-structure", "state.json"), "utf8"));
    assert.deepEqual(state.adapters, ["github-ci"]);
    assert.ok(state.generatedFiles.some((file) => file.owner === "adapter:github-ci"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
