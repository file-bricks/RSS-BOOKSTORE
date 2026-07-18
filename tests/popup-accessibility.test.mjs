import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.window;
});

class FakeElement {
  constructor(id = "", tagName = "div") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.listeners = {};
    this.children = [];
    this.attributes = new Map();
    this.className = "";
    this.disabled = false;
    this.title = "";
    this.type = "button";
    this.value = "";
    this.checked = false;
    this._textContent = "";
    this._innerHTML = "";
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  async click() {
    if (this.listeners.click) {
      await this.listeners.click({ target: this });
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll() {
    return [];
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
  }

  get textContent() {
    return this._textContent;
  }

  set innerHTML(value) {
    this._innerHTML = String(value ?? "");
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

function installPopupPage() {
  const elements = new Map();
  for (const id of [
    "feedList",
    "status",
    "discoverSection",
    "updateBtn",
    "discoverBtn",
    "openFeedsBtn",
    "optionsBtn"
  ]) {
    elements.set(id, new FakeElement(id));
  }

  globalThis.document = {
    getElementById(id) {
      assert.ok(elements.has(id), `missing test element ${id}`);
      return elements.get(id);
    },
    createElement(tagName) {
      return new FakeElement("", tagName);
    },
    querySelectorAll() {
      return [];
    }
  };

  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "Mozilla/5.0 Chrome/126.0" },
    configurable: true
  });
  Object.defineProperty(globalThis, "window", {
    value: { close() {} },
    configurable: true
  });

  globalThis.chrome = {
    i18n: {
      getMessage() {
        return "";
      }
    },
    runtime: {
      async sendMessage(message) {
        if (message.action === "discoverFeeds") {
          return {
            ok: true,
            feeds: [
              { title: "Beispiel Feed", url: "https://example.com/feed.xml" }
            ]
          };
        }
        return { ok: true };
      },
      openOptionsPage() {}
    },
    tabs: {
      async query() {
        return [{ id: 7 }];
      },
      async create() {}
    },
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(keys.map(key => [key, key === "feeds" ? {} : {}]));
        },
        async set() {}
      }
    }
  };

  return elements;
}

test("popup autodiscovery add button exposes an accessible name for compact symbol UI", async () => {
  const elements = installPopupPage();

  await import(`../ui/popup.js?popup-accessibility=${Date.now()}`);
  await elements.get("discoverBtn").click();

  const discoverSection = elements.get("discoverSection");
  assert.equal(discoverSection.children.length, 1);

  const actionRow = discoverSection.children[0];
  assert.equal(actionRow.children.length, 2);

  const addButton = actionRow.children[1];
  assert.equal(addButton.textContent, "+");
  assert.equal(addButton.title, "Feed hinzufügen: Beispiel Feed");
  assert.equal(addButton.getAttribute("aria-label"), "Feed hinzufügen: Beispiel Feed");
});
