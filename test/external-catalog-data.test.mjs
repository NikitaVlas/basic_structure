import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCatalogBundle, packCatalogBundle, signCatalogBundle } from "../scripts/lib/catalog-authoring.mjs";
import { activateCatalog, createLifecycleCatalog } from "../scripts/lib/catalog-activation.mjs";
import { installCatalogBundle } from "../scripts/lib/catalog-bundles.mjs";
import { initializeProject } from "../scripts/lib/initializer.mjs";
import { checkProjectPolicies, listPolicies } from "../scripts/lib/policies.mjs";
import { configurationFromPreset, listPresets, loadPreset } from "../scripts/lib/presets.mjs";
import { addTrustedKey, publicKeyFingerprint } from "../scripts/lib/trust-store.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
test("activated catalogs provide presets and harness policies",async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),"basic-structure-external-data-"));
  try{
    const project=path.join(temp,"project");
    await initializeProject(root,project,{schemaVersion:1,project:{name:"external-data",description:"External data",profile:"documentation-only"},surfaces:[],modules:[],adapters:[],verification:{required:true}});
    const bundle=path.join(temp,"bundle");
    await createCatalogBundle(bundle,{publisher:"example-vendor",id:"data-catalog",version:"1.0.0",cli:"^0.1.0"},true);
    await mkdir(path.join(bundle,"presets"));await mkdir(path.join(bundle,"policies"));
    await writeFile(path.join(bundle,"presets","vendor-docs.json"),`${JSON.stringify({schemaVersion:1,id:"vendor-docs",version:"1.0.0",name:"Vendor docs",description:"External preset.",capabilities:["documentation"],tags:["vendor"],maturity:"stable",extends:[],profile:{id:"documentation-only",version:"^1.0.0"},modules:{},adapters:{}},null,2)}\n`);
    await writeFile(path.join(bundle,"policies","vendor-evidence.json"),`${JSON.stringify({schemaVersion:1,id:"vendor-evidence",version:"1.0.0",name:"Vendor evidence",description:"External policy.",severity:"error",appliesWhen:[],requiresCapabilities:[],requiresFiles:["AGENTS.md"],requiresScripts:[],remediationPreset:"vendor-docs"},null,2)}\n`);
    await packCatalogBundle(bundle,true);
    const{publicKey,privateKey}=generateKeyPairSync("ed25519");const privateFile=path.join(temp,"private.pem");await writeFile(privateFile,privateKey.export({type:"pkcs8",format:"pem"}));await signCatalogBundle(root,bundle,privateFile,"release-2026",true);
    const pem=publicKey.export({type:"spki",format:"pem"});const publicFile=path.join(temp,"publisher.json");await writeFile(publicFile,`${JSON.stringify({schemaVersion:1,publisher:"example-vendor",keyId:"release-2026",algorithm:"ed25519",publicKey:pem,fingerprint:`sha256:${publicKeyFingerprint(pem)}`},null,2)}\n`);
    await addTrustedKey(project,publicFile,true);await installCatalogBundle(root,project,bundle,true);await activateCatalog(root,project,"example-vendor","data-catalog","1.0.0",true);
    const catalog=await createLifecycleCatalog(root,project);const preset=await loadPreset(catalog,"vendor-docs");
    assert.equal(preset.provenance.publisher,"example-vendor");assert.equal((await listPresets(catalog)).some((entry)=>entry.id==="vendor-docs"),true);
    assert.equal((await configurationFromPreset(catalog,preset,{name:"vendor-preset",description:"Vendor preset"})).project.profile,"documentation-only");
    assert.equal((await listPolicies(catalog)).some((entry)=>entry.id==="vendor-evidence"),true);assert.equal((await checkProjectPolicies(catalog,project,{id:"vendor-evidence"})).compliant,true);
  }finally{await rm(temp,{recursive:true,force:true});}
});
