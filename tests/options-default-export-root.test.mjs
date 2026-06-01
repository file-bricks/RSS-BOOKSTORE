import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.document;
});

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.listeners = {};
    this.checked = false;
    this.value = "";
    this.type = "button";
    this.className = "";
    this.children = [];
    this.dataset = {};
    this._textContent = "";
    this._innerHTML = "";
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  async click() {
    if (this.listeners.click) {
      await this.listeners.click({ target: this });
    }
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector() {
    return new FakeElement();
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
  }

  get textContent() {
    return this._textContent;
  }

  set innerHTML(value) {
    this._innerHTML = String(value ?? "");
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

function installOptionsPage() {
  const elements = new Map();
  for (const id of [
    "updateOnStartup",
    "globalInterval",
    "rootFolderName",
    "deleteBookmarks",
    "syncMode",
    "exportRoot",
    "useDefaultExportRoot",
    "saveSettings",
    "addBtn",
    "feedUrl",
    "importOPMLBtn",
    "exportOPMLBtn",
    "exportAllFoldersBtn",
    "opmlFileInput",
    "feedList",
    "feedStatus",
    "settingsStatus"
  ]) {
    elements.set(id, new FakeElement(id));
  }

  elements.get("globalInterval").type = "number";
  elements.get("rootFolderName").type = "text";
  elements.get("deleteBookmarks").type = "checkbox";
  elements.get("syncMode").value = "SYNC";
  elements.get("exportRoot").type = "text";
  elements.get("feedUrl").type = "url";
  elements.get("opmlFileInput").type = "file";

  globalThis.document = {
    getElementById(id) {
      assert.ok(elements.has(id), `missing test element ${id}`);
      return elements.get(id);
    },
    createElement() {
      return new FakeElement();
    },
    querySelectorAll() {
      return [];
    }
  };

  const sentMessages = [];
  const store = {
    settings: {
      updateOnStartup: true,
      globalIntervalMinutes: 0,
      rootFolderName: "RSS",
      rootFolderId: "",
      deleteBookmarksOnUnsubscribe: false,
      mode: "SYNC",
      exportRoot: ""
    },
    feeds: {}
  };

  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        sentMessages.push(message);
        return {
          ok: true,
          exportRoot: "C:/Users/User/OneDrive/RSS-BOOKSTORE"
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

  return { elements, sentMessages };
}

test("options page exposes default OneDrive export root button", () => {
  const html = fs.readFileSync(path.join(rootDir, "ui", "options.html"), "utf8");

  assert.match(html, /id="useDefaultExportRoot"/);
  assert.match(html, /OneDrive-Standard/);
});

test("options default export button resolves and fills the export root", async () => {
  const { elements, sentMessages } = installOptionsPage();

  await import(`../ui/options.js?default-export-root=${Date.now()}`);
  await elements.get("useDefaultExportRoot").click();

  assert.deepEqual(sentMessages, [{ action: "resolveDefaultExportRoot" }]);
  assert.equal(elements.get("exportRoot").value, "C:/Users/User/OneDrive/RSS-BOOKSTORE");
  assert.equal(elements.get("settingsStatus").textContent, "OneDrive-Standardpfad gesetzt.");
});
