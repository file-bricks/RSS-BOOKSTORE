import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSeenPatch,
  findNativePathForBookmark,
  getExportRoot,
  mergeNativePathByBookmarkId,
  normalizeSyncMode,
  removeNativePathForBookmark,
  selectFreshFeedItems,
  SYNC_MODES,
  toNativeExportItems,
  usesBookmarks,
  usesNativeFolder
} from "../lib/sync.js";
import { normalizeHttpUrl } from "../lib/url_safety.js";

const originalNow = Date.now;

afterEach(() => {
  Date.now = originalNow;
});

test("normalizes sync modes and mode capabilities", () => {
  assert.equal(normalizeSyncMode("FOLDER"), SYNC_MODES.FOLDER);
  assert.equal(normalizeSyncMode("unknown"), SYNC_MODES.BOOKMARKS);
  assert.equal(usesBookmarks("BOOKMARKS"), true);
  assert.equal(usesBookmarks("SYNC"), true);
  assert.equal(usesBookmarks("FOLDER"), false);
  assert.equal(usesNativeFolder("BOOKMARKS"), false);
  assert.equal(usesNativeFolder("FOLDER"), true);
  assert.equal(usesNativeFolder("SYNC"), true);
});

test("selectFreshFeedItems skips seen, duplicate, and linkless items", () => {
  Date.now = () => 1_777_521_600_000;

  const fresh = selectFreshFeedItems(
    { seen: { old: 1 } },
    [
      { title: "Old", link: "https://example.test/old", guid: "old" },
      { title: "No link", guid: "missing" },
      { title: "Fresh A", link: "https://example.test/a", guid: "fresh-a" },
      { title: "Fresh A duplicate", link: "https://example.test/a2", guid: "fresh-a" },
      { title: "Fresh B", link: "https://example.test/b" }
    ]
  );

  assert.deepEqual(fresh.map(item => item.title), ["Fresh A", "Fresh B"]);
});

test("feed item URL normalization rejects unsafe bookmark and native targets", () => {
  const items = [
    { title: "Script", link: "javascript:alert(1)" },
    { title: "Local", link: "file:///C:/Example/Documents/private.txt" },
    { title: "Injected", link: "https://example.test/story\r\nIconFile=C:\\evil.ico" },
    { title: "Safe", link: " https://example.test/safe " }
  ];

  assert.equal(normalizeHttpUrl(items[0].link), "");
  assert.deepEqual(selectFreshFeedItems({ seen: {} }, items).map(item => item.title), ["Safe"]);
  assert.deepEqual(toNativeExportItems({ title: "Feed" }, items), [
    {
      folderParts: ["RSS", "Feed"],
      title: "Safe",
      url: "https://example.test/safe"
    }
  ]);
});

test("buildSeenPatch marks delivered items and trims oldest entries", () => {
  Date.now = () => 1_777_521_600_000;
  const oldSeen = Object.fromEntries(
    Array.from({ length: 800 }, (_, index) => [`old-${index}`, index])
  );

  const seen = buildSeenPatch(
    { seen: oldSeen },
    [
      { title: "Fresh", link: "https://example.test/fresh", guid: "fresh" },
      { title: "No link", guid: "skip" }
    ]
  );

  assert.equal(Object.keys(seen).length, 800);
  assert.equal(seen["old-0"], undefined);
  assert.equal(seen.fresh, 1_777_521_600_000);
});

test("toNativeExportItems maps feed items to native host payload", () => {
  const payload = toNativeExportItems(
    { title: "Tech Feed", url: "https://example.test/feed.xml" },
    [
      { title: "Release Notes", link: "https://example.test/release" },
      { title: "Missing Link" }
    ],
    { rootFolderName: "My RSS" }
  );

  assert.deepEqual(payload, [
    {
      folderParts: ["My RSS", "Tech Feed"],
      title: "Release Notes",
      url: "https://example.test/release"
    }
  ]);
});

test("getExportRoot trims configured native export path", () => {
  assert.equal(getExportRoot({ exportRoot: "  C:/Feeds  " }), "C:/Feeds");
  assert.equal(getExportRoot({}), "");
});

test("native bookmark path mapping stores, finds, and removes .url paths", () => {
  const mapping = mergeNativePathByBookmarkId(
    { old: "C:/RSS/old.url" },
    [{ id: "b1" }, { id: "b2" }, { id: "" }],
    ["C:/RSS/item-1.url", "C:/RSS/item-2.url", "C:/RSS/ignored.url"]
  );

  assert.deepEqual(mapping, {
    old: "C:/RSS/old.url",
    b1: "C:/RSS/item-1.url",
    b2: "C:/RSS/item-2.url"
  });

  assert.deepEqual(
    findNativePathForBookmark({
      feedA: { nativePathByBookmarkId: mapping }
    }, "b2"),
    { feedId: "feedA", path: "C:/RSS/item-2.url" }
  );

  assert.deepEqual(removeNativePathForBookmark(mapping, "b1"), {
    old: "C:/RSS/old.url",
    b2: "C:/RSS/item-2.url"
  });
});
