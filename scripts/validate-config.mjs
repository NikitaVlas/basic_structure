#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, resolveConfiguration } from "./lib/configuration.mjs";

const starterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedPath = process.argv[2] ?? "project.config.example.json";
const configPath = path.resolve(process.cwd(), requestedPath);

try {
  const config = await readJson(configPath);
  const resolved = await resolveConfiguration(starterRoot, config);
  console.log(`Configuration is valid: ${config.project.name}`);
  console.log(`Profile: ${resolved.profile.manifest.id}`);
  console.log(`Modules: ${config.modules.join(", ") || "none"}`);
  console.log(`Adapters: ${config.adapters.join(", ") || "none"}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
