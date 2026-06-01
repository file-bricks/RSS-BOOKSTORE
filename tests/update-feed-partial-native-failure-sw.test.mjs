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

function extractTag(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim() || "";
}

function createItemNode(xml) {
  return {
    querySelector(selector) {
      switch (selector) {
        case "title":
          return { textContent: extractTag(xml, "title") };
        case "link":
          return { textContent: extractTag(xml, "link") };
        case "guid":
          return { textContent: extractTag(xml, "guid") };
        case "pubDate":
          return { textContent: extractTag(xml, "pubDate") };
        default:
          return null;
      }
    }
  };
}

function createRssDocument(xmlText) {
  const channelXml = xmlText.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i)?.[1] || "";
  const channelTitle = extractTag(channelXml, "title");
  const items = [...xmlText.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => createItemNode(match[1]));

  const channelNode = {
    querySelector(selector) {
      if (selector === ":scope > title") {
        return { textContent: channelTitle };
      }
      return null;
    }
  };

  return {
    querySelector(selector) {
      if (selector === "parsererror" || selector === "feed") {
        return null;
      }
      if (selector === "rss channel" || selector === "channel") {
        return channelNode;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "item") {
        return items;
      }
      return [];
    }
  };
}

test("updateFeed keeps bookmark sync alive when native root resolution fails", async () => {
  const posted = [];
  const createdBookmarks = [];
  let messageListener = null;
  const store = {
    settings: {
      mode: "SYNC",
      exportRoot: "",
      nativeHostName: "test.host",
      nativeTimeoutMs: 100,
      notify: false
    },
    feeds: {
      feedA: {
        id: "feedA",
        enabled: true,
        notify: false,
        url: "https://example.test/feed.xml",
        title: "Tech Feed",
        bookmarkFolderId: "folder-feed-a",
        seen: {},
        lastFetch: 0,
        lastEtag: "",
        lastModified: "",
        lastError: "",
        nativePathByBookmarkId: {}
      }
    }
  };

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech Feed</title>
    <item>
      <title>Latest Story</title>
      <link>https://example.test/story</link>
      <guid>story-1</guid>
      <pubDate>Wed, 14 May 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name === "ETag") return '"123"';
        if (name === "Last-Modified") return "Wed, 14 May 2026 00:00:00 GMT";
        return "";
      }
    },
    text: async () => rssXml
  });

  globalThis.DOMParser = class {
    parseFromString(text) {
      return createRssDocument(text);
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
      onRemoved: { addListener() {} },
      async get(id) {
        if (id === "folder-feed-a") {
          return [{ id, title: "Tech Feed" }];
        }
        throw new Error(`bookmark not found: ${id}`);
      },
      async create(payload) {
        createdBookmarks.push(payload);
        return { id: "bookmark-1", title: payload.title, url: payload.url };
      }
    },
    notifications: {
      async create() {}
    },
    permissions: {
      async contains() {
        return true;
      }
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      },
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
                  ok: false,
                  requestId: message.requestId,
                  error: "native_unavailable",
                  message: "Native export root unavailable"
                });
              }
            });
          },
          disconnect() {
            onDisconnect.emit();
          }
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

  const module = await import(`../sw.js?partial-native-failure=${Date.now()}`);
  assert.equal(typeof messageListener, "function");

  const response = await new Promise((resolve) => {
    const keepAlive = messageListener({ action: "updateFeed", feedId: "feedA" }, {}, resolve);
    assert.equal(keepAlive, true);
  });

  assert.deepEqual(response, { ok: true });
  assert.deepEqual(posted.map(message => message.cmd), ["get_default_export_root"]);
  assert.deepEqual(createdBookmarks, [
    {
      parentId: "folder-feed-a",
      title: "Latest Story",
      url: "https://example.test/story"
    }
  ]);
  assert.equal(store.feeds.feedA.lastFetch > 0, true);
  assert.equal(store.feeds.feedA.seen["story-1"] > 0, true);
  assert.match(store.feeds.feedA.lastError, /Native export root unavailable|Export-Zielordner/);

  module.stopNativeFolderWatch();
});
