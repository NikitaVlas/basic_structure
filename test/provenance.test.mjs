import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateCatalogDigest, getPackageProvenance } from "../scripts/lib/provenance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("catalog provenance is deterministic and package-scoped", async () => {
  const first = await calculateCatalogDigest(root);
  const second = await calculateCatalogDigest(root);
  assert.deepEqual(first, second);
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.ok(first.files > 100);
  const provenance = await getPackageProvenance(root);
  assert.equal(provenance.package.name, "@basic-structure/cli");
  assert.equal(provenance.schemas.state, 4);
  assert.equal(provenance.catalog.digest, first.digest);
});
