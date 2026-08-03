import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CompositionError, planCompositionChange } from "../scripts/lib/composition.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { applyProjectUpgrade } from "../scripts/lib/upgrade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documentationConfig = {
  schemaVersion: 1,
  project: { name: "composition-docs", description: "Composition docs fixture", profile: "documentation-only" },
  surfaces: [], modules: [], adapters: [], verification: { required: true }
};
const minimalFullstackConfig = {
  schemaVersion: 1,
  project: { name: "composition-app", description: "Composition app fixture", profile: "fullstack-web" },
  surfaces: ["api", "webapp", "website"], modules: ["shared-contracts"], adapters: [], verification: { required: true }
};

async function fixture(config, run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-composition-"));
  const project = path.join(temporaryRoot, "project");
  try {
    await initializeProject(root, project, config);
    await run({ temporaryRoot, project });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("add recursively plans requirements without modifying the project", async () => {
  await fixture(minimalFullstackConfig, async ({ project }) => {
    const configPath = path.join(project, "project.config.json");
    const before = await readFile(configPath, "utf8");
    const plan = await planCompositionChange(root, project, { action: "add", kind: "module", id: "auth-session" });
    assert.equal(plan.blocked, false);
    assert.equal(plan.configChange.changed, true);
    assert.deepEqual(plan.compositionChange.automatic, [
      "module:database-postgres",
      "module:observability",
      "module:transactional-email",
      "module:rate-limit-valkey"
    ]);
    assert.equal(plan.extensionChanges.filter((entry) => entry.status === "added").length, 5);
    assert.ok(plan.changes.some((entry) => entry.path === "packages/auth/src/password.ts" && entry.status === "new"));
    assert.ok(plan.changes.some((entry) => entry.path === "apps/api/src/server.ts" && entry.status === "safe-update"));
    assert.equal(await readFile(configPath, "utf8"), before);
  });
});

test("composition apply updates config, contributions, state, and backup", async () => {
  await fixture(minimalFullstackConfig, async ({ project }) => {
    const plan = await planCompositionChange(root, project, { action: "add", kind: "module", id: "auth-session" });
    const result = await applyProjectUpgrade(plan);
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.ok(config.modules.includes("auth-session"));
    assert.ok(config.modules.includes("transactional-email"));
    assert.match(await readFile(path.join(project, "apps", "api", "src", "server.ts"), "utf8"), /handleAuthRequest/);
    assert.equal(JSON.parse(await readFile(path.join(project, ".basic-structure", "state.json"), "utf8")).extensionVersions["module:auth-session"], "1.0.0");
    assert.deepEqual(JSON.parse(await readFile(path.join(result.backupRoot, "project.config.json"), "utf8")).modules, ["shared-contracts"]);
    const report = JSON.parse(await readFile(result.reportPath, "utf8"));
    assert.equal(report.plan.compositionChange.requested, "module:auth-session");
  });
});

test("remove rejects selected dependents and modified retired files", async () => {
  await fixture(minimalFullstackConfig, async ({ project }) => {
    await applyProjectUpgrade(await planCompositionChange(root, project, { action: "add", kind: "module", id: "auth-session" }));
    await assert.rejects(
      () => planCompositionChange(root, project, { action: "remove", kind: "module", id: "database-postgres" }),
      (error) => error instanceof CompositionError && error.code === "EXTENSION_REQUIRED" && error.data.dependents.includes("module:auth-session")
    );

    await writeFile(path.join(project, "packages", "auth", "src", "password.ts"), "user-owned authentication\n", "utf8");
    const plan = await planCompositionChange(root, project, { action: "remove", kind: "module", id: "auth-session" });
    assert.equal(plan.blocked, true);
    assert.equal(plan.changes.find((entry) => entry.path === "packages/auth/src/password.ts").status, "conflict");
  });
});

test("remove deletes only owned unmodified output and recomposes shared files", async () => {
  await fixture(minimalFullstackConfig, async ({ project }) => {
    await applyProjectUpgrade(await planCompositionChange(root, project, { action: "add", kind: "module", id: "auth-session" }));
    const plan = await planCompositionChange(root, project, { action: "remove", kind: "module", id: "auth-session" });
    assert.equal(plan.blocked, false);
    assert.ok(plan.changes.some((entry) => entry.path === "packages/auth/src/password.ts" && entry.status === "safe-delete"));
    await applyProjectUpgrade(plan);
    const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
    assert.equal(config.modules.includes("auth-session"), false);
    await assert.rejects(() => readFile(path.join(project, "packages", "auth", "src", "password.ts")), /ENOENT/);
    assert.doesNotMatch(await readFile(path.join(project, "apps", "api", "src", "server.ts"), "utf8"), /handleAuthRequest/);
  });
});

test("occupied new paths and stale projects block composition", async () => {
  await fixture(minimalFullstackConfig, async ({ project }) => {
    const occupied = path.join(project, "packages", "auth", "src");
    await mkdir(occupied, { recursive: true });
    await writeFile(path.join(occupied, "password.ts"), "untracked user file\n", "utf8");
    let plan = await planCompositionChange(root, project, { action: "add", kind: "module", id: "auth-session" });
    assert.equal(plan.blocked, true);
    assert.equal(plan.changes.find((entry) => entry.path === "packages/auth/src/password.ts").status, "conflict");
  });

  await fixture(documentationConfig, async ({ project }) => {
    await rm(path.join(project, "AGENTS.md"));
    await assert.rejects(
      () => planCompositionChange(root, project, { action: "add", kind: "adapter", id: "github-ci" }),
      (error) => error instanceof CompositionError && error.code === "PROJECT_UPDATE_REQUIRED" && error.exitCode === 2
    );
  });
});

test("apply failure restores configuration, state, and newly created files", async () => {
  await fixture(documentationConfig, async ({ project }) => {
    const configPath = path.join(project, "project.config.json");
    const statePath = path.join(project, ".basic-structure", "state.json");
    const configBefore = await readFile(configPath, "utf8");
    const stateBefore = await readFile(statePath, "utf8");
    const plan = await planCompositionChange(root, project, { action: "add", kind: "adapter", id: "github-ci" });
    plan.desiredState.injectedFailure = 1n;
    await assert.rejects(() => applyProjectUpgrade(plan), /rolled back/);
    assert.equal(await readFile(configPath, "utf8"), configBefore);
    assert.equal(await readFile(statePath, "utf8"), stateBefore);
    await assert.rejects(() => readFile(path.join(project, ".github", "workflows", "verify.yml")), /ENOENT/);
  });
});

