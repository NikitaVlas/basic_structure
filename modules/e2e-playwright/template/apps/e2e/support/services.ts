import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const compose = ["--project-name", "{{PROJECT_NAME}}-e2e", "-f", "docker-compose.yml", "-f", "compose.email.yml", "-f", "compose.rate-limit.yml"];

async function docker(...args: string[]) {
  await execute("docker", ["compose", ...compose, ...args], { cwd: root, timeout: 120_000 });
}

export async function globalSetup() {
  await docker("down", "--volumes", "--remove-orphans").catch(() => undefined);
  try {
    await docker("up", "-d", "--wait", "postgres-test", "mailpit", "valkey");
    const envFile = path.join(root, ".env.e2e");
    await execute(process.execPath, [`--env-file=${envFile}`, "--import", "tsx", "packages/database/src/migrate-cli.ts"], { cwd: root, timeout: 30_000 });
  } catch (error) {
    await docker("down", "--volumes", "--remove-orphans").catch(() => undefined);
    throw error;
  }
}

export async function globalTeardown() {
  // The web-server supervisor removes containers after its children stop.
}
