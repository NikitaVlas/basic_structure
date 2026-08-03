#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./lib/configuration.mjs";
import { initializeProject } from "./lib/initializer.mjs";

function parseArguments(argv) {
  const options = { config: "project.config.json", output: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--config") options.config = argv[++index];
    else if (argument === "--output") options.output = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function printHelp() {
  console.log("Usage: node scripts/init-project.mjs --config <file> --output <empty-directory> [--dry-run]");
  console.log("The initializer never overwrites a non-empty directory.");
}

const starterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    if (!options.output) throw new Error("--output is required.");
    const configPath = path.resolve(process.cwd(), options.config);
    const outputPath = path.resolve(process.cwd(), options.output);
    const config = await readJson(configPath);
    const plan = await initializeProject(starterRoot, outputPath, config, { dryRun: options.dryRun });
    console.log(`${options.dryRun ? "Planned" : "Initialized"} project '${config.project.name}'.`);
    console.log(`Output: ${plan.outputRoot}`);
    console.log(`Generated files: ${plan.files.length + (options.dryRun ? 0 : 2)}`);
  }
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exitCode = 1;
}
