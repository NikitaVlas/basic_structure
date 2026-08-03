import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadExtension, pathExists, readJson, resolveConfiguration } from "./configuration.mjs";
import { initializeProject } from "./initializer.mjs";
import { planCompositionChange } from "./composition.mjs";
import { applyProjectUpgrade, planProjectUpgrade, summarizeUpgradePlan } from "./upgrade.mjs";

const KINDS = new Set(["profile", "module", "adapter"]);
const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export class ExtensionAuthoringError extends Error {
  constructor(message, code = "EXTENSION_AUTHORING_INVALID", exitCode = 1, data) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.data = data;
  }
}

function assertIdentity(kind, id) {
  if (!KINDS.has(kind)) throw new ExtensionAuthoringError("Extension kind must be profile, module, or adapter.");
  if (!ID_PATTERN.test(id ?? "")) throw new ExtensionAuthoringError("Extension id must be a lowercase kebab-case identifier.");
}

function titleFromId(id) {
  return id.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}

function scaffoldManifest(kind, id, description) {
  return {
    $schema: "../../schemas/extension-manifest.schema.json",
    schemaVersion: 2,
    kind,
    id,
    version: "1.0.0",
    starter: ">=0.1.0 <1.0.0",
    name: titleFromId(id),
    description: description ?? `Local ${kind} extension ${id}.`,
    capabilities: [],
    tags: [],
    maturity: "experimental",
    ...(kind === "profile" ? { surfaces: [] } : {}),
    files: "template",
    requires: {},
    conflicts: []
  };
}

function scaffoldFixture(kind, id) {
  return {
    $schema: "../../../schemas/project-config.schema.json",
    schemaVersion: 1,
    project: { name: `${id}-fixture`, description: `Integration fixture for ${kind}:${id}.`, profile: kind === "profile" ? id : "documentation-only" },
    surfaces: [],
    modules: kind === "module" ? [id] : [],
    adapters: kind === "adapter" ? [id] : [],
    verification: { required: true }
  };
}

export async function createExtensionScaffold(starterRoot, request) {
  const { kind, id } = request;
  assertIdentity(kind, id);
  const collectionRoot = path.join(path.resolve(starterRoot), `${kind}s`);
  const collectionInfo = await lstat(collectionRoot);
  if (collectionInfo.isSymbolicLink() || !collectionInfo.isDirectory()) throw new ExtensionAuthoringError(`Extension collection must be a regular directory: ${collectionRoot}`);
  const extensionRoot = path.join(collectionRoot, id);
  if (await pathExists(extensionRoot)) throw new ExtensionAuthoringError(`${kind}:${id} already exists.`, "EXTENSION_EXISTS", 1, { extensionRoot });

  const stagingRoot = path.join(collectionRoot, `.${id}-authoring-${randomUUID()}`);
  try {
    await mkdir(path.join(stagingRoot, "template"), { recursive: true });
    await mkdir(path.join(stagingRoot, "test"), { recursive: true });
    const manifestName = kind === "profile" ? "profile.json" : `${kind}.json`;
    await writeFile(path.join(stagingRoot, manifestName), `${JSON.stringify(scaffoldManifest(kind, id, request.description), null, 2)}\n`, "utf8");
    await writeFile(path.join(stagingRoot, "template", ".gitkeep"), "", "utf8");
    await writeFile(path.join(stagingRoot, "test", "fixture.config.json"), `${JSON.stringify(scaffoldFixture(kind, id), null, 2)}\n`, "utf8");
    await writeFile(path.join(stagingRoot, "README.md"), `# ${titleFromId(id)}\n\nIdentity: \`${kind}:${id}\`.\n\nAdd owned output beneath \`template/\`, declare requirements and conflicts in the manifest, update the integration fixture when needed, then run \`validate-extension\` and \`test-extension\`.\n`, "utf8");
    await rename(stagingRoot, extensionRoot);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
  return { kind, id, identity: `${kind}:${id}`, extensionRoot, files: [kind === "profile" ? "profile.json" : `${kind}.json`, "template/.gitkeep", "test/fixture.config.json", "README.md"] };
}

function assertFixtureSelection(kind, id, config) {
  const selected = kind === "profile" ? config.project?.profile === id : config[`${kind}s`]?.includes(id);
  if (!selected) throw new ExtensionAuthoringError(`Fixture must select ${kind}:${id}.`, "EXTENSION_FIXTURE_MISMATCH");
}

export async function validateAuthoredExtension(starterRoot, kind, id) {
  assertIdentity(kind, id);
  const extension = await loadExtension(starterRoot, kind, id);
  const fixturePath = path.join(extension.root, "test", "fixture.config.json");
  if (!(await pathExists(fixturePath))) throw new ExtensionAuthoringError(`Missing authoring fixture: ${fixturePath}`, "EXTENSION_FIXTURE_MISSING");
  const config = await readJson(fixturePath);
  assertFixtureSelection(kind, id, config);
  const resolved = await resolveConfiguration(starterRoot, config);
  return { identity: `${kind}:${id}`, version: extension.manifest.version, fixturePath, starterVersion: resolved.starterVersion, extensionVersions: resolved.extensionVersions };
}

export async function testAuthoredExtension(starterRoot, kind, id) {
  const validation = await validateAuthoredExtension(starterRoot, kind, id);
  const config = await readJson(validation.fixturePath);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "basic-structure-extension-"));
  const projectRoot = path.join(temporaryRoot, "project");
  try {
    const initialization = await initializeProject(starterRoot, projectRoot, config);
    const cleanPlan = await planProjectUpgrade(starterRoot, projectRoot);
    const cleanSummary = summarizeUpgradePlan(cleanPlan);
    if (cleanPlan.blocked || cleanPlan.changes.some((change) => !["unchanged", "user-modified"].includes(change.status))) {
      throw new ExtensionAuthoringError(`Generated fixture for ${kind}:${id} does not have a clean upgrade plan.`, "EXTENSION_FIXTURE_UNSTABLE", 1, { cleanSummary });
    }

    let roundTrip = "initialization-only";
    if (kind !== "profile") {
      await applyProjectUpgrade(await planCompositionChange(starterRoot, projectRoot, { action: "remove", kind, id }));
      await applyProjectUpgrade(await planCompositionChange(starterRoot, projectRoot, { action: "add", kind, id }));
      const finalPlan = await planProjectUpgrade(starterRoot, projectRoot);
      if (finalPlan.blocked || finalPlan.changes.some((change) => !["unchanged", "user-modified"].includes(change.status))) {
        throw new ExtensionAuthoringError(`Round-trip for ${kind}:${id} did not return to a clean plan.`, "EXTENSION_ROUND_TRIP_FAILED", 1, { fileSummary: summarizeUpgradePlan(finalPlan) });
      }
      roundTrip = "remove-add";
    }
    return { ...validation, managedFiles: initialization.files.length, cleanPlan: cleanSummary, roundTrip };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
