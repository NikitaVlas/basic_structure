#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPackageProvenance } from "./lib/provenance.mjs";
import { listCatalogExtensions, recommendCapabilities } from "./lib/catalog.mjs";
import { listPresets } from "./lib/presets.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const budgets={provenance:5000,catalog:5000,presets:5000,recommendation:5000,total:15000};
const results={};
async function measure(id,operation){const start=performance.now();await operation();results[id]=Math.round((performance.now()-start)*100)/100;if(results[id]>budgets[id])throw new Error(`Performance budget exceeded for ${id}: ${results[id]}ms > ${budgets[id]}ms.`);}
const started=performance.now();
await measure("provenance",()=>getPackageProvenance(root));
await measure("catalog",()=>listCatalogExtensions(root));
await measure("presets",()=>listPresets(root));
await measure("recommendation",()=>recommendCapabilities(root,["authentication","database"],{profile:"fullstack-web"}));
results.total=Math.round((performance.now()-started)*100)/100;
if(results.total>budgets.total)throw new Error(`Total performance budget exceeded: ${results.total}ms > ${budgets.total}ms.`);
console.log(JSON.stringify({schemaVersion:1,budgetsMs:budgets,resultsMs:results},null,2));
