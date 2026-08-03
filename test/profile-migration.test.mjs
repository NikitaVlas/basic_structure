import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CompositionError, planProfileMigration } from "../scripts/lib/composition.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { applyProjectUpgrade } from "../scripts/lib/upgrade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documentationConfig = {
  schemaVersion: 1,
  project: { name: "profile-docs", description: "Profile migration fixture", profile: "documentation-only" },
  surfaces: [], modules: [], adapters: [], verification: { required: true }
};
const minimalFullstackConfig = {
  schemaVersion: 1,
  project: { name: "profile-app", description: "Profile migration fixture", profile: "fullstack-web" },
  surfaces: ["api", "webapp", "website"], modules: ["shared-contracts"], adapters: [], verification: { required: true }
};

async function fixture(config, run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-profile-"));
  const project = path.join(temporaryRoot, "project");
  try {
    await initializeProject(root, project, config);
    await run(project);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("profile migration plan is read-only and adds target requirements", async () => {
  await fixture(documentationConfig, async (project) => {
    const configPath = path.join(project, "project.config.json");
    const before = await readFile(configPath, "utf8");
    const plan = await planProfileMigration(root, project, { id: "fullstack-web" });
    assert.equal(plan.blocked, false);
    assert.deepEqual(plan.profileMigration.automatic, ["module:shared-contracts"]);
    assert.deepEqual(plan.profileMigration.surfaces.after, ["api", "webapp", "website"]);
    assert.ok(plan.changes.some((entry) => entry.path === "apps/api/src/server.ts" && entry.status === "new"));
    assert.equal(await readFile(configPath, "utf8"), before);
    await assert.rejects(() => planProfileMigration(root, project, { id: "documentation-only" }), (error) => error instanceof CompositionError && /already selected/.test(error.message));
  });
});

test("profile migration applies configuration files state and backup", async () => {
  await fixture(documentationConfig, async (project) => {
    const result = await applyProjectUpgrade(await planProfileMigration(root, project, { id: "fullstack-web" }));
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.equal(config.project.profile, "fullstack-web");
    assert.deepEqual(config.surfaces, ["api", "webapp", "website"]);
    assert.ok(config.modules.includes("shared-contracts"));
    assert.equal(JSON.parse(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8")).extensionVersions["profile:fullstack-web"], "1.0.0");
    assert.equal(JSON.parse(await readFile(path.join(result.backupRoot, "project.config.json"), "utf8")).project.profile, "documentation-only");
  });
});

test("incompatible extensions require explicit pruning", async () => {
  const fullConfig = JSON.parse(await readFile(path.join(root, "project.config.fullstack.example.json"), "utf8"));
  await fixture(fullConfig, async (project) => {
    await assert.rejects(
      () => planProfileMigration(root, project, { id: "documentation-only" }),
      (error) => error instanceof CompositionError && error.code === "PROFILE_PRUNE_REQUIRED" && error.data.incompatible.includes("module:e2e-playwright") && error.data.incompatible.includes("adapter:github-security")
    );
    const plan = await planProfileMigration(root, project, { id: "documentation-only", pruneIncompatible: true });
    assert.equal(plan.blocked, false);
    assert.ok(plan.profileMigration.pruned.includes("module:auth-session"));
    assert.ok(plan.profileMigration.pruned.includes("adapter:docker-production"));
    await applyProjectUpgrade(plan);
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.equal(config.project.profile, "documentation-only");
    assert.equal(config.modules.includes("shared-contracts"), true);
    assert.equal(config.modules.includes("auth-session"), false);
    assert.equal(config.adapters.includes("github-ci"), true);
  });
});

test("modified retired profile files block apply and failures roll back", async () => {
  await fixture(minimalFullstackConfig, async (project) => {
    const serverPath = path.join(project, "apps", "api", "src", "server.ts");
    await writeFile(serverPath, "user runtime\n", "utf8");
    const plan = await planProfileMigration(root, project, { id: "documentation-only" });
    assert.equal(plan.blocked, true);
    assert.equal(plan.changes.find((entry) => entry.path === "apps/api/src/server.ts").status, "conflict");
  });

  await fixture(documentationConfig, async (project) => {
    const configPath = path.join(project, "project.config.json");
    const before = await readFile(configPath, "utf8");
    const plan = await planProfileMigration(root, project, { id: "fullstack-web" });
    plan.desiredState.injectedFailure = 1n;
    await assert.rejects(() => applyProjectUpgrade(plan), /rolled back/);
    assert.equal(await readFile(configPath, "utf8"), before);
    await assert.rejects(() => readFile(path.join(project, "apps", "api", "src", "server.ts")), /ENOENT/);
  });
});

