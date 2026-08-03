import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadExtension, pathExists, readJson, resolveConfiguration } from "./configuration.mjs";
import { initializeProject } from "./initializer.mjs";
import { applyProjectUpgrade, planProjectUpgrade, summarizeUpgradePlan } from "./upgrade.mjs";
import { diagnoseProject } from "./doctor.mjs";
import { planCompositionChange, planPresetApplication, planProfileMigration } from "./composition.mjs";
import { createExtensionScaffold, testAuthoredExtension, validateAuthoredExtension } from "./extension-authoring.mjs";
import { configurationFromPreset, listPresets, loadPreset } from "./presets.mjs";
import { inspectCatalogEntry, recommendCapabilities, searchCatalog } from "./catalog.mjs";
import { checkProjectPolicies, listPolicies, loadPolicy } from "./policies.mjs";
import { checkProjectDrift, checkProjectGate } from "./gates.mjs";

class CliError extends Error {
  constructor(message, code = "INVALID_REQUEST", exitCode = 1, data) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.data = data;
  }
}

const ROOT_HELP = `Usage: basic-structure <command> [options]

Commands:
  init       Create or preview a generated project
  validate   Validate configuration and compatibility
  list       List local profiles, modules, and adapters
  update     Plan or apply a safe project upgrade
  add        Add a module or adapter with required dependencies
  remove     Remove an unreferenced module or adapter
  switch-profile  Migrate the project to another profile
  create-extension  Scaffold a local profile, module, or adapter
  validate-extension  Validate an extension manifest and fixture
  test-extension  Run isolated extension integration checks
  list-presets  List resolved local project recipes
  diff-preset  Preview a preset against a generated project
  apply-preset  Plan or apply a preset composition
  search     Search extensions and presets by local metadata
  inspect    Inspect a local extension
  inspect-preset  Inspect a resolved preset
  recommend  Recommend a compatible capability composition
  policy     List, explain, check, or remediate harness policies
  drift      Check generated project drift
  gate       Run or explain the unified read-only CI gate
  doctor     Run read-only project and environment diagnostics

Global options:
  --json     Emit one machine-readable JSON envelope
  --help     Show help`;

const COMMAND_HELP = {
  init: "Usage: basic-structure init (--config <file> | --preset <id> --name <project>) --output <empty-directory> [--description <text>] [--dry-run] [--json]",
  validate: "Usage: basic-structure validate [--config <file>] [--json]",
  list: "Usage: basic-structure list [--kind profile|module|adapter] [--json]",
  update: "Usage: basic-structure update [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  add: "Usage: basic-structure add <module|adapter> <id> [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  remove: "Usage: basic-structure remove <module|adapter> <id> [--project <directory>] [--plan|--apply] [--acknowledge-migration <qualified-id>] [--json]",
  "switch-profile": "Usage: basic-structure switch-profile <id> [--project <directory>] [--plan|--apply] [--prune-incompatible] [--acknowledge-migration <qualified-id>] [--json]",
  "create-extension": "Usage: basic-structure create-extension <profile|module|adapter> <id> [--description <text>] [--json]",
  "validate-extension": "Usage: basic-structure validate-extension <profile|module|adapter> <id> [--json]",
  "test-extension": "Usage: basic-structure test-extension <profile|module|adapter> <id> [--json]",
  "list-presets": "Usage: basic-structure list-presets [--json]",
  "diff-preset": "Usage: basic-structure diff-preset <id> [--project <directory>] [--prune] [--json]",
  "apply-preset": "Usage: basic-structure apply-preset <id> [--project <directory>] [--plan|--apply] [--prune] [--acknowledge-migration <qualified-id>] [--json]",
  search: "Usage: basic-structure search <query> [--kind profile|module|adapter|preset] [--json]",
  inspect: "Usage: basic-structure inspect <profile|module|adapter> <id> [--json]",
  "inspect-preset": "Usage: basic-structure inspect-preset <id> [--json]",
  recommend: "Usage: basic-structure recommend --capability <id> [--capability <id>...] [--profile <id>] [--json]",
  policy: "Usage: basic-structure policy <list|explain|check|apply> [id] [--project <directory>] [--plan|--apply] [--json]",
  drift: "Usage: basic-structure drift check [--project <directory>] [--json]",
  gate: "Usage: basic-structure gate <check|explain> [--project <directory>] [--json]",
  doctor: "Usage: basic-structure doctor [--project <directory>] [--json]"
};

function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new CliError(`${option} requires a value.`);
  return value;
}

