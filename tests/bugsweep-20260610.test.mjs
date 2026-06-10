import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { makeFeedItemKey } from "../lib/sync.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Bug A: OPML-Export-Anker muss ins DOM eingehängt werden, revokeObjectURL async ---

test("Bug A fix: options.js OPML export appends anchor to document.body before click", () => {
  const src = readFileSync(join(ROOT, "ui", "options.js"), "utf8");
  assert.ok(
    src.includes("document.body.appendChild(a)"),
    "anchor muss vor click() an document.body angehängt werden"
  );
  assert.ok(
    src.includes("document.body.removeChild(a)"),
    "anchor muss nach click() wieder entfernt werden"
  );
});

test("Bug A fix: options.js OPML revokeObjectURL is deferred via setTimeout", () => {
  const src = readFileSync(join(ROOT, "ui", "options.js"), "utf8");
  // Synchronous call must be absent; deferred call must be present
  assert.ok(
    !src.includes("\n  URL.revokeObjectURL(url);"),
    "synchrones URL.revokeObjectURL unmittelbar nach a.click() darf nicht mehr vorhanden sein"
  );
  assert.ok(
    src.includes("setTimeout(() => URL.revokeObjectURL(url)"),
    "URL.revokeObjectURL muss per setTimeout verzögert aufgerufen werden"
  );
});

// --- Bug B: FNV-1 Hash muss Math.imul verwenden, nicht plain * ---

test("Bug B fix: sync.js simpleHash uses Math.imul for 32-bit precision", () => {
  const src = readFileSync(join(ROOT, "lib", "sync.js"), "utf8");
  assert.ok(
    src.includes("Math.imul(h ^ s.charCodeAt(i), 16777619)"),
    "simpleHash muss Math.imul statt plain * verwenden"
  );
  assert.ok(
    !src.includes(") * 16777619"),
    "plain Multiplikation mit 16777619 muss entfernt sein"
  );
});

test("Bug B fix: long-title feed items get distinct non-degenerate hash keys", () => {
  // With plain *, h overflows to Infinity after ~44 chars → (Infinity >>> 0) = 0
  // All long-title items collapse to the same key "0", defeating dedup.
  // With Math.imul, 32-bit wrapping is preserved and keys stay distinct.
  const item1 = { title: "A".repeat(60), published: "2024-01-01" };
  const item2 = { title: "B".repeat(60), published: "2024-01-01" };
  const key1 = makeFeedItemKey(item1);
  const key2 = makeFeedItemKey(item2);
  assert.notEqual(key1, "0", "Hash für langes title darf nicht 0 sein (Float-Overflow-Indikator)");
  assert.notEqual(key1, key2, "unterschiedliche lange Titel müssen unterschiedliche Schlüssel ergeben");
});

test("Bug B fix: makeFeedItemKey is deterministic for identical titleless items", () => {
  const item = { title: "C".repeat(50), published: "2024-06-10" };
  assert.equal(makeFeedItemKey(item), makeFeedItemKey(item));
});

// --- Bug D/E: manifest.json Icons-Format und scripting-Permission ---

test("Bug D fix: manifest.json icons field uses browser extension format, not PWA array", () => {
  const src = readFileSync(join(ROOT, "manifest.json"), "utf8");
  const manifest = JSON.parse(src);
  assert.equal(typeof manifest.icons, "object", "icons muss ein Objekt sein (nicht Array)");
  assert.ok(!Array.isArray(manifest.icons), "icons darf kein Array sein (PWA-Format ist falsch für Browser-Extension)");
  assert.equal(manifest.icons["16"], "icons/16.png");
  assert.equal(manifest.icons["48"], "icons/48.png");
  assert.equal(manifest.icons["128"], "icons/128.png");
});

test("Bug E fix: manifest.json includes scripting permission for chrome.scripting.executeScript", () => {
  const src = readFileSync(join(ROOT, "manifest.json"), "utf8");
  const manifest = JSON.parse(src);
  assert.ok(
    manifest.permissions.includes("scripting"),
    "scripting-Permission muss in manifest.json vorhanden sein (wird von discoverFeedsOnTab benötigt)"
  );
});

test("Bug F fix: manifest.json includes activeTab permission required alongside scripting in MV3", () => {
  const src = readFileSync(join(ROOT, "manifest.json"), "utf8");
  const manifest = JSON.parse(src);
  assert.ok(
    manifest.permissions.includes("activeTab"),
    "activeTab-Permission muss vorhanden sein (MV3: scripting.executeScript benötigt activeTab wenn kein Host-Permission vorliegt)"
  );
});

// --- Bug C: upsertFeed muss Concurrent-Writes serialisieren ---

test("Bug C fix: storage.js upsertFeed serializes concurrent writes, preserving both updates", async () => {
  const stored = {};
  // delay-Promise VOR den async-Aufrufen anlegen, damit resolveDelay sofort verfügbar ist
  let delayResolve;
  const delay = new Promise(r => { delayResolve = r; });

  let firstGetDone = false;
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (!firstGetDone) {
            firstGetDone = true;
            await delay;  // erstes get() blockiert, bis wir freigeben
          }
          return Object.fromEntries(keys.map(k => [k, stored[k]]));
        },
        async set(patch) {
          Object.assign(stored, patch);
        }
      }
    }
  };

  const { upsertFeed } = await import(`../lib/storage.js?race-${Date.now()}`);

  // Beide Aufrufe gleichzeitig starten
  const p1 = upsertFeed("feed1", { url: "https://a.test/feed" });
  const p2 = upsertFeed("feed2", { url: "https://b.test/feed" });

  // Lock freigeben → p1 kann get() abschließen, p2 wartet auf den Lock
  delayResolve();

  await Promise.all([p1, p2]);

  // Ohne Lock: p2 würde feeds={} lesen → {feed2:...} schreiben → p1 schreibt {feed1:...} → feed2 verloren
  // Mit Lock: p1 liest+schreibt, dann p2 liest (sieht feed1) → {feed1:..., feed2:...} → beide vorhanden
  assert.ok(stored.feeds?.feed1, "feed1 muss nach beiden upsertFeed-Aufrufen vorhanden sein");
  assert.ok(stored.feeds?.feed2, "feed2 muss nach beiden upsertFeed-Aufrufen vorhanden sein");

  delete globalThis.chrome;
});

test("Bug C fix: storage.js withFeedLock serializes removeFeed too", async () => {
  const stored = { feeds: { feed1: { id: "feed1" }, feed2: { id: "feed2" } } };
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

  const { upsertFeed, removeFeed } = await import(`../lib/storage.js?remove-${Date.now()}`);

  // upsertFeed + removeFeed gleichzeitig — ohne Lock könnte upsert das remove überschreiben
  await Promise.all([
    upsertFeed("feed3", { url: "https://c.test/feed" }),
    removeFeed("feed1")
  ]);

  assert.ok(!stored.feeds?.feed1, "feed1 muss nach removeFeed entfernt sein");
  assert.ok(stored.feeds?.feed3, "feed3 muss nach upsertFeed vorhanden sein");

  delete globalThis.chrome;
});
