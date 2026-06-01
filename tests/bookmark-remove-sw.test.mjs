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

test("bookmark removal deletes mapped .url file and clears persisted mapping", async () => {
  const onMessage = createEventTarget();
  const onDisconnect = createEventTarget();
  const posted = [];
  const store = {
    settings: {
      mode: "SYNC",
      exportRoot: "C:/RSS",
      nativeHostName: "test.host",
      nativeTimeoutMs: 100
    },
    feeds: {
      feedA: {
        id: "feedA",
        nativePathByBookmarkId: {
          b1: "C:/RSS/RSS/Feed/Story.url",
          b2: "C:/RSS/RSS/Feed/Other.url"
        }
      }
    }
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
        return {
          onMessage,
          onDisconnect,
          postMessage(message) {
            posted.push(message);
            queueMicrotask(() => {
              onMessage.emit({
                ok: true,
                requestId: message.requestId,
                deleted: message.paths,
                count: message.paths.length
              });
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

  const module = await import(`../sw.js?bookmark-remove=${Date.now()}`);
  const response = await module.handleBookmarkRemoved("b1", {
    node: { title: "Story", url: "https://example.test/story" }
  });

  assert.equal(response.ok, true);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].cmd, "delete_paths");
  assert.equal(posted[0].baseDir, "C:/RSS");
  assert.deepEqual(posted[0].paths, ["C:/RSS/RSS/Feed/Story.url"]);
  assert.deepEqual(store.feeds.feedA.nativePathByBookmarkId, {
    b2: "C:/RSS/RSS/Feed/Other.url"
  });
});
