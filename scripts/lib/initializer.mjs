import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists, resolveConfiguration } from "./configuration.mjs";

const CORE_ENTRIES = [
  "AGENTS.md",
  "AI-SETUP.md",
  "agent",
  "docs",
  "tasks",
  "scripts/check-docs.mjs",
  "scripts/lib/configuration.mjs",
  "scripts/lib/documentation.mjs"
];

async function listFiles(root, relative = "") {
  const current = path.join(root, relative);
  if (!(await pathExists(current))) return [];
  const info = await stat(current);
  if (info.isFile()) return [relative];
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => listFiles(root, path.join(relative, entry.name))));
  return nested.flat();
}

function render(value, config) {
  return value
    .replaceAll("{{PROJECT_NAME}}", config.project.name)
    .replaceAll("{{PROJECT_DESCRIPTION}}", config.project.description);
}

async function assertSafeOutput(starterRoot, outputRoot) {
  const starter = path.resolve(starterRoot);
  const output = path.resolve(outputRoot);
  if (output === starter || starter.startsWith(`${output}${path.sep}`)) {
    throw new Error("Output must not be the starter root or one of its parents.");
  }
  if (await pathExists(output)) {
    const entries = await readdir(output);
    if (entries.length) throw new Error(`Output directory must be empty: ${output}`);
  }
}

async function buildCopyPlan(starterRoot, resolved) {
  const sources = [];
  for (const entry of CORE_ENTRIES) sources.push({ root: starterRoot, scan: entry, strip: "", owner: "core" });
  for (const extension of [resolved.profile, ...resolved.modules, ...resolved.adapters]) {
    sources.push({
      root: path.join(extension.root, extension.manifest.files),
      scan: ".",
      strip: ".",
      owner: `${extension.manifest.kind}:${extension.manifest.id}`
    });
  }

  const files = [];
  const owners = new Map();
  for (const source of sources) {
    for (const relative of await listFiles(source.root, source.scan)) {
      const destinationRelative = source.strip === "." ? path.relative(source.scan, relative) : relative;
      const normalized = destinationRelative.split(path.sep).join("/");
      if (normalized.endsWith("/.gitkeep") || normalized === ".gitkeep") continue;
      if (owners.has(normalized)) {
        throw new Error(`File collision for '${normalized}' between ${owners.get(normalized)} and ${source.owner}.`);
      }
      owners.set(normalized, source.owner);
      files.push({ source: path.join(source.root, relative), relative: normalized, owner: source.owner });
    }
  }
  return files;
}

export async function planInitialization(starterRoot, outputRoot, config) {
  await assertSafeOutput(starterRoot, outputRoot);
  const resolved = await resolveConfiguration(starterRoot, config);
  const files = await buildCopyPlan(starterRoot, resolved);
  return { outputRoot: path.resolve(outputRoot), resolved, files };
}

export async function initializeProject(starterRoot, outputRoot, config, options = {}) {
  const plan = await planInitialization(starterRoot, outputRoot, config);
  if (options.dryRun) return plan;

  await mkdir(plan.outputRoot, { recursive: true });
  for (const file of plan.files) {
    const destination = path.join(plan.outputRoot, file.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    if (/\.(md|json|ya?ml|toml|txt|env|example|[cm]?[jt]sx?|css|html|astro)$/i.test(file.relative)) {
      const content = await readFile(file.source, "utf8");
      await writeFile(destination, render(content, config), "utf8");
    } else {
      await cp(file.source, destination);
    }
  }

  const stateRoot = path.join(plan.outputRoot, ".basic-structure");
  await mkdir(stateRoot, { recursive: true });
  await writeFile(path.join(plan.outputRoot, "project.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(path.join(stateRoot, "state.json"), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profile: config.project.profile,
    modules: config.modules,
    adapters: config.adapters,
    generatedFiles: plan.files.map(({ relative, owner }) => ({ path: relative, owner }))
  }, null, 2)}\n`, "utf8");
  return plan;
}
