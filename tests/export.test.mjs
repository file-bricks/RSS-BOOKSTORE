import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { exportFeedToFolder, exportAllFeedsToFolder } from "../lib/export.js";

// Mock chrome.bookmarks and window.showDirectoryPicker for each test.

const originalChrome = globalThis.chrome;
const originalShowDirectoryPicker = globalThis.window?.showDirectoryPicker;

afterEach(() => {
  if (originalChrome === undefined) {
    delete globalThis.chrome;
  } else {
    globalThis.chrome = originalChrome;
  }
  if (typeof globalThis.window !== "undefined") {
    if (originalShowDirectoryPicker === undefined) {
      delete globalThis.window.showDirectoryPicker;
    } else {
      globalThis.window.showDirectoryPicker = originalShowDirectoryPicker;
    }
  }
});

function makeDirHandle(written = {}) {
  return {
    async getDirectoryHandle(name, { create } = {}) {
      return makeDirHandle(written);
    },
    async getFileHandle(name) {
      return {
        async createWritable() {
          return {
            async write(blob) {
              const text = await blob.text();
              written[name] = text;
            },
            async close() {}
          };
        }
      };
    },
    written
  };
}

function setupChrome(children) {
  globalThis.chrome = {
    bookmarks: {
      async getChildren() {
        return children;
      }
    }
  };
}

function setupPicker(handle) {
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {};
  }
  globalThis.window.showDirectoryPicker = async () => handle;
}

// --- exportFeedToFolder ---

test("exportFeedToFolder writes .url files for each bookmark", async () => {
  const children = [
    { title: "Release Notes", url: "https://example.com/release" },
    { title: "No URL node" }
  ];
  setupChrome(children);
  const handle = makeDirHandle();
  setupPicker(handle);

  const count = await exportFeedToFolder("folder-id");

  assert.equal(count, 1);
  assert.ok("Release Notes.url" in handle.written);
  assert.ok(handle.written["Release Notes.url"].includes("URL=https://example.com/release"));
  assert.ok(handle.written["Release Notes.url"].includes("[InternetShortcut]"));
});

test("exportFeedToFolder throws when folder has no bookmarks", async () => {
  setupChrome([{ title: "Folder node" }]);
  const handle = makeDirHandle();
  setupPicker(handle);

  await assert.rejects(
    () => exportFeedToFolder("empty-folder"),
    /No bookmarks to export/
  );
});

test("exportFeedToFolder sanitizes illegal filename characters", async () => {
  setupChrome([{ title: 'A/B:C"D', url: "https://example.com/a" }]);
  const handle = makeDirHandle();
  setupPicker(handle);

  await exportFeedToFolder("folder-id");

  const keys = Object.keys(handle.written);
  assert.equal(keys.length, 1);
  assert.ok(!keys[0].match(/[/:"]/), `unexpected chars in "${keys[0]}"`);
});

test("exportAllFeedsToFolder sanitizes Windows reserved feed and bookmark names", async () => {
  globalThis.chrome = {
    bookmarks: {
      async getChildren(folderId) {
        if (folderId === "folder-con") {
          return [{ title: "PRN.txt", url: "https://example.com/a" }];
        }
        return [];
      }
    }
  };

  const rootHandle = makeDirHandle();
  const subHandles = {};
  rootHandle.getDirectoryHandle = async (name) => {
    subHandles[name] = makeDirHandle();
    return subHandles[name];
  };
  setupPicker(rootHandle);

  const total = await exportAllFeedsToFolder([
    { title: "CON.txt", url: "https://example.com/feed", bookmarkFolderId: "folder-con" }
  ]);

  assert.equal(total, 1);
  assert.ok("CON_.txt" in subHandles);
  assert.ok("PRN_.txt.url" in subHandles["CON_.txt"].written);
});

test("exportFeedToFolder writes Windows .url format with CRLF", async () => {
  setupChrome([{ title: "Article", url: "https://example.com/article" }]);
  const handle = makeDirHandle();
  setupPicker(handle);

  await exportFeedToFolder("folder-id");

  const content = handle.written["Article.url"];
  assert.ok(content.includes("\r\n"), "expected CRLF line endings");
});

test("exportFeedToFolder skips unsafe shortcut URLs", async () => {
  setupChrome([
    { title: "Script", url: "javascript:alert(1)" },
    { title: "Injected", url: "https://example.com/a\r\nIconFile=C:\\evil.ico" },
    { title: "Safe", url: "https://example.com/safe" }
  ]);
  const handle = makeDirHandle();
  setupPicker(handle);

  const count = await exportFeedToFolder("folder-id");

  assert.equal(count, 1);
  assert.deepEqual(Object.keys(handle.written), ["Safe.url"]);
});

// --- exportAllFeedsToFolder ---

test("exportAllFeedsToFolder exports bookmarks from all feeds with bookmark folders", async () => {
  globalThis.chrome = {
    bookmarks: {
      async getChildren(folderId) {
        if (folderId === "folder-a") {
          return [
            { title: "Story One", url: "https://a.com/1" },
            { title: "Story Two", url: "https://a.com/2" }
          ];
        }
        if (folderId === "folder-b") {
          return [{ title: "Post", url: "https://b.com/post" }];
        }
        return [];
      }
    }
  };

  const rootHandle = makeDirHandle();
  const subHandles = {};
  rootHandle.getDirectoryHandle = async (name) => {
    subHandles[name] = makeDirHandle();
    return subHandles[name];
  };
  setupPicker(rootHandle);

  const total = await exportAllFeedsToFolder([
    { title: "Feed A", url: "https://a.com/feed", bookmarkFolderId: "folder-a" },
    { title: "Feed B", url: "https://b.com/feed", bookmarkFolderId: "folder-b" },
    { title: "No Folder", url: "https://c.com/feed" }
  ]);

  assert.equal(total, 3);
  assert.ok("Feed A" in subHandles);
  assert.ok("Feed B" in subHandles);
  assert.ok(!("No Folder" in subHandles));
  assert.ok("Story One.url" in subHandles["Feed A"].written);
  assert.ok("Story Two.url" in subHandles["Feed A"].written);
  assert.ok("Post.url" in subHandles["Feed B"].written);
});

test("exportAllFeedsToFolder throws when no feeds have bookmark folders", async () => {
  setupChrome([]);
  const handle = makeDirHandle();
  setupPicker(handle);

  await assert.rejects(
    () => exportAllFeedsToFolder([{ title: "Feed", url: "https://x.com/feed" }]),
    /No feeds with bookmark folders/
  );
});

test("exportAllFeedsToFolder skips feeds whose bookmark folder is gone", async () => {
  globalThis.chrome = {
    bookmarks: {
      async getChildren(folderId) {
        if (folderId === "missing") throw new Error("Folder not found");
        return [{ title: "Article", url: "https://ok.com/a" }];
      }
    }
  };

  const rootHandle = makeDirHandle();
  const subHandles = {};
  rootHandle.getDirectoryHandle = async (name) => {
    subHandles[name] = makeDirHandle();
    return subHandles[name];
  };
  setupPicker(rootHandle);

  const total = await exportAllFeedsToFolder([
    { title: "Missing", url: "https://x.com/feed", bookmarkFolderId: "missing" },
    { title: "Good", url: "https://ok.com/feed", bookmarkFolderId: "good" }
  ]);

  assert.equal(total, 1);
  assert.ok("Good" in subHandles);
  // "Missing" subdir may be created before getChildren is called, but nothing is written into it
  if ("Missing" in subHandles) {
    assert.equal(Object.keys(subHandles["Missing"].written).length, 0);
  }
});
