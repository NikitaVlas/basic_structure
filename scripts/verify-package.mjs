#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-package-"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Package verification must run through npm so npm_execpath is available.");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true, timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout || result.error?.message}`);
  return result.stdout;
}

function runNpm(args, cwd) { return run(process.execPath, [npmCli, ...args], cwd); }

try {
  const preview = JSON.parse(runNpm(["pack", "--dry-run", "--json"], root))[0];
  const names = preview.files.map((entry) => entry.path);
  for (const required of ["bin/basic-structure.mjs", "scripts/lib/cli.mjs", "scripts/lib/adoption.mjs", "profiles/documentation-only/profile.json", "presets/saas.json", "policies/security-baseline.json", "schemas/extension-manifest.schema.json", "schemas/project-state.schema.json"]) {
    if (!names.includes(required)) throw new Error(`Package is missing required file: ${required}`);
  }
  const forbidden = names.filter((name) => /^(test|work|node_modules|\.git|coverage|dist)(\/|$)|(^|\/)\.basic-structure(\/|$)|(^|\/)\.env(?:\.local)?$/.test(name));
  if (forbidden.length) throw new Error(`Package contains forbidden files: ${forbidden.join(", ")}`);

  const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", temporaryRoot], root))[0];
  const tarball = path.join(temporaryRoot, packed.filename);
  const consumer = path.join(temporaryRoot, "consumer");
  await mkdir(consumer, { recursive: true });
  await writeFile(path.join(consumer, "package.json"), `${JSON.stringify({ name: "package-smoke", version: "1.0.0", private: true }, null, 2)}\n`, "utf8");
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);
  const installed = path.join(consumer, "node_modules", "@basic-structure", "cli");
  const bin = path.join(installed, "bin", "basic-structure.mjs");
  const version = JSON.parse(run(process.execPath, [bin, "version", "--json"], consumer));
  if (version.data.package.name !== "@basic-structure/cli" || !/^[a-f0-9]{64}$/.test(version.data.catalog.digest)) throw new Error("Installed package provenance is invalid.");
  JSON.parse(run(process.execPath, [bin, "list-presets", "--json"], consumer));
  const existing = path.join(consumer, "existing");
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, "package.json"), `${JSON.stringify({ name: "existing-package", version: "1.0.0", type: "module", exports: "./index.mjs", scripts: { verify: "node --check index.mjs" } }, null, 2)}\n`, "utf8");
  await writeFile(path.join(existing, "index.mjs"), "export const existing = true;\n", "utf8");
  const adoptionPlan = JSON.parse(run(process.execPath, [bin, "adopt", "--project", existing, "--plan", "--json"], consumer));
  if (adoptionPlan.data.profile !== "node-library" || adoptionPlan.data.mode !== "plan") throw new Error("Installed package adoption plan is invalid.");
  JSON.parse(run(process.execPath, [bin, "adopt", "--project", existing, "--apply", "--json"], consumer));
  const adoptedState = JSON.parse(await readFile(path.join(existing, ".basic-structure", "state.json"), "utf8"));
  if (adoptedState.schemaVersion !== 5 || adoptedState.adoption.mode !== "existing-project") throw new Error("Installed package adoption state is invalid.");
  const project = path.join(consumer, "generated");
  JSON.parse(run(process.execPath, [bin, "init", "--preset", "documentation", "--name", "package-smoke", "--output", project, "--json"], consumer));
  const gate = JSON.parse(run(process.execPath, [bin, "gate", "check", "--project", project, "--json"], consumer));
  if (!gate.data.compliant) throw new Error("Installed package gate smoke is not compliant.");
  const manifest = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
  console.log(`Package verification passed (${packed.filename}, ${names.length} files, ${manifest.name}@${manifest.version}).`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