function rejectUnknown(argument) {
  throw new CliError(`Unknown option: ${argument}`);
}

function parseInit(argv) {
  const options = { config: null, preset: null, name: null, description: null, output: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--config") options.config = takeValue(argv, index++, "--config");
    else if (argv[index] === "--preset") options.preset = takeValue(argv, index++, "--preset");
    else if (argv[index] === "--name") options.name = takeValue(argv, index++, "--name");
    else if (argv[index] === "--description") options.description = takeValue(argv, index++, "--description");
    else if (argv[index] === "--output") options.output = takeValue(argv, index++, "--output");
    else if (argv[index] === "--dry-run") options.dryRun = true;
    else rejectUnknown(argv[index]);
  }
  if (!options.output) throw new CliError("--output is required.");
  if (options.config && options.preset) throw new CliError("Choose either --config or --preset, not both.");
  if (!options.config && !options.preset) options.config = "project.config.json";
  if (options.preset && !options.name) throw new CliError("--name is required with --preset.");
  return options;
}

function parseSinglePath(argv, option, fallback) {
  let value = fallback;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === option) value = takeValue(argv, index++, option);
    else rejectUnknown(argv[index]);
  }
  return value;
}

function parseList(argv) {
  const options = { kind: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--kind") options.kind = takeValue(argv, index++, "--kind");
    else rejectUnknown(argv[index]);
  }
  if (options.kind && !["profile", "module", "adapter"].includes(options.kind)) throw new CliError("--kind must be profile, module, or adapter.");
  return options;
}

function parseUpdate(argv) {
  const options = { project: ".", apply: false, acknowledgements: [] };
  let modeSeen = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--project") options.project = takeValue(argv, index++, "--project");
    else if (argv[index] === "--plan" || argv[index] === "--apply") {
      const mode = argv[index].slice(2);
      if (modeSeen && modeSeen !== mode) throw new CliError("Choose either --plan or --apply, not both.");
      modeSeen = mode;
      options.apply = mode === "apply";
    } else if (argv[index] === "--acknowledge-migration") {
      const identity = takeValue(argv, index++, "--acknowledge-migration");
      if (!/^(profile|module|adapter):[a-z][a-z0-9-]*$/.test(identity)) throw new CliError("--acknowledge-migration requires a qualified extension id.");
      options.acknowledgements.push(identity);
    } else rejectUnknown(argv[index]);
  }
  return options;
}

function parseComposition(argv) {
  const kind = argv.shift();
  const id = argv.shift();
  if (!kind || !id) throw new CliError("Composition command requires <module|adapter> <id>.");
  const options = parseUpdate(argv);
  return { ...options, kind, id };
}

function parseProfileMigration(argv) {
  const id = argv.shift();
  if (!id) throw new CliError("switch-profile requires <id>.");
  const pruneIncompatible = argv.includes("--prune-incompatible");
  const options = parseUpdate(argv.filter((argument) => argument !== "--prune-incompatible"));
  return { ...options, id, pruneIncompatible };
}

function parseExtensionIdentity(argv, options = {}) {
  const kind = argv.shift();
  const id = argv.shift();
  if (!kind || !id) throw new CliError(`${options.command ?? "Extension command"} requires <profile|module|adapter> <id>.`);
  let description;
  for (let index = 0; index < argv.length; index += 1) {
    if (options.allowDescription && argv[index] === "--description") description = takeValue(argv, index++, "--description");
    else rejectUnknown(argv[index]);
  }
  return { kind, id, description };
}

function parsePresetChange(argv, command) {
  const id = argv.shift();
  if (!id) throw new CliError(`${command} requires <id>.`);
  const prune = argv.includes("--prune");
  const options = parseUpdate(argv.filter((argument) => argument !== "--prune"));
  if (command === "diff-preset" && options.apply) throw new CliError("diff-preset is plan-only.");
  return { ...options, id, prune, apply: command === "diff-preset" ? false : options.apply };
}

