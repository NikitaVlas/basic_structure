import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectDocumentation } from "../scripts/lib/documentation.mjs";

test("project documentation reports placeholders and broken links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "basic-docs-"));
  try {
    await writeFile(path.join(root, "README.md"), "# Project\n\nTBD\n\n[missing](docs/missing.md)\n");
    const report = await inspectDocumentation(root, { mode: "project" });
    assert.equal(report.findings.filter(({ rule }) => rule === "placeholder").length, 1);
    assert.equal(report.findings.filter(({ rule }) => rule === "broken-link").length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("template mode permits placeholders in questionnaires", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "basic-docs-"));
  try {
    await mkdir(path.join(root, "docs", "questionnaires"), { recursive: true });
    await writeFile(path.join(root, "docs", "questionnaires", "project-init.md"), "# Questions\n\nTBD\n");
    const report = await inspectDocumentation(root, { mode: "template" });
    assert.deepEqual(report.findings, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
