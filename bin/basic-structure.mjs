#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../scripts/lib/cli.mjs";

const starterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await runCli({ argv: process.argv.slice(2), cwd: process.cwd(), starterRoot });

