import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { createNativeClient } from "../lib/native.js";

const originalChrome = globalThis.chrome;

afterEach(() => {
  if (originalChrome === undefined) {
    delete globalThis.chrome;
  } else {
    globalThis.chrome = originalChrome;
  }
});

function createEventTarget() {
  const listeners = new Set();
  return {
    addListener(listener) {
      listeners.add(listener);
    },
    emit(message) {
      for (const listener of listeners) {
        listener(message);
      }
    }
  };
}

test("native client sends folder polling and watch commands", async () => {
  const posted = [];
  const onMessage = createEventTarget();
  const onDisconnect = createEventTarget();

  globalThis.chrome = {
    runtime: {
      connectNative(hostName) {
        assert.equal(hostName, "test.host");
        return {
          onMessage,
          onDisconnect,
          postMessage(message) {
            posted.push(message);
            queueMicrotask(() => onMessage.emit({ ok: true, requestId: message.requestId, state: {} }));
          },
          disconnect() {}
        };
      }
    }
  };

  const client = createNativeClient("test.host");

  await client.pollFolderChanges("C:/RSS", { "old.url": { relativePath: "old.url" } }, { timeoutMs: 100 });
  await client.watchFolder("C:/RSS", { intervalMs: 500, maxPolls: 0, timeoutMs: 100 });
  await client.deletePaths(["C:/RSS/old.url"], { baseDir: "C:/RSS", timeoutMs: 100 });
  await client.getDefaultExportRoot({ folderName: "RSS-BOOKSTORE", create: true, timeoutMs: 100 });

  assert.equal(posted[0].cmd, "poll_folder_changes");
  assert.equal(posted[0].baseDir, "C:/RSS");
  assert.deepEqual(posted[0].knownState, { "old.url": { relativePath: "old.url" } });
  assert.equal(posted[1].cmd, "watch_folder");
  assert.equal(posted[1].intervalMs, 500);
  assert.equal(posted[1].maxPolls, 0);
  assert.equal(posted[2].cmd, "delete_paths");
  assert.equal(posted[2].baseDir, "C:/RSS");
  assert.deepEqual(posted[2].paths, ["C:/RSS/old.url"]);
  assert.equal(posted[3].cmd, "get_default_export_root");
  assert.equal(posted[3].folderName, "RSS-BOOKSTORE");
  assert.equal(posted[3].create, true);

  client.disconnect();
});
