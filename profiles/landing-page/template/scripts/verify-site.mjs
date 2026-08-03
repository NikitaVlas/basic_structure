import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
for(const pattern of[/<title>[^<]+<\/title>/,/<meta name="description" content="[^"]+">/,/<link rel="canonical" href="https?:\/\//,/<h1>[^<]+<\/h1>/])assert.match(html,pattern);
await Promise.all(["robots.txt","sitemap.xml"].map((file)=>readFile(new URL(`../${file}`,import.meta.url))));
console.log("Landing verification passed.");
