import path from "node:path";
import { diagnoseProject } from "./doctor.mjs";
import { checkProjectPolicies } from "./policies.mjs";
import { planProjectUpgrade, summarizeUpgradePlan } from "./upgrade.mjs";

function result(id, status, message, details, required = true) { return { id, status, required, message, ...(details === undefined ? {} : { details }) }; }

export async function checkProjectDrift(starterRoot, projectRoot) {
  const root = path.resolve(projectRoot);
  try {
    const plan = await planProjectUpgrade(starterRoot, root);
    const changes = plan.changes.filter((change) => change.status !== "unchanged");
    const extensionChanges = plan.extensionChanges.filter((change) => change.status !== "unchanged");
    const clean = !plan.blocked && !plan.configChange.changed && !changes.length && !extensionChanges.length;
    return { projectRoot: root, clean, blocked: plan.blocked, configChanged: plan.configChange.changed, summary: summarizeUpgradePlan(plan), changes, extensionChanges };
  } catch (error) {
    return { projectRoot: root, clean: false, error: error.message, summary: {}, changes: [], extensionChanges: [] };
  }
}

export async function checkProjectGate(starterRoot, projectRoot, options = {}) {
  const drift = await checkProjectDrift(starterRoot, projectRoot);
  const diagnosis = await diagnoseProject(starterRoot, projectRoot, { probeExecutable: options.probeExecutable });
  let policies;
  try { policies = await checkProjectPolicies(starterRoot, projectRoot); }
  catch (error) { policies = { compliant: false, results: [], error: error.message }; }
  const doctor = new Map(diagnosis.checks.map((check) => [check.id, check]));
  const checks = [
    result("drift", drift.clean ? "pass" : "fail", drift.clean ? "Managed files, configuration, state, and extension versions match the starter." : "Managed project drift was detected.", drift),
    result("configuration", doctor.get("configuration")?.status ?? "fail", doctor.get("configuration")?.message ?? "Configuration could not be checked.", doctor.get("configuration")?.details),
    result("state", doctor.get("state")?.status ?? "fail", doctor.get("state")?.message ?? "Generated state could not be checked.", doctor.get("state")?.details),
    result("policies", policies.compliant ? "pass" : "fail", policies.compliant ? "All applicable harness policies pass." : "Harness policy violations were found.", policies),
    result("environment", ["node", "git", "docker"].some((id) => doctor.get(id)?.required && doctor.get(id)?.status === "fail") ? "fail" : "pass", "Required runtime and tool probes completed.", ["node", "git", "docker"].map((id) => doctor.get(id)).filter(Boolean)),
    result("unfinished-operations", doctor.get("upgrade-reports")?.status ?? "fail", doctor.get("upgrade-reports")?.message ?? "Upgrade reports could not be checked.", doctor.get("upgrade-reports")?.details),
    result("verification-entrypoint", doctor.get("verification-entrypoint")?.status ?? "skip", doctor.get("verification-entrypoint")?.message ?? "Verification entry point is not applicable.", doctor.get("verification-entrypoint")?.details, doctor.get("verification-entrypoint")?.required ?? false)
  ];
  return { schemaVersion: 1, projectRoot: path.resolve(projectRoot), compliant: !checks.some((check) => check.required && check.status === "fail"), checks };
}

