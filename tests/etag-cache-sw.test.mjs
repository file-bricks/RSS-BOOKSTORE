import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const originalDOMParser = globalThis.DOMParser;

afterEach(() => {
  if (originalChrome === undefined) {
    delete globalThis.chrome;
  } else {
    globalThis.chrome = originalChrome;
  }
  if (originalFetch === undefined) {
    delete globalThis.fetch;
  } else {
    globalThis.fetch = originalFetch;
  }
  if (originalDOMParser === undefined) {
    delete globalThis.DOMParser;
  } else {
    globalThis.DOMParser = originalDOMParser;
  }
});

function createEventTarget() {
  const listeners = new Set();
  return {
    addListener(listener) { listeners.add(listener); },
    emit(message) { for (const listener of listeners) listener(message); }
  };
}

function createRssDoc(title, items) {
  return {
    querySelector(selector) {
      if (selector === "parsererror" || selector === "feed") return null;
      if (selector === "rss channel" || selector === "channel") {
        return {
          querySelector(s) {
            if (s === ":scope > title") return { textContent: title };
            return null;
          }
        };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "item") return items;
      return [];
    }
  };
}

function makeItemNode(title, link, guid) {
  return {
    querySelector(selector) {
      switch (selector) {
        case "title": return { textContent: title };
        case "link": return { textContent: link };
        case "guid": return { textContent: guid };
        case "pubDate": return { textContent: "" };
        default: return null;
      }
    }
  };
}

function buildChromeMock(store, messageListenerRef) {
  return {
    alarms: {
      onAlarm: { addListener() {} },
      async get() { return null; },
      async clear() {},
      async create() {}
    },
    bookmarks: {
      onRemoved: { addListener() {} },
      async get(id) { return [{ id, title: "Feed" }]; },
      async create(payload) { return { id: "bm-1", ...payload }; }
    },
    notifications: { async create() {} },
    permissions: { async contains() { return true; } },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) { messageListenerRef.current = listener; }
      },
      onStartup: { addListener() {} },
      connectNative() {
        const onDisconnect = createEventTarget();
        return {
          onMessage: createEventTarget(),
          onDisconnect,
          postMessage() {},
          disconnect() { onDisconnect.emit(); }
        };
      }
    },
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(keys.map(k => [k, store[k]]));
        },
        async set(patch) { Object.assign(store, patch); }
      }
    }
  };
}

test("etag preserved when server returns 200 with all-seen items and no ETag header", async () => {
  const msgRef = { current: null };
  const store = {
    settings: {
      mode: "BOOKMARKS",
      exportRoot: "",
      globalIntervalMinutes: 0
    },
    feeds: {
      feedA: {
        id: "feedA",
        enabled: true,
        notify: false,
        url: "https://example.test/feed.xml",
        title: "Feed",
        bookmarkFolderId: "folder-a",
        seen: { "already-seen-guid": 1000 },
        lastFetch: 0,
        lastEtag: "etag-preserved",
        lastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
        lastError: ""
      }
    }
  };

  globalThis.chrome = buildChromeMock(store, msgRef);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name) {
        // Server returns 200 but no ETag or Last-Modified headers
        return "";
      }
    },
    text: async () => `<rss version="2.0"><channel><title>Feed</title>
      <item><title>Old</title><link>https://example.test/old</link><guid>already-seen-guid</guid></item>
    </channel></rss>`
  });

  globalThis.DOMParser = class {
    parseFromString(text) {
      return createRssDoc("Feed", [makeItemNode("Old", "https://example.test/old", "already-seen-guid")]);
    }
  };

  const module = await import(`../sw.js?etag-cache-all-seen=${Date.now()}`);
  assert.equal(typeof msgRef.current, "function");

  const response = await new Promise(resolve => {
    const alive = msgRef.current({ action: "updateFeed", feedId: "feedA" }, {}, resolve);
    assert.equal(alive, true);
  });

  assert.deepEqual(response, { ok: true });
  // ETag and Last-Modified must be preserved — server returned empty strings, not actual values
  assert.equal(store.feeds.feedA.lastEtag, "etag-preserved",
    "lastEtag must be preserved when server omits ETag header");
  assert.equal(store.feeds.feedA.lastModified, "Mon, 01 Jan 2024 00:00:00 GMT",
    "lastModified must be preserved when server omits Last-Modified header");

  module.stopNativeFolderWatch();
});

test("etag preserved when server returns 200 with new items and no ETag header", async () => {
  const msgRef = { current: null };
  const store = {
    settings: {
      mode: "BOOKMARKS",
      exportRoot: "",
      globalIntervalMinutes: 0
    },
    feeds: {
      feedB: {
        id: "feedB",
        enabled: true,
        notify: false,
        url: "https://example.test/feed2.xml",
        title: "Feed2",
        bookmarkFolderId: "folder-b",
        seen: {},
        lastFetch: 0,
        lastEtag: "etag-still-valid",
        lastModified: "Tue, 01 Jan 2025 00:00:00 GMT",
        lastError: ""
      }
    }
  };

  globalThis.chrome = buildChromeMock(store, msgRef);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get() { return ""; }
    },
    text: async () => `<rss version="2.0"><channel><title>Feed2</title>
      <item><title>Fresh</title><link>https://example.test/fresh</link><guid>fresh-guid</guid></item>
    </channel></rss>`
  });

  globalThis.DOMParser = class {
    parseFromString() {
      return createRssDoc("Feed2", [makeItemNode("Fresh", "https://example.test/fresh", "fresh-guid")]);
    }
  };

  const module = await import(`../sw.js?etag-cache-new-items=${Date.now()}`);
  assert.equal(typeof msgRef.current, "function");

  const response = await new Promise(resolve => {
    const alive = msgRef.current({ action: "updateFeed", feedId: "feedB" }, {}, resolve);
    assert.equal(alive, true);
  });

  assert.deepEqual(response, { ok: true });
  assert.equal(store.feeds.feedB.lastEtag, "etag-still-valid",
    "lastEtag must be preserved when server omits ETag header even with new items");
  assert.equal(store.feeds.feedB.lastModified, "Tue, 01 Jan 2025 00:00:00 GMT",
    "lastModified must be preserved when server omits Last-Modified even with new items");
  assert.ok(store.feeds.feedB.seen["fresh-guid"] > 0, "new item marked seen");

  module.stopNativeFolderWatch();
});
