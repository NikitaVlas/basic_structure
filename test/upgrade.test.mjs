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
    schemaVersion: 2,
    kind: "profile",
    id: "documentation-only",
    version: "1.0.0",
    starter: ">=1.0.0 <2.0.0",
    name: "Documentation only",
    description: "Fixture profile",
    files: "template",
    requires: {},
    conflicts: []
  }, null, 2)}\n`);
}

async function updateFixtureManifest(starter, update) {
  const manifestPath = path.join(starter, "profiles", "documentation-only", "profile.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  update(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
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

test("initializer records state v4 versions provenance and SHA-256 baselines", async () => {
  await withFixture(async ({ project }) => {
    const state = JSON.parse(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8"));
    assert.equal(state.schemaVersion, 4);
    assert.deepEqual(state.extensionProvenance["profile:documentation-only"], { source: "built-in" });
    assert.equal(state.starterVersion, "1.0.0");
    assert.equal(state.extensionVersions["profile:documentation-only"], "1.0.0");
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

test("state v2 adopts extension version baselines without weakening file checks", async () => {
  await withFixture(async ({ starter, project }) => {
    const statePath = path.join(project, ".basic-structure", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    state.schemaVersion = 2;
    delete state.extensionVersions;
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    const plan = await planProjectUpgrade(starter, project);
    assert.equal(plan.blocked, false);
    assert.equal(plan.extensionChanges[0].status, "baseline-adoption");
    assert.ok(plan.changes.every((entry) => entry.status === "unchanged"));
  });
});

test("state v3 rejects extension version sets that do not match composition", async () => {
  await withFixture(async ({ starter, project }) => {
    const statePath = path.join(project, ".basic-structure", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    delete state.extensionVersions["profile:documentation-only"];
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await assert.rejects(() => planProjectUpgrade(starter, project), /must exactly match/);
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

test("compatible extension upgrades advance state without migration acknowledgement", async () => {
  await withFixture(async ({ starter, project }) => {
    await updateFixtureManifest(starter, (manifest) => { manifest.version = "1.1.0"; });
    const plan = await planProjectUpgrade(starter, project);
    const versionChange = plan.extensionChanges.find((entry) => entry.identity === "profile:documentation-only");
    assert.equal(versionChange.status, "compatible");
    assert.equal(plan.blocked, false);
    await applyProjectUpgrade(plan);
    const state = JSON.parse(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8"));
    assert.equal(state.extensionVersions["profile:documentation-only"], "1.1.0");
  });
});

test("breaking extension upgrades require exact acknowledgement and downgrades stay blocked", async () => {
  await withFixture(async ({ starter, project }) => {
    await updateFixtureManifest(starter, (manifest) => {
      manifest.version = "2.0.0";
      manifest.migrations = [{ from: "^1.0.0", to: "2.0.0", required: true, description: "Review the renamed profile contract." }];
    });
    let plan = await planProjectUpgrade(starter, project);
    let versionChange = plan.extensionChanges.find((entry) => entry.identity === "profile:documentation-only");
    assert.equal(versionChange.status, "migration-required");
    assert.equal(versionChange.acknowledged, false);
    assert.match(versionChange.notices[0].description, /renamed profile/);
    assert.equal(plan.blocked, true);

    plan = await planProjectUpgrade(starter, project, { acknowledgements: ["profile:documentation-only"] });
    versionChange = plan.extensionChanges.find((entry) => entry.identity === "profile:documentation-only");
    assert.equal(versionChange.acknowledged, true);
    assert.equal(plan.blocked, false);
    await applyProjectUpgrade(plan);

    await updateFixtureManifest(starter, (manifest) => {
      manifest.version = "1.5.0";
      delete manifest.migrations;
    });
    plan = await planProjectUpgrade(starter, project, { acknowledgements: ["profile:documentation-only"] });
    versionChange = plan.extensionChanges.find((entry) => entry.identity === "profile:documentation-only");
    assert.equal(versionChange.status, "downgrade-blocked");
    assert.equal(plan.blocked, true);
  });
});

test("versioned requirements reject missing extensions", async () => {
  await withFixture(async ({ temporaryRoot, starter }) => {
    await updateFixtureManifest(starter, (manifest) => { manifest.requires = { "module:missing": "^1.0.0" }; });
    await assert.rejects(
      () => initializeProject(starter, path.join(temporaryRoot, "invalid-project"), config),
      /requires module:missing@\^1\.0\.0/
    );
  });
});

test("starter and selected extension version incompatibilities fail before generation", async () => {
  await withFixture(async ({ temporaryRoot, starter }) => {
    await updateFixtureManifest(starter, (manifest) => { manifest.starter = ">=2.0.0 <3.0.0"; });
    await assert.rejects(
      () => initializeProject(starter, path.join(temporaryRoot, "unsupported-starter"), config),
      /does not support starter 1\.0\.0/
    );

    await updateFixtureManifest(starter, (manifest) => {
      manifest.starter = ">=1.0.0 <2.0.0";
      manifest.requires = { "module:sample": "^2.0.0" };
    });
    await put(starter, "modules/sample/template/sample.txt", "sample\n");
    await put(starter, "modules/sample/module.json", `${JSON.stringify({
      schemaVersion: 2, kind: "module", id: "sample", version: "1.0.0", starter: "^1.0.0",
      name: "Sample", description: "Sample module", files: "template", requires: {}, conflicts: []
    }, null, 2)}\n`);
    const selectedConfig = { ...config, modules: ["sample"] };
    await assert.rejects(
      () => initializeProject(starter, path.join(temporaryRoot, "incompatible-requirement"), selectedConfig),
      /requires module:sample@\^2\.0\.0, selected 1\.0\.0/
    );

    await updateFixtureManifest(starter, (manifest) => { manifest.requires = { "module:sample": "^1.0.0" }; });
    const modulePath = path.join(starter, "modules", "sample", "module.json");
    const moduleManifest = JSON.parse(await readFile(modulePath, "utf8"));
    moduleManifest.requires = { "profile:documentation-only": "^1.0.0" };
    await writeFile(modulePath, `${JSON.stringify(moduleManifest, null, 2)}\n`, "utf8");
    await assert.rejects(
      () => initializeProject(starter, path.join(temporaryRoot, "requirement-cycle"), selectedConfig),
      /Extension requirement cycle/
    );
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
    delete state.extensionVersions;
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
