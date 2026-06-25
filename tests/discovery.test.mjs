import { test } from "node:test";
import assert from "node:assert/strict";

import { probeCommonFeedPaths } from "../lib/discovery.js";

// collectFeedLinksFromDocument requires a live DOM — tested via browser only.
// probeCommonFeedPaths accepts a fetchImpl parameter, so it is fully testable here.

function makeFetch(responses) {
  return async (url) => {
    const entry = responses[url];
    if (!entry) {
      return { ok: false, headers: { get: () => "" }, text: async () => "" };
    }
    return {
      ok: true,
      url,
      headers: { get: (h) => entry.contentType ?? "" },
      text: async () => entry.body ?? ""
    };
  };
}

test("probeCommonFeedPaths discovers RSS feed at /feed", async () => {
  const fetch = makeFetch({
    "https://example.com/feed": {
      contentType: "application/rss+xml",
      body: "<rss version='2.0'></rss>"
    }
  });

  const found = await probeCommonFeedPaths("https://example.com/", [], fetch);
  const urls = found.map(f => f.url);
  assert.deepEqual(urls, ["https://example.com/feed"]);
});

test("probeCommonFeedPaths discovers feed by body content when content-type is plain text", async () => {
  const fetch = makeFetch({
    "https://example.com/rss": {
      contentType: "text/plain",
      body: "<rss version='2.0'><channel></channel></rss>"
    }
  });

  const found = await probeCommonFeedPaths("https://example.com/page", [], fetch);
  assert.ok(found.some(f => f.url === "https://example.com/rss"));
});

test("probeCommonFeedPaths skips URLs that already exist in existingFeeds", async () => {
  const fetch = makeFetch({
    "https://example.com/feed": { contentType: "application/rss+xml", body: "<rss></rss>" }
  });

  const found = await probeCommonFeedPaths(
    "https://example.com/",
    [{ url: "https://example.com/feed" }],
    fetch
  );

  assert.equal(found.length, 0);
});

test("probeCommonFeedPaths returns empty array for unreachable paths", async () => {
  const fetch = makeFetch({});
  const found = await probeCommonFeedPaths("https://example.com/", [], fetch);
  assert.equal(found.length, 0);
});

test("probeCommonFeedPaths returns empty array for invalid pageUrl", async () => {
  const fetch = makeFetch({});
  const found = await probeCommonFeedPaths("not a url", [], fetch);
  assert.equal(found.length, 0);
});

test("probeCommonFeedPaths returns empty array when fetchImpl is not a function", async () => {
  const found = await probeCommonFeedPaths("https://example.com/", [], null);
  assert.equal(found.length, 0);
});

test("probeCommonFeedPaths deduplicates results when multiple paths match", async () => {
  const responses = {};
  for (const path of ["/feed", "/rss", "/atom.xml"]) {
    responses[`https://example.com${path}`] = {
      contentType: "application/atom+xml",
      body: "<feed></feed>"
    };
  }

  const found = await probeCommonFeedPaths("https://example.com/", [], makeFetch(responses));
  const urls = found.map(f => f.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate URLs");
  assert.ok(urls.length >= 3);
});

test("probeCommonFeedPaths ignores non-feed responses", async () => {
  const fetch = makeFetch({
    "https://example.com/feed": {
      contentType: "text/html",
      body: "<html><head><title>Blog</title></head></html>"
    }
  });

  const found = await probeCommonFeedPaths("https://example.com/", [], fetch);
  assert.equal(found.length, 0);
});
