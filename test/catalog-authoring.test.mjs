import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCatalogBundle, packCatalogBundle, signCatalogBundle, testCatalogBundle } from "../scripts/lib/catalog-authoring.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
test("catalog authoring creates packs signs and tests a data-only bundle",async()=>{const temp=await mkdtemp(path.join(os.tmpdir(),"basic-structure-authoring-"));try{const bundle=path.join(temp,"bundle");assert.equal((await createCatalogBundle(bundle,{publisher:"example-vendor",id:"example-catalog",version:"1.0.0",cli:"^0.1.0"},false)).applied,false);await createCatalogBundle(bundle,{publisher:"example-vendor",id:"example-catalog",version:"1.0.0",cli:"^0.1.0"},true);const extension=path.join(bundle,"modules","vendor-feature");await mkdir(path.join(extension,"template"),{recursive:true});await writeFile(path.join(extension,"template","feature.txt"),"feature\n");await writeFile(path.join(extension,"module.json"),`${JSON.stringify({schemaVersion:2,kind:"module",id:"vendor-feature",version:"1.0.0",starter:"^0.1.0",name:"Vendor feature",description:"Vendor feature.",files:"template",capabilities:["vendor-feature"],tags:["vendor"],maturity:"experimental",requires:{},conflicts:[]},null,2)}\n`);const packed=await packCatalogBundle(bundle,true);assert.equal(packed.files,2);const{privateKey}=generateKeyPairSync("ed25519");const keyFile=path.join(temp,"private.pem");await writeFile(keyFile,privateKey.export({type:"pkcs8",format:"pem"}));await signCatalogBundle(root,bundle,keyFile,"release-2026",true);const inspected=await testCatalogBundle(root,temp,bundle,false);assert.equal(inspected.signed,true);assert.deepEqual(inspected.identities,["module:vendor-feature"]);assert.equal((await readFile(keyFile,"utf8")).includes("PRIVATE KEY"),true);}finally{await rm(temp,{recursive:true,force:true});}});
