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
import { createHarnessEvidence } from "./harness-evidence.mjs";
import { getPackageProvenance } from "./provenance.mjs";
import { inspectCatalogBundle, installCatalogBundle, listInstalledCatalogs, removeInstalledCatalog, verifyCatalogBundleSignature } from "./catalog-bundles.mjs";
import { addTrustedKey, readTrustStore, revokeTrustedKey } from "./trust-store.mjs";
import { createCatalogBundle, packCatalogBundle, signCatalogBundle, testCatalogBundle } from "./catalog-authoring.mjs";
import { applyProjectAdoption, planProjectAdoption, publicAdoptionPlan } from "./adoption.mjs";
import { activateCatalog, createLifecycleCatalog, deactivateCatalog, listActiveCatalogs, rollbackCatalogVersion, switchCatalogVersion } from "./catalog-activation.mjs";

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
  adopt      Adopt an existing project without taking ownership of its source
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
  version    Show package and catalog provenance
  catalog    Inspect, verify, add, list, or remove local bundles
  trust      List, inspect, add, or revoke publisher keys
  doctor     Run read-only project and environment diagnostics

Global options:
  --json     Emit one machine-readable JSON envelope
  --help     Show help`;

const COMMAND_HELP = {
  init: "Usage: basic-structure init (--config <file> | --preset <id> --name <project>) --output <empty-directory> [--description <text>] [--dry-run] [--json]",
  adopt: "Usage: basic-structure adopt [--project <directory>] [--profile <id>] [--name <id>] [--description <text>] [--plan|--apply] [--json]",
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
  gate: "Usage: basic-structure gate <check|explain|evidence> [--project <directory>] [--json]",
  version: "Usage: basic-structure version [--json]",
  catalog: "Usage: basic-structure catalog <create|pack|sign|test|inspect|verify|add|list|remove|activate|deactivate|active|switch|rollback> [target] [options] [--plan|--apply] [--json]",
  trust: "Usage: basic-structure trust <list|inspect|add|revoke> [target] [--project <directory>] [--plan|--apply] [--json]",
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

function parseAdopt(argv){const options={project:".",profile:null,name:null,description:null,apply:false};for(let index=0;index<argv.length;index++){if(argv[index]==="--project")options.project=takeValue(argv,index++,"--project");else if(argv[index]==="--profile")options.profile=takeValue(argv,index++,"--profile");else if(argv[index]==="--name")options.name=takeValue(argv,index++,"--name");else if(argv[index]==="--description")options.description=takeValue(argv,index++,"--description");else if(argv[index]==="--apply")options.apply=true;else if(argv[index]==="--plan")options.apply=false;else rejectUnknown(argv[index]);}return options;}

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
  let kind; let project = ".";
  for (let index = 0; index < argv.length; index += 1) if (argv[index] === "--kind") kind = takeValue(argv, index++, "--kind"); else if(argv[index]==="--project") project=takeValue(argv,index++,"--project"); else rejectUnknown(argv[index]);
  if (kind && !["profile", "module", "adapter", "preset"].includes(kind)) throw new CliError("--kind must be profile, module, adapter, or preset.");
  return { query, kind, project };
}

function parseRecommendation(argv) {
  const capabilities = [];
  let profile; let project = ".";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--capability") capabilities.push(takeValue(argv, index++, "--capability"));
    else if (argv[index] === "--profile") profile = takeValue(argv, index++, "--profile");
    else if (argv[index] === "--project") project = takeValue(argv, index++, "--project");
    else rejectUnknown(argv[index]);
  }
  return { capabilities, profile, project };
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
  if(command==="adopt"){const options=parseAdopt(argv);const plan=await planProjectAdoption(starterRoot,path.resolve(cwd,options.project),options);const view=publicAdoptionPlan(plan);if(plan.blocked)throw new CliError("Project adoption is blocked by reserved control-path conflicts.","ADOPTION_BLOCKED",2,view);const result=options.apply?await applyProjectAdoption(plan):null;const data={...view,mode:options.apply?"apply":"plan",...(result?{result}:{})};return success(command,data,[`${options.apply?"ADOPTED":"PLAN adopt"} ${plan.projectRoot}`,`Profile: ${plan.profile}`,`CREATE ${view.summary.create} managed files`,`PRESERVE ${view.summary.userOwned} user-owned paths`,...(result?[`State: ${result.statePath}`,`Report: ${result.reportPath}`]:["Plan only; no project files were changed."])]);}
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
    const projectRoot=path.resolve(cwd,options.project); const plan = await planProjectUpgrade(await createLifecycleCatalog(starterRoot,projectRoot), projectRoot, { acknowledgements: options.acknowledgements });
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
    const project=parseSinglePath(argv,"--project",".");const catalog=await createLifecycleCatalog(starterRoot,path.resolve(cwd,project));
    const presets = await listPresets(catalog);
    const data = { presets: presets.map(({ presetPath, ...preset }) => preset) };
    return success(command, data, data.presets.map((preset) => `${preset.id}@${preset.version} — ${preset.description}`));
  }
  if (command === "diff-preset" || command === "apply-preset") {
    const options = parsePresetChange(argv, command);
    const preset = await loadPreset(await createLifecycleCatalog(starterRoot,path.resolve(cwd,options.project)), options.id);
    const plan = await planPresetApplication(starterRoot, path.resolve(cwd, options.project), { preset, prune: options.prune, acknowledgements: options.acknowledgements });
    const data = { mode: options.apply ? "apply" : "plan", blocked: plan.blocked, presetChange: plan.presetChange, configChange: plan.configChange, fileSummary: summarizeUpgradePlan(plan), fileChanges: plan.changes, extensionChanges: plan.extensionChanges };
    if (plan.blocked) throw new CliError("Preset application is blocked by file conflicts or migration requirements.", "PRESET_BLOCKED", 2, data);
    if (options.apply) data.result = await applyProjectUpgrade(plan);
    const lines = [`PRESET ${preset.id}@${preset.version} (${plan.presetChange.mode})`, ...plan.presetChange.added.map((identity) => `ADD ${identity}`), ...plan.presetChange.removed.map((identity) => `REMOVE ${identity}`), ...plan.presetChange.automatic.map((identity) => `REQUIRED ${identity}`), ...plan.changes.filter((entry) => entry.status !== "unchanged").map((entry) => `${entry.status.toUpperCase()} ${entry.path}`), options.apply ? `Applied preset ${data.result.operationId}.` : "Plan only; no project files or configuration were changed."];
    return success(command, data, lines);
  }
  if (command === "search") {
    const options = parseSearch(argv);
    const results = await searchCatalog(starterRoot, options.query, { kind: options.kind, projectRoot: path.resolve(cwd, options.project) });
    return success(command, { query: options.query, results }, results.map((entry) => `${entry.identity}@${entry.version} [${entry.maturity}] — ${entry.description}`));
  }
  if (command === "inspect" || command === "inspect-preset") {
    const kind = command === "inspect-preset" ? "preset" : argv.shift();
    const id = argv.shift(); const project=parseSinglePath(argv,"--project",".");
    if (!id) throw new CliError(command === "inspect" ? "inspect requires <profile|module|adapter> <id>." : "inspect-preset requires <id>.");
    const entry = await inspectCatalogEntry(starterRoot, kind, id, {projectRoot:path.resolve(cwd,project)});
    return success(command, entry, [`${entry.identity}@${entry.version} [${entry.maturity}]`, entry.description, `Capabilities: ${entry.capabilities.join(", ") || "none"}`, `Tags: ${entry.tags.join(", ") || "none"}`]);
  }
  if (command === "recommend") {
    const options = parseRecommendation(argv);
    const data = await recommendCapabilities(starterRoot, options.capabilities, { profile: options.profile, projectRoot:path.resolve(cwd,options.project) });
    const lines = [`Profile: ${data.profile}`, ...data.providers.map((provider) => `SELECT ${provider.identity} — ${provider.reason}`), ...data.presetMatches.map((preset) => `PRESET ${preset.identity} (${preset.extensionCount} extensions)`), ...(data.uncovered.length ? [`UNCOVERED ${data.uncovered.join(", ")}`] : []), ...(data.compositionError ? [`INCOMPATIBLE ${data.compositionError}`] : [])];
    return success(command, data, lines);
  }
  if (command === "policy") {
    const action = argv.shift();
    if (action === "list") {
      const project=parseSinglePath(argv,"--project",".");const policies = await listPolicies(await createLifecycleCatalog(starterRoot,path.resolve(cwd,project)));
      return success(command, { action, policies }, policies.map((policy) => `${policy.id}@${policy.version} [${policy.severity}] — ${policy.description}`));
    }
    if (action === "explain") {
      const id = argv.shift(); if (!id) throw new CliError("policy explain requires <id>.");const project=parseSinglePath(argv,"--project",".");
      const policy = await loadPolicy(await createLifecycleCatalog(starterRoot,path.resolve(cwd,project)), id);
      return success(command, { action, policy }, [`${policy.id}@${policy.version} [${policy.severity}]`, policy.description, `Requires capabilities: ${policy.requiresCapabilities.join(", ") || "none"}`, `Remediation preset: ${policy.remediationPreset}`]);
    }
    if (action === "check") {
      let id = null; if (argv[0] && !argv[0].startsWith("--")) id = argv.shift();
      const project = parseSinglePath(argv, "--project", ".");
      const projectRoot=path.resolve(cwd,project);const data = await checkProjectPolicies(await createLifecycleCatalog(starterRoot,projectRoot), projectRoot, { id });
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
    const projectRoot=path.resolve(cwd,project);const data = await checkProjectDrift(await createLifecycleCatalog(starterRoot,projectRoot),projectRoot);
    if (!data.clean) throw new CliError("Managed project drift detected.", "DRIFT_DETECTED", 5, data);
    return success(command, data, ["PASS drift: managed project matches the starter."]);
  }
  if (command === "gate") {
    const action = argv.shift(); if (!new Set(["check", "explain", "evidence"]).has(action)) throw new CliError("gate requires check, explain, or evidence.");
    const project = parseSinglePath(argv, "--project", ".");
    const projectRoot=path.resolve(cwd,project);const catalog=await createLifecycleCatalog(starterRoot,projectRoot);const data = action==="evidence"?await createHarnessEvidence(catalog,projectRoot,{probeExecutable:context.probeExecutable}):await checkProjectGate(catalog,projectRoot,{ probeExecutable: context.probeExecutable });
    if (!data.compliant) throw new CliError("CI harness gate failed.", "GATE_FAILED", 5, data);
    return success(command, { action, ...data }, data.checks.map((check) => `${check.status.toUpperCase()} ${check.id}: ${check.message}`));
  }
  if (command === "version") {
    if (argv.length) rejectUnknown(argv[0]);
    const data = await getPackageProvenance(starterRoot);
    return success(command, data, [`${data.package.name}@${data.package.version}`, `Catalog: ${data.catalog.algorithm}:${data.catalog.digest} (${data.catalog.files} files)`, `Node: ${data.node}`]);
  }
  if (command === "catalog") {
    const action = argv.shift();
    if(action==="create"){const target=argv.shift();if(!target)throw new CliError("catalog create requires <directory>.");let publisher,id,version="1.0.0",cli="^0.1.0";const apply=argv.includes("--apply");for(let index=0;index<argv.length;index++){if(argv[index]==="--apply"||argv[index]==="--plan")continue;if(argv[index]==="--publisher")publisher=takeValue(argv,index++,"--publisher");else if(argv[index]==="--id")id=takeValue(argv,index++,"--id");else if(argv[index]==="--version")version=takeValue(argv,index++,"--version");else if(argv[index]==="--cli")cli=takeValue(argv,index++,"--cli");else rejectUnknown(argv[index]);}const data=await createCatalogBundle(path.resolve(cwd,target),{publisher,id,version,cli},apply);return success(command,{action,mode:apply?"apply":"plan",...data},[apply?`CREATED ${publisher}/${id}@${version}`:`PLAN create ${publisher}/${id}@${version}`]);}
    if(action==="pack"){const target=argv.shift();if(!target)throw new CliError("catalog pack requires <directory>.");const options=parseUpdate(argv);const data=await packCatalogBundle(path.resolve(cwd,target),options.apply);return success(command,{action,mode:options.apply?"apply":"plan",...data},[`${options.apply?"PACKED":"PLAN pack"} ${data.files} files`]);}
    if(action==="sign"){const target=argv.shift();if(!target)throw new CliError("catalog sign requires <directory>.");let privateKey,keyId;const apply=argv.includes("--apply");for(let index=0;index<argv.length;index++){if(argv[index]==="--apply"||argv[index]==="--plan")continue;if(argv[index]==="--private-key")privateKey=takeValue(argv,index++,"--private-key");else if(argv[index]==="--key-id")keyId=takeValue(argv,index++,"--key-id");else rejectUnknown(argv[index]);}if(!privateKey||!keyId)throw new CliError("catalog sign requires --private-key and --key-id.");const data=await signCatalogBundle(starterRoot,path.resolve(cwd,target),path.resolve(cwd,privateKey),keyId,apply);return success(command,{action,mode:apply?"apply":"plan",...data},[apply?`SIGNED ${data.publisher}/${data.id}@${data.version}`:`PLAN sign ${data.publisher}/${data.id}@${data.version}`]);}
    if(action==="test"){const target=argv.shift();if(!target)throw new CliError("catalog test requires <directory>.");const requireSignature=argv.includes("--require-signature");const project=parseSinglePath(argv.filter((item)=>item!=="--require-signature"),"--project",".");const data=await testCatalogBundle(starterRoot,path.resolve(cwd,project),path.resolve(cwd,target),requireSignature);return success(command,{action,...data},[`PASS ${data.publisher}/${data.id}@${data.version}`,`Files: ${data.files}`,`Identities: ${data.identities.length}`]);}
    if (action === "inspect" || action === "verify") { const target = argv.shift(); if (!target) throw new CliError(`catalog ${action} requires <directory>.`); const requireSignature=argv.includes("--require-signature");const filtered=argv.filter((item)=>item!=="--require-signature");const project=parseSinglePath(filtered,"--project",".");const data = requireSignature?await verifyCatalogBundleSignature(starterRoot,path.resolve(cwd,project),path.resolve(cwd,target)):await inspectCatalogBundle(starterRoot,path.resolve(cwd,target)); return success(command, { action, ...data }, [`VERIFIED ${data.publisher}/${data.id}@${data.version}`, `SHA256 ${data.digest}`, `Trust: ${data.trust??(data.signed?"signed-unverified":"unsigned")}`]); }
    if (action === "list") { const project = parseSinglePath(argv, "--project", "."); const catalogs = await listInstalledCatalogs(path.resolve(cwd, project)); return success(command, { action, catalogs }, catalogs.map((item) => `${item.publisher}/${item.id}@${item.version}`)); }
    if (action === "add") { const target = argv.shift(); if (!target) throw new CliError("catalog add requires <directory>."); const requireSignature=argv.includes("--require-signature");const options=parseUpdate(argv.filter((item)=>item!=="--require-signature"));const trust=requireSignature?await verifyCatalogBundleSignature(starterRoot,path.resolve(cwd,options.project),path.resolve(cwd,target)):null; const data = await installCatalogBundle(starterRoot, path.resolve(cwd, options.project), path.resolve(cwd, target), options.apply); return success(command, { action, mode: options.apply ? "apply" : "plan", ...data,...(trust?{trust:{status:trust.trust,keyId:trust.keyId,fingerprint:trust.fingerprint}}:{}) }, [options.apply ? `INSTALLED ${data.publisher}/${data.id}@${data.version}` : `PLAN install ${data.publisher}/${data.id}@${data.version}`, `SHA256 ${data.digest}`]); }
    if (action === "remove") { const identity = argv.shift(); const match = /^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)@([0-9]+\.[0-9]+\.[0-9]+)$/.exec(identity ?? ""); if (!match) throw new CliError("catalog remove requires <publisher>/<id>@<version>."); const options = parseUpdate(argv); const data = await removeInstalledCatalog(path.resolve(cwd, options.project), match[1], match[2], match[3], options.apply); return success(command, { action, mode: options.apply ? "apply" : "plan", ...data }, [options.apply ? `REMOVED ${identity}` : `PLAN remove ${identity}`]); }
    if (action === "active") { const project = parseSinglePath(argv, "--project", "."); const catalogs = await listActiveCatalogs(path.resolve(cwd, project)); return success(command, { action, catalogs }, catalogs.map((item) => `${item.publisher}/${item.id}@${item.version} [${item.identities.length} identities]`)); }
    if (action === "activate" || action === "deactivate") { const identity = argv.shift(); const match = /^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)@([0-9]+\.[0-9]+\.[0-9]+)$/.exec(identity ?? ""); if (!match) throw new CliError(`catalog ${action} requires <publisher>/<id>@<version>.`); const options = parseUpdate(argv); const project = path.resolve(cwd, options.project); const data = action === "activate" ? await activateCatalog(starterRoot, project, match[1], match[2], match[3], options.apply) : await deactivateCatalog(project, match[1], match[2], match[3], options.apply); return success(command, { action, mode: options.apply ? "apply" : "plan", ...data }, [options.apply ? `${action === "activate" ? "ACTIVATED" : "DEACTIVATED"} ${identity}` : `PLAN ${action} ${identity}`]); }
    if(action==="switch"){const identity=argv.shift();const match=/^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)@([0-9]+\.[0-9]+\.[0-9]+)$/.exec(identity??"");if(!match)throw new CliError("catalog switch requires <publisher>/<id>@<version>.");const options=parseUpdate(argv);const data=await switchCatalogVersion(starterRoot,path.resolve(cwd,options.project),match[1],match[2],match[3],options.apply);return success(command,{action,mode:options.apply?"apply":"plan",...data},[options.apply?`SWITCHED ${data.from} -> ${data.to}`:`PLAN switch ${data.from} -> ${data.to}`]);}
    if(action==="rollback"){const identity=argv.shift();const match=/^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(identity??"");if(!match)throw new CliError("catalog rollback requires <publisher>/<id>.");const options=parseUpdate(argv);const data=await rollbackCatalogVersion(starterRoot,path.resolve(cwd,options.project),match[1],match[2],options.apply);return success(command,{action,mode:options.apply?"apply":"plan",...data},[options.apply?`ROLLED BACK ${data.from} -> ${data.to}`:`PLAN rollback ${data.from} -> ${data.to}`]);}
    throw new CliError("catalog requires create, pack, sign, test, inspect, verify, add, list, remove, activate, deactivate, active, switch, or rollback.");
  }
  if(command==="trust"){const action=argv.shift();if(action==="list"){const project=parseSinglePath(argv,"--project",".");const store=await readTrustStore(path.resolve(cwd,project));return success(command,{action,keys:store.keys},store.keys.map((key)=>`${key.publisher}/${key.keyId} [${key.status}] ${key.fingerprint}`));}if(action==="inspect"){const publisher=argv.shift();const project=parseSinglePath(argv,"--project",".");const keys=(await readTrustStore(path.resolve(cwd,project))).keys.filter((key)=>key.publisher===publisher);if(!keys.length)throw new CliError("Trusted publisher was not found.","TRUST_PUBLISHER_NOT_FOUND");return success(command,{action,publisher,keys},keys.map((key)=>`${key.publisher}/${key.keyId} [${key.status}]`));}if(action==="add"){const keyFile=argv.shift();if(!keyFile)throw new CliError("trust add requires <publisher-key.json>.");const options=parseUpdate(argv);const data=await addTrustedKey(path.resolve(cwd,options.project),path.resolve(cwd,keyFile),options.apply);return success(command,{action,mode:options.apply?"apply":"plan",...data},[options.apply?`TRUSTED ${data.entry.publisher}/${data.entry.keyId}`:`PLAN trust ${data.entry.publisher}/${data.entry.keyId}`]);}if(action==="revoke"){const identity=argv.shift();const match=/^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(identity??"");if(!match)throw new CliError("trust revoke requires <publisher>/<keyId>.");const options=parseUpdate(argv);const data=await revokeTrustedKey(path.resolve(cwd,options.project),match[1],match[2],options.apply);return success(command,{action,mode:options.apply?"apply":"plan",...data},[options.apply?`REVOKED ${identity}`:`PLAN revoke ${identity}`]);}throw new CliError("trust requires list, inspect, add, or revoke.");}
  if (command === "doctor") {
    const project = parseSinglePath(argv, "--project", ".");
    const projectRoot=path.resolve(cwd,project);const diagnosis = await diagnoseProject(await createLifecycleCatalog(starterRoot,projectRoot),projectRoot,{ probeExecutable: context.probeExecutable });
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
  let command = argv.shift();
  if(command==="--version"||command==="-V")command="version";
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
