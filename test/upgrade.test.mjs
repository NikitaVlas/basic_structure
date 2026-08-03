import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { applyProjectUpgrade, planProjectUpgrade } from "../scripts/lib/upgrade.mjs";

const config = {
  schemaVersion: 1,
  project: { name: "upgrade-fixture", description: "Upgrade fixture", profile: "documentation-only" },
  surfaces: [], modules: [], adapters: [], verification: { required: true }
};

async function put(root, relative, content) {
  const destination = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

async function createStarter(root) {
  await put(root, "package.json", '{"name":"fixture-starter","version":"1.0.0"}\n');
  await put(root, "AGENTS.md", "agents-v1\n");
  await put(root, "AI-SETUP.md", "setup-v1\n");
  await put(root, "agent/rules.md", "user-owned-baseline\n");
  await put(root, "docs/guide.md", "guide-v1\n");
  await put(root, "tasks/template.md", "task-v1\n");
  await put(root, "scripts/check-docs.mjs", "export {};\n");
  await put(root, "scripts/lib/configuration.mjs", "export {};\n");
  await put(root, "scripts/lib/documentation.mjs", "export {};\n");
  await put(root, "profiles/documentation-only/template/retire.txt", "retire-v1\n");
  await put(root, "profiles/documentation-only/profile.json", `${JSON.stringify({
    schemaVersion: 1,
    kind: "profile",
    id: "documentation-only",
    name: "Documentation only",
    description: "Fixture profile",
    files: "template",
    requires: [],
    conflicts: []
  }, null, 2)}\n`);
}

async function withFixture(run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-upgrade-test-"));
  const starter = path.join(temporaryRoot, "starter");
  const project = path.join(temporaryRoot, "project");
  try {
    await createStarter(starter);
    await initializeProject(starter, project, config);
    await run({ temporaryRoot, starter, project });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("initializer records state v2 SHA-256 baselines", async () => {
  await withFixture(async ({ project }) => {
    const state = JSON.parse(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8"));
    assert.equal(state.schemaVersion, 2);
    assert.equal(state.starterVersion, "1.0.0");
    assert.ok(state.generatedFiles.every((entry) => entry.hashAlgorithm === "sha256" && /^[a-f0-9]{64}$/.test(entry.hash)));
  });
});

test("text baselines are stable across LF and CRLF checkouts", async () => {
  await withFixture(async ({ starter, project }) => {
    await writeFile(path.join(project, "AGENTS.md"), "agents-v1\r\n", "utf8");
    const plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.changes.find((entry) => entry.path === "AGENTS.md").status, "unchanged");
  });
});

test("plan is read-only and apply updates safe paths while preserving user edits", async () => {
  await withFixture(async ({ starter, project }) => {
    await put(project, "agent/rules.md", "user customization\n");
    await put(starter, "AGENTS.md", "agents-v2\n");
    await put(starter, "profiles/documentation-only/template/new.txt", "new-v2\n");
    const stateBefore = await readFile(path.join(project, ".basic-structure", "state.json"), "utf8");

    const plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.blocked, false);
    assert.equal(plan.changes.find((entry) => entry.path === "AGENTS.md").status, "safe-update");
    assert.equal(plan.changes.find((entry) => entry.path === "agent/rules.md").status, "user-modified");
    assert.equal(plan.changes.find((entry) => entry.path === "new.txt").status, "new");
    assert.equal(await readFile(path.join(project, "AGENTS.md"), "utf8"), "agents-v1\n");
    assert.equal(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8"), stateBefore);

    const result = await applyProjectUpgrade(plan);
    assert.equal(await readFile(path.join(project, "AGENTS.md"), "utf8"), "agents-v2\n");
    assert.equal(await readFile(path.join(project, "agent", "rules.md"), "utf8"), "user customization\n");
    assert.equal(await readFile(path.join(project, "new.txt"), "utf8"), "new-v2\n");
    assert.equal(await readFile(path.join(result.backupRoot, "AGENTS.md"), "utf8"), "agents-v1\n");
    const report = JSON.parse(await readFile(result.reportPath, "utf8"));
    assert.equal(report.status, "applied");
    assert.equal(report.plan.blocked, false);
  });
});

test("apply is blocked when user and starter changed the same file", async () => {
  await withFixture(async ({ starter, project }) => {
    await put(project, "AGENTS.md", "user-agents\n");
    await put(starter, "AGENTS.md", "agents-v2\n");
    const plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.blocked, true);
    assert.equal(plan.changes.find((entry) => entry.path === "AGENTS.md").status, "conflict");
    await assert.rejects(() => applyProjectUpgrade(plan), /blocked by conflicts/);
    assert.equal(await readFile(path.join(project, "AGENTS.md"), "utf8"), "user-agents\n");
  });
});

test("retired unmodified files are backed up and deleted", async () => {
  await withFixture(async ({ starter, project }) => {
    await unlink(path.join(starter, "profiles", "documentation-only", "template", "retire.txt"));
    const plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.changes.find((entry) => entry.path === "retire.txt").status, "safe-delete");
    const result = await applyProjectUpgrade(plan);
    await assert.rejects(() => readFile(path.join(project, "retire.txt")), /ENOENT/);
    assert.equal(await readFile(path.join(result.backupRoot, "retire.txt"), "utf8"), "retire-v1\n");
  });
});

test("modified retired files and legacy state differences fail closed", async () => {
  await withFixture(async ({ starter, project }) => {
    await put(project, "retire.txt", "user-retire\n");
    await unlink(path.join(starter, "profiles", "documentation-only", "template", "retire.txt"));
    let plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.changes.find((entry) => entry.path === "retire.txt").status, "conflict");

    const statePath = path.join(project, ".basic-structure", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    state.schemaVersion = 1;
    for (const entry of state.generatedFiles) {
      delete entry.hash;
      delete entry.hashAlgorithm;
    }
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
    plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.changes.find((entry) => entry.path === "retire.txt").status, "legacy-conflict");
  });
});

test("invalid managed paths and destination symlinks are rejected", async (t) => {
  await withFixture(async ({ temporaryRoot, starter, project }) => {
    const statePath = path.join(project, ".basic-structure", "state.json");
    const validState = JSON.parse(await readFile(statePath, "utf8"));
    const invalidState = structuredClone(validState);
    invalidState.generatedFiles[0].path = "../escape.txt";
    await writeFile(statePath, `${JSON.stringify(invalidState, null, 2)}\n`);
    await assert.rejects(() => planProjectUpgrade(starter, project), /Invalid managed path/);

    await writeFile(statePath, `${JSON.stringify(validState, null, 2)}\n`);
    const target = path.join(temporaryRoot, "outside.txt");
    await writeFile(target, "outside\n");
    await unlink(path.join(project, "AGENTS.md"));
    try {
      await symlink(target, path.join(project, "AGENTS.md"), "file");
    } catch (error) {
      if (error.code === "EPERM") {
        t.skip("Creating symlinks is not permitted on this Windows host.");
        return;
      }
      throw error;
    }
    await assert.rejects(() => planProjectUpgrade(starter, project), /symbolic link/);
  });
});
