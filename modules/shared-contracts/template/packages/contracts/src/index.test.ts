import assert from "node:assert/strict";
import test from "node:test";
import { healthResponse } from "./index.js";
test("health response preserves its contract", () => assert.deepEqual(healthResponse("ok"), { status: "ok" }));
