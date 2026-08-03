import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const [compose, nginx, apiDockerfile, webDockerfile, codeql, dependencies, repositoryScan, containerScan] = await Promise.all([
  readFile("docker-compose.production.yml", "utf8"), readFile("deploy/nginx.conf", "utf8"),
  readFile("Dockerfile.api-worker", "utf8"), readFile("Dockerfile.webapp", "utf8"),
  readFile(".github/workflows/codeql.yml", "utf8"), readFile(".github/workflows/dependency-review.yml", "utf8"),
  readFile(".github/workflows/repository-security.yml", "utf8"), readFile(".github/workflows/container-security.yml", "utf8")
]);
for (const dockerfile of [apiDockerfile, webDockerfile]) {
  assert.match(dockerfile, /USER (node|101)/);
  assert.match(dockerfile, /HEALTHCHECK/);
}
assert.match(compose, /read_only: true/);
assert.match(compose, /no-new-privileges:true/);
assert.match(compose, /cap_drop: \[ALL\]/);
assert.match(compose, /private: \{ internal: true \}/);
assert.doesNotMatch(compose, /5432:5432|6379:6379/);
for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) assert.match(nginx, new RegExp(header));
assert.match(nginx, /location = \/metrics \{ return 404; \}/);
assert.match(codeql, /github\/codeql-action\/init@v4/);
assert.match(dependencies, /dependency-review-action@v4/);
assert.match(repositoryScan, /scanners: secret,misconfig/);
assert.doesNotMatch(repositoryScan, /ignore|skip-dirs|skip-files/);
assert.match(containerScan, /severity: HIGH,CRITICAL/);
assert.match(containerScan, /format: cyclonedx/);

for (const [variable, expectedUser] of [["SECURITY_APP_IMAGE", "node"], ["SECURITY_WEB_IMAGE", "101"]]) {
  const image = process.env[variable];
  if (!image) continue;
  const user = execFileSync("docker", ["image", "inspect", image, "--format", "{{.Config.User}}"], { encoding: "utf8" }).trim();
  assert.equal(user, expectedUser);
  const health = execFileSync("docker", ["image", "inspect", image, "--format", "{{json .Config.Healthcheck}}"], { encoding: "utf8" }).trim();
  assert.notEqual(health, "null");
}
console.log("Production security posture is valid.");
