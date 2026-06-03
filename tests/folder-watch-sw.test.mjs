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

function createStore() {
  return {
    settings: {
      mode: "SYNC",
      exportRoot: "C:/RSS",
      nativeHostName: "test.host",
      nativeTimeoutMs: 100
    },
    feeds: {
      feedA: {
        id: "feedA",
        title: "Tech Feed",
        url: "https://example.test/feed.xml",
        bookmarkFolderId: "folder-feed-a",
        seen: {},
        nativePathByBookmarkId: {
          b1: "C:/RSS/RSS/Tech Feed/Old Story.url"
        }
      }
    }
  };
}

function installChromeMock(store, calls, options = {}) {
  globalThis.chrome = {
    alarms: {
      onAlarm: { addListener() {} },
      async get() { return null; },
      async clear() {},
      async create() {}
    },
    bookmarks: {
      onRemoved: { addListener() {} },
      async get(id) {
        calls.get.push(id);
        if (id === "folder-feed-a") return [{ id, title: "Tech Feed" }];
        if (id === "b1") return [{ id, title: "Old Story", url: "https://example.test/old" }];
        throw new Error(`bookmark not found: ${id}`);
      },
      async create(payload) {
        calls.create.push(payload);
        return { id: "b2", title: payload.title, url: payload.url };
      },
      async update(id, patch) {
        calls.update.push({ id, patch });
        if (options.failUpdate) {
          throw new Error("bookmark missing");
        }
        return { id, ...patch };
      },
      async remove(id) {
        calls.remove.push(id);
      }
    },
    notifications: {
      async create() {}
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      onStartup: { addListener() {} },
      connectNative() {
        throw new Error("connectNative should not be called by folder event handling");
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
}

test("folder change events mirror added, modified, and removed shortcuts into bookmarks", async () => {
  const store = createStore();
  const calls = { create: [], get: [], remove: [], update: [] };
  installChromeMock(store, calls);

  const module = await import(`../sw.js?folder-watch=${Date.now()}`);

  await module.handleNativeFolderEvent({
    event: "folder_changed",
    changes: {
      added: [
        {
          relativePath: "RSS/Tech Feed/New Story.url",
          path: "C:/RSS/RSS/Tech Feed/New Story.url",
          title: "New Story",
          href: "https://example.test/new"
        }
      ],
      modified: [
        {
          relativePath: "RSS/Tech Feed/Old Story.url",
          path: "C:/RSS/RSS/Tech Feed/Old Story.url",
          title: "Old Story Updated",
          href: "https://example.test/old-updated"
        }
      ],
      removed: [
        {
          relativePath: "RSS/Tech Feed/Old Story.url",
          path: "C:/RSS/RSS/Tech Feed/Old Story.url",
          title: "Old Story",
          href: "https://example.test/old"
        }
      ]
    }
  });

  assert.deepEqual(calls.create, [
    {
      parentId: "folder-feed-a",
      title: "New Story",
      url: "https://example.test/new"
    }
  ]);
  assert.deepEqual(calls.update, [
    {
      id: "b1",
      patch: {
        title: "Old Story Updated",
        url: "https://example.test/old-updated"
      }
    }
  ]);
  assert.deepEqual(calls.remove, ["b1"]);
  assert.deepEqual(store.feeds.feedA.nativePathByBookmarkId, {
    b2: "C:/RSS/RSS/Tech Feed/New Story.url"
  });
  assert.equal(store.feeds.feedA.seen["https://example.test/new"] > 0, true);
  assert.equal(store.feeds.feedA.seen["https://example.test/old-updated"] > 0, true);
});

test("folder change events replace stale native mappings when bookmark update falls back to create", async () => {
  const store = createStore();
  const calls = { create: [], get: [], remove: [], update: [] };
  installChromeMock(store, calls, { failUpdate: true });

  const module = await import(`../sw.js?folder-watch-stale-mapping=${Date.now()}`);

  await module.handleNativeFolderEvent({
    event: "folder_changed",
    changes: {
      modified: [
        {
          relativePath: "RSS/Tech Feed/Old Story.url",
          path: "C:/RSS/RSS/Tech Feed/Old Story.url",
          title: "Old Story Updated",
          href: "https://example.test/old-updated"
        }
      ]
    }
  });

  assert.deepEqual(calls.update, [
    {
      id: "b1",
      patch: {
        title: "Old Story Updated",
        url: "https://example.test/old-updated"
      }
    }
  ]);
  assert.deepEqual(calls.create, [
    {
      parentId: "folder-feed-a",
      title: "Old Story Updated",
      url: "https://example.test/old-updated"
    }
  ]);
  assert.deepEqual(store.feeds.feedA.nativePathByBookmarkId, {
    b2: "C:/RSS/RSS/Tech Feed/Old Story.url"
  });
});

test("folder change events skip unsafe shortcut targets", async () => {
  const store = createStore();
  const calls = { create: [], get: [], remove: [], update: [] };
  installChromeMock(store, calls);

  const module = await import(`../sw.js?folder-watch-unsafe-url=${Date.now()}`);

  const response = await module.handleNativeFolderEvent({
    event: "folder_changed",
    changes: {
      added: [
        {
          relativePath: "RSS/Tech Feed/Unsafe.url",
          path: "C:/RSS/RSS/Tech Feed/Unsafe.url",
          title: "Unsafe",
          href: "javascript:alert(1)"
        },
        {
          relativePath: "RSS/Tech Feed/Injected.url",
          path: "C:/RSS/RSS/Tech Feed/Injected.url",
          title: "Injected",
          href: "https://example.test/a\r\nIconFile=C:\\evil.ico"
        }
      ]
    }
  });

  assert.deepEqual(calls.create, []);
  assert.deepEqual(response.results.added, [
    { ok: true, skipped: "entry" },
    { ok: true, skipped: "entry" }
  ]);
});
