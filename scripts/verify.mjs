#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectDocumentation } from "./lib/documentation.mjs";
import { loadExtension, pathExists, readJson, resolveConfiguration } from "./lib/configuration.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function validateAllExtensions(starterRoot) {
  let count = 0;
  for (const kind of ["profile", "module", "adapter"]) {
    const parent = path.join(starterRoot, `${kind}s`);
    if (!(await pathExists(parent))) continue;
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      await loadExtension(starterRoot, kind, entry.name);
      count += 1;
    }
  }
  return count;
}

const starterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(option("--root", process.cwd()));
const mode = option("--mode", "project");

try {
  const documentation = await inspectDocumentation(root, { mode });
  if (documentation.findings.length) {
    for (const finding of documentation.findings) console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
    throw new Error(`Documentation verification failed with ${documentation.findings.length} finding(s).`);
  }

  let extensions = 0;
  if (mode === "template") {
    extensions = await validateAllExtensions(starterRoot);
    const example = await readJson(path.join(starterRoot, "project.config.example.json"));
    await resolveConfiguration(starterRoot, example);
  } else {
    const configPath = path.join(root, "project.config.json");
    if (!(await pathExists(configPath))) throw new Error(`Missing generated project configuration: ${configPath}`);
    await resolveConfiguration(starterRoot, await readJson(configPath));
  }

  console.log(`Verification passed (${documentation.filesChecked} docs, ${extensions} extensions, ${mode} mode).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
