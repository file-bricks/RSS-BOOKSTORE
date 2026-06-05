import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

function runPackageDryRun() {
  const output = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts\\package_github_release.ps1",
      "-DryRun",
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

test("GitHub release package plan is self-contained", () => {
  const plan = runPackageDryRun();
  const included = new Set(plan.includes.map((entry) => entry.source));

  assert.equal(plan.packageName, "RSS-BOOKSTORE-1.0.0-github");
  assert.match(plan.zipPath, /releases\\v1\.0\.0\\RSS-BOOKSTORE-1\.0\.0-github\.zip$/);
  assert.match(plan.checksumPath, /releases\\v1\.0\.0\\SHA256SUMS\.txt$/);

  for (const expected of [
    "manifest.json",
    "README.md",
    "RELEASES.md",
    "package.json",
    "sw.js",
    "scripts",
    "lib",
    "ui",
    "icons",
    "native_host\\favextract_core.py",
    "native_host\\install_nm_host.ps1",
    "native_host\\nm_host.bat",
    "native_host\\nm_host.py",
    "native_host\\nm_manifest.json",
  ]) {
    assert.ok(included.has(expected), `release plan is missing ${expected}`);
  }

  assert.ok(plan.generated.includes("INSTALL_NATIVE_HOST.txt"));
  assert.ok(plan.installCommands.some((command) => command.includes("-ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")));
  assert.ok(plan.installCommands.some((command) => command.includes("-DryRun")));
  assert.ok(plan.installCommands.some((command) => command.includes("-Uninstall")));
});

test("GitHub release package excludes development-only files", () => {
  const plan = runPackageDryRun();

  for (const excluded of [
    "tests",
    "node_modules",
    ".git",
    ".pytest_cache",
    "__pycache__",
    "releases",
    "native_host\\nm_manifest.generated.json",
  ]) {
    assert.ok(plan.excluded.includes(excluded), `release plan should exclude ${excluded}`);
  }
});

test("GitHub release package omits cache folders inside included directories", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "rss-bookstore-release-"));
  const cacheDir = path.join("scripts", "__pycache__");
  const dummyCache = path.join(cacheDir, "package-exclude-test.pyc");

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(dummyCache, "cache");

  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts\\package_github_release.ps1",
        "-OutputDir",
        outputDir,
      ],
      { encoding: "utf8" },
    );

    const zipPath = path.join(outputDir, "RSS-BOOKSTORE-1.0.0-github.zip");
    const escapedZipPath = zipPath.replaceAll("'", "''");
    const listEntriesScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead('${escapedZipPath}')
try {
  $archive.Entries | ForEach-Object { $_.FullName } | ConvertTo-Json
} finally {
  $archive.Dispose()
}
`;
    const entries = JSON.parse(
      execFileSync("powershell", ["-NoProfile", "-Command", listEntriesScript], { encoding: "utf8" }),
    );

    const normalizedEntries = entries.map((entry) => entry.replaceAll("\\", "/"));
    assert.ok(normalizedEntries.some((entry) => entry.endsWith("scripts/generate_icons.py")));
    assert.equal(normalizedEntries.some((entry) => entry.includes("__pycache__")), false);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(dummyCache, { force: true });
    try {
      if (fs.readdirSync(cacheDir).length === 0) {
        fs.rmdirSync(cacheDir);
      }
    } catch {
      // Best effort cleanup only.
    }
  }
});
