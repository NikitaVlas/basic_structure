import { createHash, createPublicKey, verify } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJson, validateExtensionManifest } from "./configuration.mjs";
import { parseSemver, parseSemverRange, satisfiesSemver } from "./semver.mjs";
import { readTrustStore } from "./trust-store.mjs";

const ID = /^[a-z][a-z0-9-]*$/;
const MAX_FILES = 1000;
const MAX_BYTES = 50 * 1024 * 1024;

export class CatalogBundleError extends Error { constructor(message, code = "CATALOG_BUNDLE_INVALID", exitCode = 1, data) { super(message); this.code = code; this.exitCode = exitCode; this.data = data; } }
function safeRelative(value) { return typeof value === "string" && value && !path.isAbsolute(value) && !value.split(/[\\/]/).includes("..") && !value.includes("\\") && !value.startsWith("/"); }
async function digest(file) { return createHash("sha256").update(await readFile(file)).digest("hex"); }

async function walk(root, relative = "") {
  const current = path.join(root, relative); const info = await lstat(current);
  if (info.isSymbolicLink()) throw new CatalogBundleError(`Symbolic links are forbidden: ${relative || "."}.`);
  if (info.isFile()) return [{ path: relative.split(path.sep).join("/"), size: info.size }];
  if (!info.isDirectory()) throw new CatalogBundleError(`Unsupported bundle entry: ${relative}.`);
  const files = []; for (const entry of await readdir(current, { withFileTypes: true })) files.push(...await walk(root, path.join(relative, entry.name))); return files;
}

function manifestLocation(relative) {
  const data=/^(presets|policies)\/([a-z][a-z0-9-]*)\.json$/.exec(relative);if(data)return{kind:data[1]==="presets"?"preset":"policy",id:data[2],validName:true};
  const match = /^(profiles|modules|adapters)\/([a-z][a-z0-9-]*)\/(profile|module|adapter)\.json$/.exec(relative);
  if (!match) return null; const kind = match[1] === "profiles" ? "profile" : match[1] === "modules" ? "module" : "adapter"; return { kind, id: match[2], validName: match[3] === kind };
}

export async function inspectCatalogBundle(starterRoot, bundleRoot) {
  const root = path.resolve(bundleRoot); const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new CatalogBundleError("Bundle must be a regular local directory.");
  const metadata = await readJson(path.join(root, "catalog.json"));
  if (metadata.schemaVersion !== 1 || !ID.test(metadata.publisher ?? "") || !ID.test(metadata.id ?? "")) throw new CatalogBundleError("Invalid catalog identity or schema version.");
  try { parseSemver(metadata.version); parseSemverRange(metadata.cli); } catch { throw new CatalogBundleError("Catalog version and cli range must be valid semantic versions."); }
  const packageVersion = (await readJson(path.join(starterRoot, "package.json"))).version;
  if (!satisfiesSemver(packageVersion, metadata.cli)) throw new CatalogBundleError(`Bundle requires CLI ${metadata.cli}, installed ${packageVersion}.`, "CATALOG_CLI_INCOMPATIBLE");
  if (!metadata.files || typeof metadata.files !== "object" || Array.isArray(metadata.files)) throw new CatalogBundleError("catalog.files must map paths to SHA-256 digests.");
  const walked = await walk(root);
  const files = walked.filter((entry) => entry.path !== "catalog.json" && entry.path !== "signature.json");
  if (files.length > MAX_FILES || files.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) throw new CatalogBundleError("Bundle exceeds file-count or size limits.");
  const declared = Object.keys(metadata.files).sort(); const actual = files.map((file) => file.path).sort();
  const allowedControl = new Set(["catalog.json", "signature.json"]); if (walked.some((entry)=>!files.includes(entry)&&!allowedControl.has(entry.path))) throw new CatalogBundleError("Unexpected control file.");
  if (declared.some((file) => !safeRelative(file)) || JSON.stringify(declared) !== JSON.stringify(actual)) throw new CatalogBundleError("Declared files must exactly match safe regular bundle files.");
  for (const relative of declared) if (!/^[a-f0-9]{64}$/.test(metadata.files[relative]) || await digest(path.join(root, relative)) !== metadata.files[relative]) throw new CatalogBundleError(`Checksum mismatch: ${relative}.`, "CATALOG_CHECKSUM_MISMATCH");
  const builtIns = new Set(); for(const kind of ["profile","module","adapter"]){const parent=path.join(starterRoot,`${kind}s`);if(!(await pathExists(parent)))continue;for(const entry of await readdir(parent,{withFileTypes:true}))if(entry.isDirectory())builtIns.add(`${kind}:${entry.name}`);} for(const [folder,kind] of [["presets","preset"],["policies","policy"]]){const parent=path.join(starterRoot,folder);if(!(await pathExists(parent)))continue;for(const entry of await readdir(parent,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith(".json"))builtIns.add(`${kind}:${entry.name.slice(0,-5)}`);} const identities = [];
  for (const relative of declared) { const location = manifestLocation(relative); if (!location) continue; if (!location.validName) throw new CatalogBundleError(`Manifest kind/path mismatch: ${relative}.`); const manifest = await readJson(path.join(root, relative)); let errors=[];if(["profile","module","adapter"].includes(location.kind))errors=validateExtensionManifest(manifest, location.kind, location.id);else if(manifest.schemaVersion!==1||manifest.id!==location.id)errors.push("schemaVersion and id must match the catalog path");else if(location.kind==="preset"&&(!Array.isArray(manifest.extends)||!manifest.profile||typeof manifest.modules!=="object"||typeof manifest.adapters!=="object"))errors.push("preset composition metadata is invalid");else if(location.kind==="policy"&&(!["error","warning"].includes(manifest.severity)||!Array.isArray(manifest.appliesWhen)||!Array.isArray(manifest.requiresCapabilities)||!Array.isArray(manifest.requiresFiles)||!Array.isArray(manifest.requiresScripts)))errors.push("policy evidence metadata is invalid"); if (errors.length) throw new CatalogBundleError(`Invalid ${location.kind}:${location.id}: ${errors.join("; ")}`); const identity = `${location.kind}:${location.id}`; if (builtIns.has(identity) || identities.includes(identity)) throw new CatalogBundleError(`Catalog identity collision: ${identity}.`, "CATALOG_IDENTITY_COLLISION"); identities.push(identity); }
  const bundleHash = createHash("sha256"); for (const relative of declared) { bundleHash.update(relative); bundleHash.update("\0"); bundleHash.update(metadata.files[relative]); bundleHash.update("\0"); }
  return { root, publisher: metadata.publisher, id: metadata.id, version: metadata.version, cli: metadata.cli, files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0), identities: identities.sort(), digest: bundleHash.digest("hex"), signed: await pathExists(path.join(root,"signature.json")) };
}

