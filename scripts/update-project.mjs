#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyProjectUpgrade, planProjectUpgrade, summarizeUpgradePlan } from "./lib/upgrade.mjs";

function parseArguments(argv) {
  const options = { project: ".", apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") options.project = argv[++index];
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--plan") options.apply = false;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function printHelp() {
  console.log("Usage: node scripts/update-project.mjs --project <generated-project> [--plan|--apply]");
  console.log("Plan is the default and never modifies the target project. Apply refuses conflicts.");
}

const starterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const plan = await planProjectUpgrade(starterRoot, path.resolve(process.cwd(), options.project));
    for (const change of plan.changes.filter((entry) => entry.status !== "unchanged")) {
      console.log(`${change.status.toUpperCase().padEnd(16)} ${change.path} — ${change.reason}`);
    }
    console.log(`Summary: ${JSON.stringify(summarizeUpgradePlan(plan))}`);
    if (plan.blocked) {
      console.error("Upgrade blocked. Resolve conflicts before apply.");
      process.exitCode = 2;
    } else if (options.apply) {
      const result = await applyProjectUpgrade(plan);
      console.log(`Applied upgrade ${result.operationId}.`);
      if (result.backupRoot) console.log(`Backup: ${result.backupRoot}`);
      console.log(`Report: ${result.reportPath}`);
    } else {
      console.log("Plan only; no project files were changed.");
    }
  }
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exitCode = 1;
}

