import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getFeedHostPattern,
  hasFeedHostPermission,
  requestFeedHostPermission
} from "../lib/permissions.js";

test("feed host patterns are limited to http and https origins", () => {
  assert.equal(getFeedHostPattern("https://Example.COM/feed.xml"), "https://example.com/*");
  assert.equal(getFeedHostPattern("http://localhost:8080/rss"), "http://localhost/*");
  assert.equal(getFeedHostPattern("ftp://example.com/feed.xml"), "");
  assert.equal(getFeedHostPattern("not a url"), "");
});

test("permission helpers call chrome.permissions with the feed origin", async () => {
  const calls = [];
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    permissions: {
      async contains(payload) {
        calls.push(["contains", payload]);
        return true;
      },
      async request(payload) {
        calls.push(["request", payload]);
        return true;
      }
    }
  };

  try {
    assert.equal(await hasFeedHostPermission("https://example.com/feed.xml"), true);
    assert.equal(await requestFeedHostPermission("https://example.com/feed.xml"), true);
    assert.deepEqual(calls, [
      ["contains", { origins: ["https://example.com/*"] }],
      ["request", { origins: ["https://example.com/*"] }]
    ]);
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  }
});
