import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { t, applyI18n } from "../lib/i18n.js";

const originalChrome = globalThis.chrome;

afterEach(() => {
  if (originalChrome === undefined) {
    delete globalThis.chrome;
  } else {
    globalThis.chrome = originalChrome;
  }
});

function setupI18n(messages = {}) {
  globalThis.chrome = {
    i18n: {
      getMessage(key, substitutions) {
        return messages[key] ?? "";
      }
    }
  };
}

// --- t() ---

test("t returns translated message for known key", () => {
  setupI18n({ optionsSave: "Speichern" });
  assert.equal(t("optionsSave"), "Speichern");
});

test("t returns the key itself when translation is missing", () => {
  setupI18n({});
  assert.equal(t("unknownKey"), "unknownKey");
});

test("t passes substitutions to chrome.i18n.getMessage", () => {
  const received = [];
  globalThis.chrome = {
    i18n: {
      getMessage(key, subs) {
        received.push({ key, subs });
        return "3 Feeds importiert";
      }
    }
  };

  const result = t("optionsOPMLImported", ["3"]);
  assert.equal(result, "3 Feeds importiert");
  assert.deepEqual(received[0], { key: "optionsOPMLImported", subs: ["3"] });
});

// --- applyI18n() ---
// applyI18n uses querySelectorAll — requires a minimal DOM mock.

function makeElement(tag, attrs = {}, children = []) {
  const el = {
    tagName: tag,
    textContent: "",
    placeholder: "",
    title: "",
    getAttribute(name) { return attrs[name] ?? null; },
    querySelectorAll(selector) {
      const key = selector.replace(/\[|\]/g, "").replace("data-i18n-", "").replace("data-i18n", "data-i18n");
      return children.filter(c => c.getAttribute && c.getAttribute(selector.match(/\[([^\]]+)\]/)?.[1]) !== null);
    }
  };
  return el;
}

function makeRoot(i18nChildren, i18nPlaceholderChildren = [], i18nTitleChildren = []) {
  return {
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return i18nChildren;
      if (selector === "[data-i18n-placeholder]") return i18nPlaceholderChildren;
      if (selector === "[data-i18n-title]") return i18nTitleChildren;
      return [];
    }
  };
}

test("applyI18n sets textContent for data-i18n elements", () => {
  setupI18n({ optionsSave: "Speichern" });

  const el = { textContent: "", getAttribute: (k) => k === "data-i18n" ? "optionsSave" : null };
  const root = makeRoot([el]);

  applyI18n(root);
  assert.equal(el.textContent, "Speichern");
});

test("applyI18n does not overwrite when translation equals key (missing)", () => {
  setupI18n({});

  const el = { textContent: "original", getAttribute: (k) => k === "data-i18n" ? "missingKey" : null };
  const root = makeRoot([el]);

  applyI18n(root);
  assert.equal(el.textContent, "original");
});

test("applyI18n sets placeholder for data-i18n-placeholder elements", () => {
  setupI18n({ feedUrlPlaceholder: "https://example.com/feed.xml" });

  const el = { placeholder: "", getAttribute: (k) => k === "data-i18n-placeholder" ? "feedUrlPlaceholder" : null };
  const root = makeRoot([], [el]);

  applyI18n(root);
  assert.equal(el.placeholder, "https://example.com/feed.xml");
});

test("applyI18n sets title for data-i18n-title elements", () => {
  setupI18n({ addBtnTitle: "Feed hinzufügen" });

  const el = { title: "", getAttribute: (k) => k === "data-i18n-title" ? "addBtnTitle" : null };
  const root = makeRoot([], [], [el]);

  applyI18n(root);
  assert.equal(el.title, "Feed hinzufügen");
});
