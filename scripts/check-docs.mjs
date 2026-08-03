#!/usr/bin/env node
import path from "node:path";
import { inspectDocumentation } from "./lib/documentation.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const root = path.resolve(option("--root", process.cwd()));
const mode = option("--mode", "project");

try {
  const report = await inspectDocumentation(root, { mode });
  if (report.findings.length) {
    for (const finding of report.findings) console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
    console.error(`Documentation check failed with ${report.findings.length} finding(s).`);
    process.exitCode = 1;
  } else {
    console.log(`Documentation check passed (${report.filesChecked} files, ${report.mode} mode).`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
