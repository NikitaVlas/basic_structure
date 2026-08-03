import assert from "node:assert/strict";

const baseUrl = (process.env.DEPLOYMENT_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const ready = await fetch(`${baseUrl}/ready`);
assert.equal(ready.status, 200);
assert.deepEqual(await ready.json(), { status: "ok", database: "connected" });
const page = await fetch(`${baseUrl}/`);
assert.equal(page.status, 200);
assert.match(page.headers.get("content-security-policy") ?? "", /default-src 'self'/);
assert.equal(page.headers.get("x-content-type-options"), "nosniff");
assert.equal(page.headers.get("x-frame-options"), "DENY");
assert.equal((await fetch(`${baseUrl}/metrics`)).status, 404);
console.log("Production deployment smoke passed.");
