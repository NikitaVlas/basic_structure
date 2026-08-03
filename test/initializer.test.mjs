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
    modules: ["shared-contracts", "observability", "database-postgres", "transactional-email", "rate-limit-valkey", "auth-session", "e2e-playwright"], adapters: [], verification: { required: true }
  };
  try {
    await initializeProject(root, output, fullstackConfig);
    const apiPackage = JSON.parse(await readFile(path.join(output, "apps", "api", "package.json"), "utf8"));
    const rootPackage = JSON.parse(await readFile(path.join(output, "package.json"), "utf8"));
    assert.equal(apiPackage.name, "@reference-saas/api");
    assert.equal(apiPackage.dependencies["@reference-saas/contracts"], "*");
    const contractsPackage = JSON.parse(await readFile(path.join(output, "packages", "contracts", "package.json"), "utf8"));
    assert.equal(contractsPackage.dependencies.zod, "^4.0.0");
    assert.match(await readFile(path.join(output, "apps", "webapp", "src", "main.tsx"), "utf8"), /Reference SaaS/);
    assert.match(await readFile(path.join(output, "apps", "website", "src", "pages", "index.astro"), "utf8"), /Reference SaaS/);
    assert.match(await readFile(path.join(output, "packages", "observability", "src", "index.ts"), "utf8"), /REDACTED/);
    assert.match(await readFile(path.join(output, "packages", "database", "migrations", "001_auth.sql"), "utf8"), /CREATE TABLE sessions/);
    assert.match(await readFile(path.join(output, "packages", "database", "migrations", "002_account_security.sql"), "utf8"), /CREATE TABLE account_tokens/);
    assert.match(await readFile(path.join(output, "packages", "database", "migrations", "003_transactional_email_outbox.sql"), "utf8"), /CREATE TABLE transactional_email_outbox/);
    assert.match(await readFile(path.join(output, "docker-compose.yml"), "utf8"), /postgres:18\.4-alpine/);
    const apiEnvironment = await readFile(path.join(output, "apps", "api", ".env.example"), "utf8");
    assert.match(apiEnvironment, /DATABASE_URL=/);
    assert.match(apiEnvironment, /APP_ORIGIN=/);
    assert.match(apiEnvironment, /EMAIL_TRANSPORT=console/);
    assert.match(apiEnvironment, /PUBLIC_APP_URL=/);
    assert.match(apiEnvironment, /RATE_LIMIT_BACKEND=memory/);
    assert.match(await readFile(path.join(output, "compose.rate-limit.yml"), "utf8"), /valkey\/valkey:9\.1\.1-alpine/);
    assert.match(await readFile(path.join(output, "compose.email.yml"), "utf8"), /axllent\/mailpit:v1\.30\.0/);
    assert.match(await readFile(path.join(output, "packages", "email", "src", "console.ts"), "utf8"), /transactional_email_captured/);
    const emailPackage = JSON.parse(await readFile(path.join(output, "packages", "email", "package.json"), "utf8"));
    assert.equal(emailPackage.dependencies.nodemailer, "^9.0.3");
    assert.equal(apiPackage.dependencies["@reference-saas/email"], "*");
    assert.match(rootPackage.scripts["email:worker"], /@reference-saas\/email/);
    assert.match(rootPackage.scripts["rate-limit:up"], /compose\.rate-limit\.yml/);
    assert.match(rootPackage.scripts["test:e2e"], /@reference-saas\/e2e/);
    assert.match(await readFile(path.join(output, "apps", "e2e", "playwright.config.ts"), "utf8"), /retain-on-failure/);
    assert.match(await readFile(path.join(output, ".github", "workflows", "e2e.yml"), "utf8"), /playwright install/);
    assert.match(await readFile(path.join(output, "apps", "api", "src", "server.ts"), "utf8"), /handleAuthRequest/);
    assert.match(await readFile(path.join(output, "packages", "auth", "src", "http.ts"), "utf8"), /password\/forgot/);
    assert.match(await readFile(path.join(output, "apps", "webapp", "src", "main.tsx"), "utf8"), /<AuthPanel \/>/);
    assert.match(await readFile(path.join(output, "apps", "webapp", "src", "auth", "AuthPanel.tsx"), "utf8"), /Active sessions/);
    assert.match(await readFile(path.join(output, "packages", "auth", "src", "password.ts"), "utf8"), /timingSafeEqual/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
