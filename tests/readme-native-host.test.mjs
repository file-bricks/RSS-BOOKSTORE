import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('README documents the native host install flow', () => {
  const requiredFragments = [
    'install_nm_host.ps1',
    '-ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '-DryRun',
    '-Uninstall',
    'com.file_bricks.rss_bookstore',
    '_native_host\\nm_manifest.generated.json',
    '_native_host\\nm_host.bat',
    'PYTHONIOENCODING=utf-8',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(readme.includes(fragment), `README is missing: ${fragment}`);
  }
});

test('README keeps RSS-BOOKSTORE distribution boundary explicit', () => {
  assert.match(readme, /GitHub\/sideloading distribution/);
  assert.match(readme, /Native Messaging host requires a local registry entry/);
});
