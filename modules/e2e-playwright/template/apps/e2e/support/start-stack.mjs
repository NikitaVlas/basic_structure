import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envText = await readFile(path.join(root, ".env.e2e"), "utf8");
const environment = { ...process.env };
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator > 0) environment[line.slice(0, separator)] = line.slice(separator + 1);
}

const commands = [
  ["--import", "tsx", "apps/api/src/server.ts"],
  ["--import", "tsx", "packages/email/src/worker-cli.ts"],
  ["node_modules/vite/bin/vite.js", "apps/webapp", "--host", "127.0.0.1", "--port", "35173", "--strictPort"]
];
const children = commands.map((args) => spawn(process.execPath, args, { cwd: root, env: environment, stdio: "inherit" }));
let stopping = false;
let finish;
const finished = new Promise((resolve) => { finish = resolve; });
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  await Promise.race([
    Promise.all(children.map((child) => new Promise((resolve) => child.once("exit", resolve)))),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
  spawnSync("docker", ["compose", "--project-name", "{{PROJECT_NAME}}-e2e", "-f", "docker-compose.yml", "-f", "compose.email.yml", "-f", "compose.rate-limit.yml", "down", "--volumes", "--remove-orphans"], { cwd: root, stdio: "inherit" });
  finish(exitCode);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void stop(0));
for (const child of children) child.once("exit", (code) => { if (!stopping) void stop(code ?? 1); });
process.exitCode = await finished;
