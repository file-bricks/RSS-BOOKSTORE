import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const optionsHtml = readFileSync(resolve("ui/options.html"), "utf8");
const popupHtml = readFileSync(resolve("ui/popup.html"), "utf8");

test("options page exposes an explicit label and live regions for the add-feed flow", () => {
  assert.match(
    optionsHtml,
    /<label class="visually-hidden" for="feedUrl">Feed-URL<\/label>/,
    "feedUrl should have an explicit hidden label"
  );
  assert.match(
    optionsHtml,
    /<input id="feedUrl" type="url" placeholder="https:\/\/example\.com\/feed\.xml" aria-describedby="feedUrlHint">/,
    "feedUrl should reference helper text instead of relying only on its placeholder"
  );
  assert.match(
    optionsHtml,
    /<div id="feedUrlHint" class="visually-hidden">RSS- oder Atom-Feed-URL eingeben, zum Beispiel https:\/\/example\.com\/feed\.xml\.<\/div>/,
    "feedUrl should expose helper text for screenreaders"
  );
  assert.match(
    optionsHtml,
    /<div id="settingsStatus" class="status" role="status" aria-live="polite" aria-atomic="true"><\/div>/,
    "settings status should be announced as a live region"
  );
  assert.match(
    optionsHtml,
    /<div id="feedStatus" class="status" role="status" aria-live="polite" aria-atomic="true"><\/div>/,
    "feed status should be announced as a live region"
  );
});

test("popup status remains compact but is announced as a live region", () => {
  assert.match(
    popupHtml,
    /<div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"><\/div>/,
    "popup status should be announced without adding visible labels"
  );
});
