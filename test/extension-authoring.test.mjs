import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createExtensionScaffold, ExtensionAuthoringError, testAuthoredExtension, validateAuthoredExtension } from "../scripts/lib/extension-authoring.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function starterFixture(run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-authoring-"));
  const starterRoot = path.join(temporaryRoot, "starter");
  try {
    await cp(root, starterRoot, {
      recursive: true,
      filter(source) {
        const relative = path.relative(root, source).split(path.sep).join("/");
        return !relative.startsWith(".git/") && relative !== ".git" && !relative.startsWith("node_modules/") && relative !== "node_modules" && !relative.startsWith("work/") && relative !== "work";
      }
    });
    await run(starterRoot);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("authoring scaffolds and validates all extension kinds", async () => {
  await starterFixture(async (starterRoot) => {
    for (const kind of ["profile", "module", "adapter"]) {
      const id = `sample-${kind}`;
      const created = await createExtensionScaffold(starterRoot, { kind, id, description: `Sample ${kind}.` });
      assert.equal(created.identity, `${kind}:${id}`);
      const manifestName = kind === "profile" ? "profile.json" : `${kind}.json`;
      const manifest = JSON.parse(await readFile(path.join(created.extensionRoot, manifestName), "utf8"));
      assert.equal(manifest.kind, kind);
      assert.equal(manifest.id, id);
      const validation = await validateAuthoredExtension(starterRoot, kind, id);
      assert.equal(validation.extensionVersions[`${kind}:${id}`], "1.0.0");
    }
  });
});

test("authoring refuses invalid identities existing destinations and fixture mismatch", async () => {
  await starterFixture(async (starterRoot) => {
    await assert.rejects(() => createExtensionScaffold(starterRoot, { kind: "plugin", id: "sample" }), (error) => error instanceof ExtensionAuthoringError);
    await assert.rejects(() => createExtensionScaffold(starterRoot, { kind: "module", id: "../escape" }), (error) => error instanceof ExtensionAuthoringError);
    await createExtensionScaffold(starterRoot, { kind: "module", id: "safe-module" });
    await assert.rejects(() => createExtensionScaffold(starterRoot, { kind: "module", id: "safe-module" }), (error) => error.code === "EXTENSION_EXISTS");

    const fixturePath = path.join(starterRoot, "modules", "safe-module", "test", "fixture.config.json");
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    fixture.modules = [];
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    await assert.rejects(() => validateAuthoredExtension(starterRoot, "module", "safe-module"), (error) => error.code === "EXTENSION_FIXTURE_MISMATCH");
  });
});

test("authored extensions pass isolated integration and round-trip tests", async () => {
  await starterFixture(async (starterRoot) => {
    for (const kind of ["profile", "module", "adapter"]) {
      const id = `tested-${kind}`;
      await createExtensionScaffold(starterRoot, { kind, id });
      const result = await testAuthoredExtension(starterRoot, kind, id);
      assert.equal(result.roundTrip, kind === "profile" ? "initialization-only" : "remove-add");
      assert.ok(result.managedFiles > 0);
    }
  });
});