export async function verifyCatalogBundleSignature(starterRoot,projectRoot,bundleRoot){const bundle=await inspectCatalogBundle(starterRoot,bundleRoot);if(!bundle.signed)throw new CatalogBundleError("Catalog signature is required.","CATALOG_SIGNATURE_REQUIRED");const signature=await readJson(path.join(bundle.root,"signature.json"));if(signature.schemaVersion!==1||signature.algorithm!=="ed25519"||signature.publisher!==bundle.publisher||!ID.test(signature.keyId??"")||signature.bundleDigest!==`sha256:${bundle.digest}`)throw new CatalogBundleError("Invalid catalog signature metadata.","CATALOG_SIGNATURE_INVALID");const store=await readTrustStore(projectRoot);const key=store.keys.find((entry)=>entry.publisher===bundle.publisher&&entry.keyId===signature.keyId);if(!key)throw new CatalogBundleError("Publisher key is not trusted.","CATALOG_PUBLISHER_UNTRUSTED");if(key.status==="revoked")throw new CatalogBundleError("Publisher key is revoked.","CATALOG_PUBLISHER_REVOKED");let bytes;try{bytes=Buffer.from(signature.signature,"base64");if(!bytes.length||bytes.toString("base64")!==signature.signature)throw new Error();}catch{throw new CatalogBundleError("Signature must be canonical base64.","CATALOG_SIGNATURE_INVALID");}const publicKey=createPublicKey(key.publicKey);if(publicKey.asymmetricKeyType!=="ed25519"||!verify(null,Buffer.from(signature.bundleDigest,"utf8"),publicKey,bytes))throw new CatalogBundleError("Catalog signature verification failed.","CATALOG_SIGNATURE_INVALID");return{...bundle,trust:"trusted",keyId:signature.keyId,fingerprint:key.fingerprint};}

function cacheRoot(projectRoot) { return path.join(path.resolve(projectRoot), ".basic-structure", "catalogs"); }
export async function listInstalledCatalogs(projectRoot) { const root = cacheRoot(projectRoot); if (!(await pathExists(root))) return []; const results = []; for (const publisher of await readdir(root, { withFileTypes: true })) if (publisher.isDirectory()) for (const id of await readdir(path.join(root, publisher.name), { withFileTypes: true })) if (id.isDirectory()) for (const version of await readdir(path.join(root, publisher.name, id.name), { withFileTypes: true })) if (version.isDirectory()) results.push({ publisher: publisher.name, id: id.name, version: version.name, root: path.join(root, publisher.name, id.name, version.name) }); return results.sort((a,b)=>`${a.publisher}/${a.id}/${a.version}`.localeCompare(`${b.publisher}/${b.id}/${b.version}`)); }
export async function installCatalogBundle(starterRoot, projectRoot, bundleRoot, apply) { const bundle = await inspectCatalogBundle(starterRoot, bundleRoot); const destination = path.join(cacheRoot(projectRoot), bundle.publisher, bundle.id, bundle.version); if (await pathExists(destination)) throw new CatalogBundleError("Immutable catalog version is already installed.", "CATALOG_ALREADY_INSTALLED"); if (apply) { await mkdir(path.dirname(destination), { recursive: true }); await cp(bundle.root, destination, { recursive: true, errorOnExist: true }); } return { ...bundle, destination, applied: Boolean(apply) }; }
export async function removeInstalledCatalog(projectRoot, publisher, id, version, apply) { for (const value of [publisher,id]) if (!ID.test(value ?? "")) throw new CatalogBundleError("Publisher and catalog id must be valid."); try { parseSemver(version); } catch { throw new CatalogBundleError("Catalog version must be semantic."); } const destination = path.join(cacheRoot(projectRoot), publisher, id, version); if (!(await pathExists(destination))) throw new CatalogBundleError("Installed catalog version was not found.", "CATALOG_NOT_INSTALLED"); const activationFile=path.join(cacheRoot(projectRoot),"active.json"); if(await pathExists(activationFile)){const state=await readJson(activationFile);if(state.catalogs?.some((entry)=>entry.publisher===publisher&&entry.id===id&&entry.version===version))throw new CatalogBundleError("Active catalog must be deactivated before removal.","CATALOG_ACTIVE");} if (apply) await rm(destination, { recursive: true, force: false }); return { publisher,id,version,destination,applied:Boolean(apply) }; }
