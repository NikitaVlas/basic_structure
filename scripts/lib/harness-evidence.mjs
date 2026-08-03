import { createHash } from "node:crypto";
import path from "node:path";
import { readJson } from "./configuration.mjs";
import { checkProjectGate } from "./gates.mjs";
import { listActiveCatalogs } from "./catalog-activation.mjs";

function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonical(value[key])]));return value;}
export async function createHarnessEvidence(starterRoot,projectRoot,options={}){
  const root=path.resolve(projectRoot);const[state,gate,activeCatalogs]=await Promise.all([readJson(path.join(root,".basic-structure","state.json")),checkProjectGate(starterRoot,root,options),listActiveCatalogs(root)]);
  const evidence={schemaVersion:1,projectRoot:root,compliant:gate.compliant,state:{schemaVersion:state.schemaVersion,starterVersion:state.starterVersion,extensionVersions:state.extensionVersions,extensionProvenance:state.extensionProvenance},catalogs:activeCatalogs.map(({activatedAt,...entry})=>entry),checks:gate.checks};
  const digest=createHash("sha256").update(JSON.stringify(canonical(evidence))).digest("hex");
  return{...evidence,digest:{algorithm:"sha256",value:digest}};
}
