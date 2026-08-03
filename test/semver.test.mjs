import assert from "node:assert/strict";
import test from "node:test";
import { compareSemver, parseSemver, parseSemverRange, satisfiesSemver } from "../scripts/lib/semver.mjs";

test("semantic versions compare numerically", () => {
  assert.equal(compareSemver("1.10.0", "1.2.9"), 1);
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("0.9.9", "1.0.0"), -1);
});

test("supported semantic version ranges are deterministic", () => {
  assert.equal(satisfiesSemver("1.2.3", "1.2.3"), true);
  assert.equal(satisfiesSemver("1.9.0", "^1.2.3"), true);
  assert.equal(satisfiesSemver("2.0.0", "^1.2.3"), false);
  assert.equal(satisfiesSemver("0.2.9", "^0.2.3"), true);
  assert.equal(satisfiesSemver("0.3.0", "^0.2.3"), false);
  assert.equal(satisfiesSemver("1.2.9", "~1.2.3"), true);
  assert.equal(satisfiesSemver("1.3.0", "~1.2.3"), false);
  assert.equal(satisfiesSemver("1.5.0", ">=1.0.0 <2.0.0"), true);
});

test("unsupported versions and ranges fail closed", () => {
  assert.throws(() => parseSemver("v1.0.0"), /Invalid semantic version/);
  assert.throws(() => parseSemver("1.0.0-beta.1"), /Invalid semantic version/);
  assert.throws(() => parseSemverRange("1.x"), /Invalid semantic version range/);
  assert.throws(() => parseSemverRange(">=1.0.0 || <2.0.0"), /Invalid semantic version range/);
});

