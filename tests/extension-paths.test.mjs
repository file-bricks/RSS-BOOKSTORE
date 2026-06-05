import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredRootEntries = new Set([".git", "node_modules", "releases", ".pytest_cache"]);
const allowedUnderscoreNames = new Set(["_locales"]);
// Python and tooling build artifacts — gitignored, never part of the Chrome extension package
const globallyIgnoredNames = new Set(["__pycache__"]);

async function collectReservedExtensionPaths(directory, relativeDirectory = "") {
  const offenders = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);

    if (!relativeDirectory && ignoredRootEntries.has(entry.name)) {
      continue;
    }

    if (globallyIgnoredNames.has(entry.name)) {
      continue;
    }

    if (entry.name.startsWith("_") && !allowedUnderscoreNames.has(entry.name)) {
      offenders.push(relativePath);
    }

    if (entry.isDirectory()) {
      offenders.push(
        ...(await collectReservedExtensionPaths(path.join(directory, entry.name), relativePath)),
      );
    }
  }

  return offenders;
}

test("unpacked extension path does not contain Chromium-reserved underscore names", async () => {
  const offenders = await collectReservedExtensionPaths(projectRoot);
  assert.deepEqual(offenders, []);
});
