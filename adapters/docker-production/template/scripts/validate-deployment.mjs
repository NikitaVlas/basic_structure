import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [apiDockerfile, webDockerfile, compose, nginx, dockerignore, environment] = await Promise.all([
  readFile("Dockerfile.api-worker", "utf8"), readFile("Dockerfile.webapp", "utf8"),
  readFile("docker-compose.production.yml", "utf8"), readFile("deploy/nginx.conf", "utf8"),
  readFile(".dockerignore", "utf8"), readFile(".env.production.example", "utf8")
]);
for (const [name, dockerfile] of [["API", apiDockerfile], ["web", webDockerfile]]) {
  assert.match(dockerfile, /USER (node|101)/, `${name} runtime must be non-root`);
  assert.match(dockerfile, /HEALTHCHECK/, `${name} image must define a health check`);
  assert.doesNotMatch(dockerfile, /COPY .*\.env/, `${name} image must not copy environment files explicitly`);
}
for (const service of ["migrate", "api", "worker", "web"]) assert.match(compose, new RegExp(`\\n  ${service}:`), `missing ${service} service`);
assert.match(compose, /service_completed_successfully/);
assert.match(compose, /no-new-privileges:true/);
assert.match(compose, /cap_drop: \[ALL\]/);
assert.match(compose, /internal: true/);
assert.doesNotMatch(compose, /5432:5432|6379:6379/);
assert.match(nginx, /location = \/metrics \{ return 404; \}/);
for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy"]) assert.match(nginx, new RegExp(header));
for (const ignored of [".git", ".env.*", "**/node_modules", "work"]) assert.ok(dockerignore.includes(ignored));
for (const required of ["APP_ORIGIN", "DATABASE_URL", "POSTGRES_PASSWORD", "VALKEY_PASSWORD", "RATE_LIMIT_KEY_SECRET", "IP_HASH_SECRET", "EMAIL_OUTBOX_ENCRYPTION_KEY", "APP_IMAGE", "WEB_IMAGE"]) assert.match(environment, new RegExp(`^${required}=`, "m"));
assert.doesNotMatch(environment, /localhost:54329|local-development-only/);
console.log("Production deployment contract is valid.");