function parseSearch(argv) {
  const query = argv.shift();
  let kind;
  for (let index = 0; index < argv.length; index += 1) if (argv[index] === "--kind") kind = takeValue(argv, index++, "--kind"); else rejectUnknown(argv[index]);
  if (kind && !["profile", "module", "adapter", "preset"].includes(kind)) throw new CliError("--kind must be profile, module, adapter, or preset.");
  return { query, kind };
}

function parseRecommendation(argv) {
  const capabilities = [];
  let profile;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--capability") capabilities.push(takeValue(argv, index++, "--capability"));
    else if (argv[index] === "--profile") profile = takeValue(argv, index++, "--profile");
    else rejectUnknown(argv[index]);
  }
  return { capabilities, profile };
}

async function listExtensions(starterRoot, kindFilter) {
  const result = [];
  for (const kind of ["profile", "module", "adapter"]) {
    if (kindFilter && kind !== kindFilter) continue;
    const parent = path.join(starterRoot, `${kind}s`);
    if (!(await pathExists(parent))) continue;
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const { manifest } = await loadExtension(starterRoot, kind, entry.name);
      result.push({ kind, id: manifest.id, version: manifest.version, starter: manifest.starter, description: manifest.description, requires: manifest.requires, conflicts: manifest.conflicts, migrations: manifest.migrations ?? [] });
    }
  }
  return result.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

function success(command, data, lines = []) {
  return { schemaVersion: 1, command, ok: true, exitCode: 0, data, lines };
}

