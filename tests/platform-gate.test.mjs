import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const gateDoc = await readFile(
  new URL('../MACOS_LINUX_NATIVE_HOST_GATE.md', import.meta.url),
  'utf8',
);
const nativeHostEntries = await readdir(
  new URL('../native_host/', import.meta.url),
);

test('macOS and Linux native host scope is demand-gated', () => {
  assert.match(gateDoc, /belegte Nutzer-Nachfrage/);
  assert.match(gateDoc, /Kein macOS-\/Linux-Native-Host ohne belegte Nutzer-Nachfrage/);
});

test('no placeholder macOS or Linux host installer is shipped', () => {
  const forbidden = nativeHostEntries.filter((name) =>
    /(?:mac|darwin|linux|unix|posix|sh)$/i.test(name),
  );

  assert.deepEqual(forbidden, []);
});
