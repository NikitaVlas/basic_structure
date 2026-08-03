import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { initializeProject, planInitialization } from "../scripts/lib/initializer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = {
  $schema: "./schemas/project-config.schema.json",
  schemaVersion: 1,
  project: { name: "generated-project", description: "Generated project description", profile: "documentation-only" },
  surfaces: [], modules: [], adapters: [], verification: { required: true }
};

test("initializer creates core documentation and state", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-"));
  const output = path.join(temporaryRoot, "output");
  try {
    await initializeProject(root, output, config);
    assert.match(await readFile(path.join(output, "AGENTS.md"), "utf8"), /Agent instructions/);
    const generatedConfig = JSON.parse(await readFile(path.join(output, "project.config.json"), "utf8"));
    assert.equal(generatedConfig.project.name, "generated-project");
    const state = JSON.parse(await readFile(path.join(output, ".basic-structure", "state.json"), "utf8"));
    assert.equal(state.profile, "documentation-only");
    assert.ok(state.generatedFiles.some((file) => file.path === "AGENTS.md"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("initializer refuses a non-empty output directory", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-"));
  try {
    await mkdir(path.join(temporaryRoot, "output"));
    await writeFile(path.join(temporaryRoot, "output", "owned.txt"), "user data");
    await assert.rejects(
      () => planInitialization(root, path.join(temporaryRoot, "output"), config),
      /must be empty/
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("dry run does not create the output directory", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-"));
  const output = path.join(temporaryRoot, "output");
  try {
    const plan = await initializeProject(root, output, config, { dryRun: true });
    assert.ok(plan.files.length > 0);
    await assert.rejects(() => readFile(path.join(output, "AGENTS.md"), "utf8"), /ENOENT/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("full-stack profile composes required modules and renders package names", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-"));
  const output = path.join(temporaryRoot, "output");
  const fullstackConfig = {
    schemaVersion: 1,
    project: { name: "reference-saas", description: "Reference SaaS", profile: "fullstack-web" },
    surfaces: ["api", "webapp", "website"],
    modules: ["shared-contracts", "observability", "database-postgres", "auth-session"], adapters: [], verification: { required: true }
  };
  try {
    await initializeProject(root, output, fullstackConfig);
    const apiPackage = JSON.parse(await readFile(path.join(output, "apps", "api", "package.json"), "utf8"));
    assert.equal(apiPackage.name, "@reference-saas/api");
    assert.equal(apiPackage.dependencies["@reference-saas/contracts"], "*");
    const contractsPackage = JSON.parse(await readFile(path.join(output, "packages", "contracts", "package.json"), "utf8"));
    assert.equal(contractsPackage.dependencies.zod, "^4.0.0");
    assert.match(await readFile(path.join(output, "apps", "webapp", "src", "main.tsx"), "utf8"), /Reference SaaS/);
    assert.match(await readFile(path.join(output, "apps", "website", "src", "pages", "index.astro"), "utf8"), /Reference SaaS/);
    assert.match(await readFile(path.join(output, "packages", "observability", "src", "index.ts"), "utf8"), /REDACTED/);
    assert.match(await readFile(path.join(output, "packages", "database", "migrations", "001_auth.sql"), "utf8"), /CREATE TABLE sessions/);
    assert.match(await readFile(path.join(output, "docker-compose.yml"), "utf8"), /postgres:18\.4-alpine/);
    const apiEnvironment = await readFile(path.join(output, "apps", "api", ".env.example"), "utf8");
    assert.match(apiEnvironment, /DATABASE_URL=/);
    assert.match(apiEnvironment, /APP_ORIGIN=/);
    assert.match(await readFile(path.join(output, "apps", "api", "src", "server.ts"), "utf8"), /handleAuthRequest/);
    assert.match(await readFile(path.join(output, "apps", "webapp", "src", "main.tsx"), "utf8"), /<AuthPanel \/>/);
    assert.match(await readFile(path.join(output, "packages", "auth", "src", "password.ts"), "utf8"), /timingSafeEqual/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
