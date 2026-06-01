import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("manifest uses per-feed optional host permissions", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
});
