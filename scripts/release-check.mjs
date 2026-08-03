#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error("Release check must run through npm.");
for(const script of ["test","verify","benchmark","package:check"]){
  console.log(`\n== npm run ${script} ==`);
  const result=spawnSync(process.execPath,[npmCli,"run",script],{cwd:root,stdio:"inherit",windowsHide:true,timeout:180000});
  if(result.error||result.status!==0)throw new Error(`Release check failed at '${script}'.`);
}
console.log("\nRelease readiness gate passed. Public publication still requires an explicit license decision.");
