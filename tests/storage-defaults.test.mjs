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

function setupStorage(stored = {}) {
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(keys.map(k => [k, stored[k]]));
        },
        async set(patch) {
          Object.assign(stored, patch);
        }
      }
    }
  };
  return stored;
}

test("getState fills missing settings with all defaults including new RSS-BOOK fields", async () => {
  setupStorage({});
  const { getState } = await import(`../lib/storage.js?defaults-${Date.now()}`);
  const { settings } = await getState();

  // Original BOOKSTORE defaults
  assert.equal(settings.updateOnStartup, true);
  assert.equal(settings.globalIntervalMinutes, 0);
  assert.equal(settings.mode, "BOOKMARKS");
  assert.equal(settings.exportRoot, "");

  // New RSS-BOOK defaults
  assert.equal(settings.rootFolderName, "RSS");
  assert.equal(settings.rootFolderId, "");
  assert.equal(settings.deleteBookmarksOnUnsubscribe, false);
});

test("getState merges stored settings with defaults", async () => {
  setupStorage({
    settings: { rootFolderName: "My RSS", mode: "SYNC", exportRoot: "C:/Feeds" }
  });
  const { getState } = await import(`../lib/storage.js?merge-${Date.now()}`);
  const { settings } = await getState();

  assert.equal(settings.rootFolderName, "My RSS");
  assert.equal(settings.mode, "SYNC");
  assert.equal(settings.exportRoot, "C:/Feeds");
  assert.equal(settings.updateOnStartup, true);
  assert.equal(settings.deleteBookmarksOnUnsubscribe, false);
});

test("updateSettings patches only specified keys, preserving others", async () => {
  const store = setupStorage({
    settings: { rootFolderName: "RSS", mode: "BOOKMARKS", exportRoot: "" }
  });
  const { updateSettings, getState } = await import(`../lib/storage.js?patch-${Date.now()}`);

  await updateSettings({ rootFolderName: "Feeds", deleteBookmarksOnUnsubscribe: true });
  const { settings } = await getState();

  assert.equal(settings.rootFolderName, "Feeds");
  assert.equal(settings.deleteBookmarksOnUnsubscribe, true);
  assert.equal(settings.mode, "BOOKMARKS");
});
