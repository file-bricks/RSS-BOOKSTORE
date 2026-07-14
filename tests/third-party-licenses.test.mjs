import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const licenseText = readFileSync(join(projectRoot, "THIRD_PARTY_LICENSES.txt"), "utf8");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

test("third-party license inventory documents dependency-free runtime", () => {
  assert.match(licenseText, /Direct Runtime Dependencies\s+-+\s+None declared\./s);
  assert.match(licenseText, /Chromium extension APIs/);
  assert.match(licenseText, /Python standard-library modules/);
  assert.match(licenseText, /not a frozen transitive SBOM/);
});

test("package manifest has no declared third-party dependency sections", () => {
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    assert.equal(packageJson[field], undefined, `${field} should stay absent until documented`);
  }
});

test("no package lock or python dependency manifest is present without license inventory update", () => {
  for (const relativePath of [
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements.txt",
    "requirements-dev.txt",
    "pyproject.toml",
  ]) {
    assert.equal(existsSync(join(projectRoot, relativePath)), false, `${relativePath} needs inventory coverage`);
  }
});

test("optional Pillow icon helper remains documented as non-runtime", () => {
  const generator = readFileSync(join(projectRoot, "scripts", "generate_icons.py"), "utf8");
  assert.match(generator, /from PIL import Image, ImageDraw, ImageFilter/);
  assert.match(licenseText, /Optional Developer Tools/);
  assert.match(licenseText, /Pillow is not declared/);
  assert.match(licenseText, /not needed to install or run the\s+extension/s);
});
