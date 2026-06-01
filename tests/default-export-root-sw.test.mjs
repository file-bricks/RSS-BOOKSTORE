import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

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

test("native folder watch resolves and persists the default OneDrive export root", async () => {
  const defaultPath = "C:/Users/User/OneDrive/RSS-BOOKSTORE";
  const posted = [];
  const store = {
    settings: {
      mode: "SYNC",
      exportRoot: "",
      nativeHostName: "test.host",
      nativeTimeoutMs: 100
    },
    feeds: {}
  };

  globalThis.chrome = {
    alarms: {
      onAlarm: { addListener() {} },
      async get() { return null; },
      async clear() {},
      async create() {}
    },
    bookmarks: {
      onRemoved: { addListener() {} }
    },
    notifications: {
      async create() {}
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      onStartup: { addListener() {} },
      connectNative(hostName) {
        assert.equal(hostName, "test.host");
        const onMessage = createEventTarget();
        const onDisconnect = createEventTarget();
        return {
          onMessage,
          onDisconnect,
          postMessage(message) {
            posted.push(message);
            queueMicrotask(() => {
              if (message.cmd === "get_default_export_root") {
                onMessage.emit({
                  ok: true,
                  requestId: message.requestId,
                  exportRoot: defaultPath
                });
                return;
              }
              if (message.cmd === "watch_folder") {
                onMessage.emit({
                  ok: true,
                  requestId: message.requestId,
                  watching: true,
                  baseDir: message.baseDir
                });
              }
            });
          },
          disconnect() {}
        };
      }
    },
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(keys.map(key => [key, store[key]]));
        },
        async set(patch) {
          Object.assign(store, patch);
        }
      }
    }
  };

  const module = await import(`../sw.js?default-export-root=${Date.now()}`);
  const response = await module.ensureNativeFolderWatch();

  assert.equal(response.watching, true);
  assert.deepEqual(posted.map(message => message.cmd), [
    "get_default_export_root",
    "watch_folder"
  ]);
  assert.equal(posted[0].folderName, "RSS-BOOKSTORE");
  assert.equal(posted[0].create, true);
  assert.equal(posted[1].baseDir, defaultPath);
  assert.equal(store.settings.exportRoot, defaultPath);

  module.stopNativeFolderWatch();
});
