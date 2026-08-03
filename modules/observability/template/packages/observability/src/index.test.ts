import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "./index.js";
test("redacts common secret fields", () => assert.deepEqual(redact({ token: "secret", requestId: "42" }), { token: "[REDACTED]", requestId: "42" }));