async function execute(command, argv, context) {
  const { starterRoot, cwd } = context;
  if (command === "init") {
    const options = parseInit(argv);
    const preset = options.preset ? await loadPreset(starterRoot, options.preset) : null;
    const config = preset ? await configurationFromPreset(starterRoot, preset, { name: options.name, description: options.description ?? preset.description }) : await readJson(path.resolve(cwd, options.config));
    const plan = await initializeProject(starterRoot, path.resolve(cwd, options.output), config, { dryRun: options.dryRun });
    const data = { project: config.project.name, outputRoot: plan.outputRoot, dryRun: options.dryRun, managedFiles: plan.files.length, ...(preset ? { preset: { id: preset.id, version: preset.version, lineage: preset.lineage } } : {}) };
    return success(command, data, [`${options.dryRun ? "Planned" : "Initialized"} '${config.project.name}' at ${plan.outputRoot}.`, `Managed files: ${plan.files.length}`]);
  }
  if (command === "validate") {
    const configPath = parseSinglePath(argv, "--config", "project.config.json");
    const config = await readJson(path.resolve(cwd, configPath));
    const resolved = await resolveConfiguration(starterRoot, config);
    const data = { project: config.project.name, starterVersion: resolved.starterVersion, extensionVersions: resolved.extensionVersions };
    return success(command, data, [`Configuration is valid: ${config.project.name}`, ...Object.entries(resolved.extensionVersions).map(([identity, version]) => `${identity}@${version}`)]);
  }
  if (command === "list") {
    const options = parseList(argv);
    const extensions = await listExtensions(starterRoot, options.kind);
    return success(command, { extensions }, extensions.map((entry) => `${entry.kind}:${entry.id}@${entry.version} — ${entry.description}`));
  }
  if (command === "update") {
    const options = parseUpdate(argv);
    const plan = await planProjectUpgrade(starterRoot, path.resolve(cwd, options.project), { acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Upgrade is blocked by file conflicts or migration requirements.", "UPGRADE_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [...plan.extensionChanges.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.identity} ${entry.fromVersion ?? "none"} -> ${entry.toVersion ?? "none"}`), ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`), options.apply ? `Applied upgrade ${data.result.operationId}.` : "Plan only; no project files were changed."];
    return success(command, data, lines);
  }
  if (command === "add" || command === "remove") {
    const options = parseComposition(argv);
    const plan = await planCompositionChange(starterRoot, path.resolve(cwd, options.project), { action: command, kind: options.kind, id: options.id, acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, compositionChange: plan.compositionChange, configChange: plan.configChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Composition change is blocked by file conflicts or migration requirements.", "COMPOSITION_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [
      `${command.toUpperCase()} ${plan.compositionChange.requested}`,
      ...plan.compositionChange.automatic.map((identity) => `REQUIRED ${identity}`),
      ...plan.extensionChanges.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.identity}`),
      ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`),
      options.apply ? `Applied composition change ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."
    ];
    return success(command, data, lines);
  }
  if (command === "switch-profile") {
    const options = parseProfileMigration(argv);
    const plan = await planProfileMigration(starterRoot, path.resolve(cwd, options.project), options);
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, profileMigration: plan.profileMigration, configChange: plan.configChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Profile migration is blocked by file conflicts or migration requirements.", "PROFILE_MIGRATION_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [
      `SWITCH ${plan.profileMigration.from} -> ${plan.profileMigration.to}`,
      ...plan.profileMigration.automatic.map((identity) => `REQUIRED ${identity}`),
      ...plan.profileMigration.pruned.map((identity) => `PRUNE ${identity}`),
      ...plan.extensionChanges.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.identity}`),
      ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`),
      options.apply ? `Applied profile migration ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."
    ];
    return success(command, data, lines);
  }
  if (command === "create-extension") {
    const options = parseExtensionIdentity(argv, { command, allowDescription: true });
    const data = await createExtensionScaffold(starterRoot, options);
    return success(command, data, [`Created ${data.identity} at ${data.extensionRoot}.`, ...data.files.map((file) => `CREATE ${file}`), `Next: validate-extension ${options.kind} ${options.id}`]);
  }
  if (command === "validate-extension") {
    const options = parseExtensionIdentity(argv, { command });
    const data = await validateAuthoredExtension(starterRoot, options.kind, options.id);
    return success(command, data, [`Validated ${data.identity}@${data.version}.`, `Fixture: ${data.fixturePath}`, `Selected extensions: ${Object.keys(data.extensionVersions).length}`]);
  }
  if (command === "test-extension") {
    const options = parseExtensionIdentity(argv, { command });
    const data = await testAuthoredExtension(starterRoot, options.kind, options.id);
    return success(command, data, [`Tested ${data.identity}@${data.version}.`, `Managed files: ${data.managedFiles}`, `Round-trip: ${data.roundTrip}`]);
  }
  if (command === "list-presets") {
    if (argv.length) rejectUnknown(argv[0]);
    const presets = await listPresets(starterRoot);
    const data = { presets: presets.map(({ presetPath, ...preset }) => preset) };
    return success(command, data, data.presets.map((preset) => `${preset.id}@${preset.version} — ${preset.description}`));
  }
  if (command === "diff-preset" || command === "apply-preset") {
    const options = parsePresetChange(argv, command);
    const preset = await loadPreset(starterRoot, options.id);
    const plan = await planPresetApplication(starterRoot, path.resolve(cwd, options.project), { preset, prune: options.prune, acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, presetChange: plan.presetChange, configChange: plan.configChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Preset application is blocked by file conflicts or migration requirements.", "PRESET_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [`PRESET ${preset.id}@${preset.version} (${plan.presetChange.mode})`, ...plan.presetChange.added.map((identity) => `ADD ${identity}`), ...plan.presetChange.removed.map((identity) => `REMOVE ${identity}`), ...plan.presetChange.automatic.map((identity) => `REQUIRED ${identity}`), ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`), options.apply ? `Applied preset ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."];
    return success(command, data, lines);
  }
  if (command === "search") {
    const options = parseSearch(argv);
    const results = await searchCatalog(starterRoot, options.query, { kind: options.kind });
    return success(command, { query: options.query, results }, results.map((entry) => `${entry.identity}@${entry.version} [${entry.maturity}] — ${entry.description}`));
  }
  if (command === "inspect" || command === "inspect-preset") {
    const kind = command === "inspect-preset" ? "preset" : argv.shift();
    const id = argv.shift();
    if (!id || argv.length) throw new CliError(command === "inspect" ? "inspect requires <profile|module|adapter> <id>." : "inspect-preset requires <id>.");
    const entry = await inspectCatalogEntry(starterRoot, kind, id);
    return success(command, entry, [`${entry.identity}@${entry.version} [${entry.maturity}]`, entry.description, `Capabilities: ${entry.capabilities.join(", ") || "none"}`, `Tags: ${entry.tags.join(", ") || "none"}`]);
  }
  if (command === "recommend") {
    const options = parseRecommendation(argv);
    const data = await recommendCapabilities(starterRoot, options.capabilities, { profile: options.profile });
    const lines = [`Profile: ${data.profile}`, ...data.providers.map((provider) => `SELECT ${provider.identity} — ${provider.reason}`), ...data.presetMatches.map((preset) => `PRESET ${preset.identity} (${preset.extensionCount} extensions)`), ...(data.uncovered.length ? [`UNCOVERED ${data.uncovered.join(", ")}`] : []), ...(data.compositionError ? [`INCOMPATIBLE ${data.compositionError}`] : [])];
    return success(command, data, lines);
  }
  if (command === "policy") {
    const action = argv.shift();
    if (action === "list") {
      if (argv.length) rejectUnknown(argv[0]);
      const policies = await listPolicies(starterRoot);
      return success(command, { action, policies }, policies.map((policy) => `${policy.id}@${policy.version} [${policy.severity}] — ${policy.description}`));
    }
    if (action === "explain") {
      const id = argv.shift(); if (!id || argv.length) throw new CliError("policy explain requires <id>.");
      const policy = await loadPolicy(starterRoot, id);
      return success(command, { action, policy }, [`${policy.id}@${policy.version} [${policy.severity}]`, policy.description, `Requires capabilities: ${policy.requiresCapabilities.join(", ") || "none"}`, `Remediation preset: ${policy.remediationPreset}`]);
    }
    if (action === "check") {
      let id = null; if (argv[0] && !argv[0].startsWith("--")) id = argv.shift();
      const project = parseSinglePath(argv, "--project", ".");
      const data = await checkProjectPolicies(starterRoot, path.resolve(cwd, project), { id });
      if (!data.compliant) throw new CliError("Harness policy violations found.", "POLICY_VIOLATION", 4, data);
      return success(command, { action, ...data }, data.results.map((result) => `${result.status.toUpperCase()} ${result.id}: ${result.message}`));
    }
    if (action === "apply") {
      const id = argv.shift(); if (!id) throw new CliError("policy apply requires <id>.");
      const options = parseUpdate(argv);
      const policy = await loadPolicy(starterRoot, id);
      const preset = await loadPreset(starterRoot, policy.remediationPreset);
      const plan = await planPresetApplication(starterRoot, path.resolve(cwd, options.project), { preset, acknowledgements: options.acknowledgements });
      plan.policyChange = { id: policy.id, remediationPreset: policy.remediationPreset };
      const data = { action, mode: options.apply ? "apply" : "plan", policy: policy.id, remediationPreset: policy.remediationPreset, blocked: plan.blocked, presetChange: plan.presetChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
      if (plan.blocked) throw new CliError("Policy remediation is blocked.", "POLICY_REMEDIATION_BLOCKED", 2, data);
      if (options.apply) data.result = await applyProjectUpgrade(plan);
      return success(command, data, [`POLICY ${policy.id}`, `REMEDIATE preset:${policy.remediationPreset}`, options.apply ? `Applied remediation ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."]);
    }
    throw new CliError("policy requires list, explain, check, or apply.");
  }
  if (command === "drift") {
    const action = argv.shift(); if (action !== "check") throw new CliError("drift requires check.");
    const project = parseSinglePath(argv, "--project", ".");
    const data = await checkProjectDrift(starterRoot, path.resolve(cwd, project));
    if (!data.clean) throw new CliError("Managed project drift detected.", "DRIFT_DETECTED", 5, data);
    return success(command, data, ["PASS drift: managed project matches the starter."]);
  }
  if (command === "gate") {
    const action = argv.shift(); if (!new Set(["check", "explain"]).has(action)) throw new CliError("gate requires check or explain.");
    const project = parseSinglePath(argv, "--project", ".");
    const data = await checkProjectGate(starterRoot, path.resolve(cwd, project), { probeExecutable: context.probeExecutable });
    if (!data.compliant) throw new CliError("CI harness gate failed.", "GATE_FAILED", 5, data);
    return success(command, { action, ...data }, data.checks.map((check) => `${check.status.toUpperCase()} ${check.id}: ${check.message}`));
  }
  if (command === "doctor") {
    const project = parseSinglePath(argv, "--project", ".");
    const diagnosis = await diagnoseProject(starterRoot, path.resolve(cwd, project), { probeExecutable: context.probeExecutable });
    if (!diagnosis.healthy) throw new CliError("Doctor found required failing checks.", "DOCTOR_UNHEALTHY", 3, diagnosis);
    return success(command, diagnosis, diagnosis.checks.map((entry) => `${entry.status.toUpperCase().padEnd(4)} ${entry.id}: ${entry.message}`));
  }
  throw new CliError(`Unknown command: ${command ?? "(none)"}`);
}

function envelopeFromError(command, error) {
  return { schemaVersion: 1, command: command ?? null, ok: false, exitCode: error.exitCode ?? 1, ...(error.data === undefined ? {} : { data: error.data }), error: { code: error.code ?? "COMMAND_FAILED", message: error.message } };
}

export async function runCli(options) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const raw = [...(options.argv ?? [])];
  const json = raw.includes("--json");
  const argv = raw.filter((argument) => argument !== "--json");
  const command = argv.shift();
  if (!command || command === "--help" || command === "-h" || command === "help") {
    const help = command === "help" && argv[0] ? COMMAND_HELP[argv[0]] : ROOT_HELP;
    if (!help) {
      const error = new CliError(`Unknown command: ${argv[0]}`);
      const envelope = envelopeFromError(argv[0], error);
      if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stderr.write(`${error.message}\n${ROOT_HELP}\n`);
      return envelope.exitCode;
    }
    const envelope = success("help", { topic: command === "help" ? argv[0] ?? null : null, text: help });
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stdout.write(`${help}\n`);
    return 0;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    const help = COMMAND_HELP[command];
    if (!help) {
      const error = new CliError(`Unknown command: ${command}`);
      const envelope = envelopeFromError(command, error);
      if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stderr.write(`${error.message}\n${ROOT_HELP}\n`);
      return envelope.exitCode;
    }
    const envelope = success("help", { topic: command, text: help });
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`); else stdout.write(`${help}\n`);
    return 0;
  }
  try {
    const result = await execute(command, argv, options);
    if (json) stdout.write(`${JSON.stringify({ schemaVersion: result.schemaVersion, command: result.command, ok: result.ok, exitCode: result.exitCode, data: result.data })}\n`);
    else for (const line of result.lines) stdout.write(`${line}\n`);
    return result.exitCode;
  } catch (error) {
    const envelope = envelopeFromError(command, error);
    if (json) stdout.write(`${JSON.stringify(envelope)}\n`);
    else {
      if (error.data?.checks) for (const entry of error.data.checks) stderr.write(`${entry.status.toUpperCase().padEnd(4)} ${entry.id}: ${entry.message}\n`);
      if (error.code === "POLICY_VIOLATION") for (const result of error.data.results) stderr.write(`${result.status.toUpperCase()} ${result.id}: ${result.message}\n`);
      if (error.code === "GATE_FAILED") for (const check of error.data.checks) stderr.write(`${check.status.toUpperCase()} ${check.id}: ${check.message}\n`);
      if (error.code === "UPGRADE_BLOCKED" || error.code === "COMPOSITION_BLOCKED" || error.code === "PROFILE_MIGRATION_BLOCKED" || error.code === "PRESET_BLOCKED") {
        for (const entry of error.data.extensionChanges.filter((change) => change.status !== "unchanged")) {
          stderr.write(`${entry.status.toUpperCase()} ${entry.identity} ${entry.fromVersion ?? "none"} -> ${entry.toVersion ?? "none"}${entry.acknowledged ? "" : " — acknowledgement required"}\n`);
          for (const notice of entry.notices) stderr.write(`  Migration: ${notice.description}\n`);
        }
        for (const entry of error.data.fileChanges.filter((change) => change.status !== "unchanged")) stderr.write(`${entry.status.toUpperCase()} ${entry.path}: ${entry.reason}\n`);
      }
      stderr.write(`${error.message}\n`);
      const help = COMMAND_HELP[command];
      if (error instanceof CliError && error.exitCode === 1 && help) stderr.write(`${help}\n`);
    }
    return envelope.exitCode;
  }
}
