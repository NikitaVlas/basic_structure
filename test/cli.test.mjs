import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../scripts/lib/cli.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sink() {
  let content = "";
  return { stream: { write(value) { content += value; } }, read() { return content; } };
}

async function invoke(argv, options = {}) {
  const stdout = sink();
  const stderr = sink();
  const exitCode = await runCli({ argv, cwd: options.cwd ?? root, starterRoot: root, stdout: stdout.stream, stderr: stderr.stream, probeExecutable: options.probeExecutable });
  return { exitCode, stdout: stdout.read(), stderr: stderr.read() };
}

async function initializeFixture(temporaryRoot) {
  const output = path.join(temporaryRoot, "generated");
  const result = await invoke(["init", "--config", "project.config.example.json", "--output", output, "--json"]);
  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
  return output;
}

test("CLI root and command help are stable", async () => {
  let result = await invoke(["--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /basic-structure <command>/);
  result = await invoke(["help", "update", "--json"]);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.topic, "update");
  assert.match(envelope.data.text, /--acknowledge-migration/);
});

test("CLI JSON validate and list commands expose versioned data", async () => {
  let result = await invoke(["validate", "--config", "project.config.fullstack.example.json", "--json"]);
  assert.equal(result.exitCode, 0);
  let envelope = JSON.parse(result.stdout);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.command, "validate");
  assert.equal(envelope.data.extensionVersions["module:auth-session"], "1.0.0");
  assert.equal(result.stdout.trim().split(/\r?\n/).length, 1);

  result = await invoke(["list", "--kind", "adapter", "--json"]);
  envelope = JSON.parse(result.stdout);
  assert.equal(envelope.data.extensions.length, 3);
  assert.ok(envelope.data.extensions.every((entry) => entry.kind === "adapter" && entry.version === "1.0.0"));
});

test("CLI init dry-run and write modes preserve initializer behavior", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-cli-"));
  try {
    const preview = path.join(temporaryRoot, "preview");
    let result = await invoke(["init", "--config", "project.config.example.json", "--output", preview, "--dry-run", "--json"]);
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(result.stdout).data.dryRun, true);
    await assert.rejects(() => readFile(path.join(preview, "project.config.json")), /ENOENT/);

    const output = await initializeFixture(temporaryRoot);
    const state = JSON.parse(await readFile(path.join(output, ".basic-structure", "state.json"), "utf8"));
    assert.equal(state.schemaVersion, 3);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("CLI update reports clean plans and blocked state with exit code 2", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-cli-"));
  try {
    const output = await initializeFixture(temporaryRoot);
    let result = await invoke(["update", "--project", output, "--plan", "--json"]);
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(result.stdout).data.blocked, false);

    result = await invoke(["update", "--project", output, "--apply", "--json"]);
    let envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 0);
    assert.equal(envelope.data.mode, "apply");
    assert.ok(envelope.data.result.reportPath.endsWith(".json"));

    await unlink(path.join(output, "AGENTS.md"));
    result = await invoke(["update", "--project", output, "--plan", "--json"]);
    envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 2);
    assert.equal(envelope.error.code, "UPGRADE_BLOCKED");
    assert.equal(envelope.data.blocked, true);

    result = await invoke(["update", "--project", output, "--plan"]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /CONFLICT AGENTS\.md/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("CLI add and remove preserve plan-first composition behavior", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-cli-"));
  try {
    const output = await initializeFixture(temporaryRoot);
    const configPath = path.join(output, "project.config.json");
    const before = await readFile(configPath, "utf8");
    let result = await invoke(["add", "adapter", "github-ci", "--project", output, "--plan", "--json"]);
    let envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 0);
    assert.equal(envelope.data.compositionChange.requested, "adapter:github-ci");
    assert.equal(await readFile(configPath, "utf8"), before);

    result = await invoke(["add", "adapter", "github-ci", "--project", output, "--apply", "--json"]);
    envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).adapters.includes("github-ci"), true);
    assert.match(await readFile(path.join(output, ".github", "workflows", "verify.yml"), "utf8"), /npm run verify/);

    result = await invoke(["remove", "adapter", "github-ci", "--project", output, "--plan", "--json"]);
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(result.stdout).data.fileSummary["safe-delete"] > 0, true);
    result = await invoke(["remove", "adapter", "github-ci", "--project", output, "--apply", "--json"]);
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).adapters.includes("github-ci"), false);
    await assert.rejects(() => readFile(path.join(output, ".github", "workflows", "verify.yml")), /ENOENT/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("doctor requires Docker only when the production adapter is selected", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-cli-"));
  try {
    const output = path.join(temporaryRoot, "fullstack");
    const initialized = await invoke(["init", "--config", "project.config.fullstack.example.json", "--output", output, "--json"]);
    assert.equal(initialized.exitCode, 0, initialized.stdout);
    const calls = [];
    const probeExecutable = (command) => {
      calls.push(command);
      return command === "git" ? { available: true, version: "git test" } : { available: false, message: "docker unavailable" };
    };
    const result = await invoke(["doctor", "--project", output, "--json"], { probeExecutable });
    const envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 3);
    assert.deepEqual(calls, ["git", "docker"]);
    assert.equal(envelope.data.checks.find((entry) => entry.id === "docker").status, "fail");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("doctor is read-only and distinguishes healthy and unhealthy probes", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-cli-"));
  try {
    const output = await initializeFixture(temporaryRoot);
    const statePath = path.join(output, ".basic-structure", "state.json");
    const before = await readFile(statePath, "utf8");
    const available = (command) => ({ available: true, version: `${command} test-version` });
    let result = await invoke(["doctor", "--project", output, "--json"], { probeExecutable: available });
    assert.equal(result.exitCode, 0, result.stdout);
    let envelope = JSON.parse(result.stdout);
    assert.equal(envelope.data.healthy, true);
    assert.equal(envelope.data.checks.find((entry) => entry.id === "docker").status, "skip");
    assert.equal(await readFile(statePath, "utf8"), before);

    result = await invoke(["doctor", "--project", output, "--json"], { probeExecutable: () => ({ available: false, message: "not found" }) });
    envelope = JSON.parse(result.stdout);
    assert.equal(result.exitCode, 3);
    assert.equal(envelope.error.code, "DOCTOR_UNHEALTHY");
    assert.equal(envelope.data.checks.find((entry) => entry.id === "git").status, "fail");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("CLI invalid input uses the shared error envelope", async () => {
  const result = await invoke(["list", "--kind", "unknown", "--json"]);
  const envelope = JSON.parse(result.stdout);
  assert.equal(result.exitCode, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "INVALID_REQUEST");
  assert.equal(result.stderr, "");
});

test("package bin entry point executes without a shell", () => {
  const result = spawnSync(process.execPath, [path.join(root, "bin", "basic-structure.mjs"), "list", "--kind", "profile", "--json"], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.data.extensions.length, 2);
});
