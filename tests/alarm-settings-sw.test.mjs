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

test("settings restart updates an existing alarm interval", async () => {
  let messageListener = null;
  const calls = {
    clear: [],
    create: [],
    get: []
  };
  const store = {
    settings: {
      mode: "BOOKMARKS",
      globalIntervalMinutes: 30,
      exportRoot: ""
    },
    feeds: {}
  };

  globalThis.chrome = {
    alarms: {
      onAlarm: { addListener() {} },
      async get(name) {
        calls.get.push(name);
        return { name, periodInMinutes: 5 };
      },
      async clear(name) {
        calls.clear.push(name);
        return true;
      },
      async create(name, options) {
        calls.create.push({ name, options });
      }
    },
    bookmarks: {
      onRemoved: { addListener() {} }
    },
    notifications: {
      async create() {}
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      },
      onStartup: { addListener() {} },
      connectNative() {
        throw new Error("connectNative should not be used in BOOKMARKS mode");
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

  await import(`../sw.js?alarm-settings=${Date.now()}`);
  assert.equal(typeof messageListener, "function");

  const response = await new Promise((resolve) => {
    const keepAlive = messageListener({ action: "restartNativeWatch" }, {}, resolve);
    assert.equal(keepAlive, true);
  });

  assert.deepEqual(response, {
    ok: true,
    watch: { ok: true, watching: false, skipped: "mode" }
  });
  assert.deepEqual(calls.get, ["rss-book-tick"]);
  assert.deepEqual(calls.clear, ["rss-book-tick"]);
  assert.deepEqual(calls.create, [
    {
      name: "rss-book-tick",
      options: { periodInMinutes: 30 }
    }
  ]);
});
