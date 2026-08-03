import assert from "node:assert/strict";
import test from "node:test";
import { createAppServer } from "./server.js";

test("health endpoint returns a typed response", async () => {
  const server = createAppServer().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

{{SLOT:API_TESTS}}
