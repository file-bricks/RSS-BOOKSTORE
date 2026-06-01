import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const ICONS = {
  16: "icons/16.png",
  48: "icons/48.png",
  128: "icons/128.png",
};

const PLACEHOLDER_HASHES = new Set([
  "3654ebd2ee1d2f92e5b922235beef89dd21c7ad797af19ccef8ada40eecd6f34",
  "25dc6f9a0023ee942a6625f6189eb053bb28fe2145fbb0ab1b705fff80a5058a",
  "4113fdd7065e238097682597496ab74327815f1c258739ee29d299ae371240e2",
]);

function readPngSize(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("manifest references the generated RSS-BOOKSTORE icon set", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

  assert.deepEqual(manifest.icons, ICONS);
  assert.deepEqual(manifest.action.default_icon, ICONS);
});

test("icon files have correct dimensions and are not the old placeholder", () => {
  for (const [sizeText, path] of Object.entries(ICONS)) {
    const expectedSize = Number(sizeText);
    const buffer = fs.readFileSync(path);
    const dimensions = readPngSize(buffer);

    assert.equal(dimensions.width, expectedSize);
    assert.equal(dimensions.height, expectedSize);
    assert.ok(buffer.length > expectedSize * 20, `${path} is unexpectedly small`);
    assert.equal(PLACEHOLDER_HASHES.has(sha256(buffer)), false, `${path} still uses a placeholder hash`);
  }
});
