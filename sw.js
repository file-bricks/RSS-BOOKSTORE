import { getState, upsertFeed, getEnabledFeeds, updateSettings } from "./lib/storage.js";
import { fetchFeedAndParse } from "./lib/rss.js";
import { ensureFeedFolder, addItemsToBookmarks, pruneOldBookmarks } from "./lib/bookmarks.js";
import { createNativeClient } from "./lib/native.js";
import { getFeedHostPattern, hasFeedHostPermission } from "./lib/permissions.js";
import { normalizeHttpUrl } from "./lib/url_safety.js";
import { collectFeedLinksFromDocument, probeCommonFeedPaths } from "./lib/discovery.js";
import {
  buildSeenPatch,
  DEFAULT_EXPORT_FOLDER_NAME,
  findNativePathForBookmark,
  getExportRoot,
  mergeNativePathByBookmarkId,
  normalizeSyncMode,
  removeNativePathForBookmark,
  selectFreshFeedItems,
  toNativeExportItems,
  usesBookmarks,
  usesNativeFolder
} from "./lib/sync.js";

const ALARM_NAME = "rss-book-tick";
const DEFAULT_NATIVE_WATCH_INTERVAL_MS = 1000;

let nativeFolderWatcher = null;

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(async () => {
  const raw = await chrome.storage.local.get(["settings", "feeds"]);
  if (!raw.settings) {
    await chrome.storage.local.set({
      settings: { updateOnStartup: true, globalIntervalMinutes: 0, mode: "BOOKMARKS", exportRoot: "" },
      feeds: raw.feeds || {}
    });
  }
  await ensureAlarm();
  await ensureNativeFolderWatch();
  console.log("[RSS-BOOK] Installed.");
});

chrome.runtime.onStartup.addListener(async () => {
  const { settings } = await getState();
  if (settings?.updateOnStartup) {
    await runUpdateCycle("startup");
  }
  await ensureAlarm();
  await ensureNativeFolderWatch();
  console.log("[RSS-BOOK] Startup complete.");
});

// --- Alarms ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await runUpdateCycle("alarm");
});

chrome.bookmarks.onRemoved.addListener((bookmarkId, removeInfo) => {
  handleBookmarkRemoved(bookmarkId, removeInfo)
    .catch((err) => console.error("[RSS-BOOK] Error syncing bookmark removal:", err));
});

async function ensureAlarm() {
  const { settings } = await getState();
  const interval = settings?.globalIntervalMinutes ?? 0;
  const existing = await chrome.alarms.get(ALARM_NAME);

  if (interval <= 0) {
    if (existing) await chrome.alarms.clear(ALARM_NAME);
    return;
  }

  if (!existing || Number(existing.periodInMinutes) !== interval) {
    if (existing) await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: interval });
  }
}

// --- Update Cycle ---

async function runUpdateCycle(reason) {
  console.log(`[RSS-BOOK] Update cycle (${reason})`);
  const feeds = await getEnabledFeeds();

  for (const feed of feeds) {
    if (reason === "alarm" && feed.intervalMinutes > 0) {
      const due = !feed.lastFetch || (Date.now() - feed.lastFetch) >= feed.intervalMinutes * 60_000;
      if (!due) continue;
    }
    try {
      await updateOneFeed(feed.id);
    } catch (err) {
      console.error(`[RSS-BOOK] Error updating feed ${feed.url}:`, err);
    }
  }

  // Retention pass
  for (const feed of feeds) {
    try {
      const { settings } = await getState();
      if (usesBookmarks(settings?.mode)) {
        await pruneOldBookmarks(feed);
      }
    } catch (err) {
      console.error(`[RSS-BOOK] Error pruning feed ${feed.url}:`, err);
    }
  }
}

async function updateOneFeed(feedId) {
  const { settings, feeds } = await getState();
  const feed = feeds?.[feedId];
  if (!feed || !feed.enabled) return;
  const mode = normalizeSyncMode(settings?.mode);
  const feedHostPattern = getFeedHostPattern(feed.url);

  if (!feedHostPattern) {
    await upsertFeed(feedId, {
      lastFetch: Date.now(),
      lastError: "Feed-URL muss mit http:// oder https:// beginnen"
    });
    return;
  }

  if (!(await hasFeedHostPermission(feed.url))) {
    await upsertFeed(feedId, {
      lastFetch: Date.now(),
      lastError: `Hostzugriff fehlt: ${feedHostPattern}`
    });
    return;
  }

  const parsed = await fetchFeedAndParse(feed.url, {
    etag: feed.lastEtag,
    lastModified: feed.lastModified
  });

  if (!parsed) {
    await upsertFeed(feedId, {
      lastFetch: Date.now(),
      lastError: "Feed nicht erreichbar oder ungültiges Format"
    });
    return;
  }

  if (parsed.items.length === 0) {
    await upsertFeed(feedId, {
      lastFetch: Date.now(),
      lastError: "",
      lastEtag: parsed.etag || feed.lastEtag,
      lastModified: parsed.lastModified || feed.lastModified,
      title: feed.title || parsed.title
    });
    return;
  }

  const feedForOutput = { ...feed, title: feed.title || parsed.title || feed.url };
  const freshItems = selectFreshFeedItems(feed, parsed.items);
  if (freshItems.length === 0) {
    await upsertFeed(feedId, {
      lastFetch: Date.now(),
      lastError: "",
      lastEtag: parsed.etag || feed.lastEtag,
      lastModified: parsed.lastModified || feed.lastModified,
      title: feed.title || parsed.title
    });
    return;
  }

  let folderId = feed.bookmarkFolderId;
  let deliveredCount = 0;
  let newestTitles = freshItems.map(item => item.title || item.link);
  let exportedPaths = [];
  let bookmarkResult = null;
  let nativeError = "";

  if (usesNativeFolder(mode)) {
    try {
      const exportRoot = await resolveNativeExportRoot(settings);
      const client = createNativeClient(settings.nativeHostName);
      try {
        const response = await client.exportItems(
          exportRoot,
          toNativeExportItems(feedForOutput, freshItems, settings),
          { timeoutMs: settings.nativeTimeoutMs }
        );
        exportedPaths = Array.isArray(response.created)
          ? response.created.filter(path => typeof path === "string" && path.trim())
          : [];
        const exportedCount = Number.isFinite(response.count) ? response.count : freshItems.length;
        deliveredCount = Math.max(deliveredCount, exportedCount);
      } finally {
        client.disconnect();
      }
    } catch (err) {
      nativeError = `Export-Zielordner konnte nicht automatisch ermittelt werden: ${err.message}`;
      if (!usesBookmarks(mode)) {
        await upsertFeed(feedId, {
          lastFetch: Date.now(),
          lastError: nativeError
        });
        return;
      }
    }
  }

  if (usesBookmarks(mode)) {
    folderId = await ensureFeedFolder(feedForOutput, folderId);
    bookmarkResult = await addItemsToBookmarks(
      { ...feedForOutput, bookmarkFolderId: folderId },
      folderId,
      freshItems,
      { markSeen: false }
    );
    deliveredCount = Math.max(deliveredCount, bookmarkResult.addedCount);
    newestTitles = bookmarkResult.newestTitles;
  }

  if (deliveredCount > 0 && feed.notify) {
    await notify(feedForOutput.title, deliveredCount, newestTitles);
  }

  const patch = {
    lastFetch: Date.now(),
    lastError: nativeError,
    lastEtag: parsed.etag || feed.lastEtag,
    lastModified: parsed.lastModified || feed.lastModified,
    title: feed.title || parsed.title,
    seen: buildSeenPatch(feed, freshItems)
  };
  if (usesBookmarks(mode)) {
    patch.bookmarkFolderId = folderId;
  }
  if (usesBookmarks(mode) && usesNativeFolder(mode) && bookmarkResult?.addedBookmarks?.length && exportedPaths.length) {
    patch.nativePathByBookmarkId = mergeNativePathByBookmarkId(
      feed.nativePathByBookmarkId,
      bookmarkResult.addedBookmarks,
      exportedPaths
    );
  }

  await upsertFeed(feedId, patch);
}

export async function handleBookmarkRemoved(bookmarkId, _removeInfo = {}) {
  const { settings, feeds } = await getState();
  const mode = normalizeSyncMode(settings?.mode);
  if (!(usesBookmarks(mode) && usesNativeFolder(mode))) {
    return { ok: true, skipped: "mode" };
  }

  const match = findNativePathForBookmark(feeds, bookmarkId);
  if (!match) {
    return { ok: true, skipped: "mapping" };
  }

  let exportRoot = "";
  try {
    exportRoot = await resolveNativeExportRoot(settings);
  } catch {
    return { ok: true, skipped: "exportRoot" };
  }

  const client = createNativeClient(settings.nativeHostName);
  try {
    const response = await client.deletePaths([match.path], {
      baseDir: exportRoot,
      timeoutMs: settings.nativeTimeoutMs
    });
    const feed = feeds?.[match.feedId] || {};
    await upsertFeed(match.feedId, {
      nativePathByBookmarkId: removeNativePathForBookmark(feed.nativePathByBookmarkId, bookmarkId)
    });
    return response;
  } finally {
    client.disconnect();
  }
}

export async function ensureNativeFolderWatch() {
  const { settings } = await getState();
  const mode = normalizeSyncMode(settings?.mode);
  let exportRoot = getExportRoot(settings);
  const hostName = settings?.nativeHostName;

  if (!(usesBookmarks(mode) && usesNativeFolder(mode))) {
    stopNativeFolderWatch();
    return { ok: true, watching: false, skipped: "mode" };
  }
  if (!exportRoot) {
    try {
      exportRoot = await resolveNativeExportRoot(settings);
    } catch (err) {
      stopNativeFolderWatch();
      throw err;
    }
  }
  if (
    nativeFolderWatcher?.exportRoot === exportRoot &&
    nativeFolderWatcher?.hostName === hostName
  ) {
    return { ok: true, watching: true, reused: true };
  }

  stopNativeFolderWatch();

  const client = createNativeClient(hostName);
  nativeFolderWatcher = { client, exportRoot, hostName };
  client.onEvent((event) => {
    handleNativeFolderEvent(event)
      .catch((err) => console.error("[RSS-BOOK] Error syncing native folder event:", err));
  });

  try {
    const response = await client.watchFolder(exportRoot, {
      intervalMs: getNativeWatchInterval(settings),
      timeoutMs: settings?.nativeTimeoutMs
    });
    return { ...response, watching: true };
  } catch (err) {
    if (nativeFolderWatcher?.client === client) {
      stopNativeFolderWatch();
    }
    throw err;
  }
}

export function stopNativeFolderWatch() {
  if (!nativeFolderWatcher) return;
  const watcher = nativeFolderWatcher;
  nativeFolderWatcher = null;
  try {
    watcher.client.disconnect();
  } catch {
    // Port may already be closed.
  }
}

export async function handleNativeFolderEvent(event) {
  if (event?.event !== "folder_changed") {
    return { ok: true, skipped: "event" };
  }

  const changes = event.changes || {};
  const results = {
    added: [],
    modified: [],
    removed: []
  };

  for (const entry of asArray(changes.added)) {
    results.added.push(await mirrorNativeEntryToBookmark(entry));
  }
  for (const entry of asArray(changes.modified)) {
    results.modified.push(await mirrorNativeEntryToBookmark(entry));
  }
  for (const entry of asArray(changes.removed)) {
    results.removed.push(await removeBookmarkForNativeEntry(entry));
  }

  return { ok: true, results };
}

async function notify(feedTitle, count, titles) {
  const message = titles.slice(0, 3).map(t => "\u2022 " + t).join("\n");
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/48.png",
    title: `${feedTitle}: ${count} neu`,
    message: message || "Neue Eintr\u00e4ge verf\u00fcgbar"
  });
}

// --- Message handling (from popup/options) ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateAll") {
    runUpdateCycle("manual")
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === "updateFeed") {
    updateOneFeed(msg.feedId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === "restartNativeWatch") {
    ensureAlarm()
      .then(() => ensureNativeFolderWatch())
      .then((response) => sendResponse({ ok: true, watch: response }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === "resolveDefaultExportRoot") {
    getState()
      .then(({ settings }) => resolveNativeExportRoot(settings))
      .then((exportRoot) => sendResponse({ ok: true, exportRoot }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === "discoverFeeds") {
    discoverFeedsOnTab(msg.tabId)
      .then((feeds) => sendResponse({ ok: true, feeds }))
      .catch((err) => sendResponse({ ok: false, error: err.message, feeds: [] }));
    return true;
  }
});

async function discoverFeedsOnTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectFeedLinksFromDocument
  });

  const scriptResult = results?.[0]?.result || { feeds: [], pageUrl: "" };
  const feeds = Array.isArray(scriptResult.feeds) ? [...scriptResult.feeds] : [];

  for (const feed of await probeCommonFeedPaths(scriptResult.pageUrl, feeds)) {
    feeds.push(feed);
  }

  return feeds;
}

async function resolveNativeExportRoot(settings = {}, options = {}) {
  const configured = getExportRoot(settings);
  if (configured) return configured;

  const client = createNativeClient(settings.nativeHostName);
  try {
    const response = await client.getDefaultExportRoot({
      folderName: settings.defaultExportFolderName || DEFAULT_EXPORT_FOLDER_NAME,
      create: true,
      timeoutMs: settings.nativeTimeoutMs
    });
    const exportRoot = getExportRoot({ exportRoot: response.exportRoot });
    if (!exportRoot) {
      throw new Error("Native host returned no default export path.");
    }
    if (options.persist !== false) {
      await updateSettings({ exportRoot });
    }
    return exportRoot;
  } finally {
    client.disconnect();
  }
}

async function mirrorNativeEntryToBookmark(entry) {
  const href = getNativeEntryHref(entry);
  const path = getNativeEntryPath(entry);
  if (!href || !path) {
    return { ok: true, skipped: "entry" };
  }

  const { settings, feeds } = await getState();
  const mode = normalizeSyncMode(settings?.mode);
  if (!(usesBookmarks(mode) && usesNativeFolder(mode))) {
    return { ok: true, skipped: "mode" };
  }

  const existing = findBookmarkMappingForNativeEntry(feeds, entry);
  const feedId = existing?.feedId || findFeedIdForNativeEntry(feeds, entry, settings);
  if (!feedId) {
    return { ok: true, skipped: "feed" };
  }

  const feed = feeds?.[feedId] || {};
  const title = getNativeEntryTitle(entry);
  let bookmarkId = existing?.bookmarkId || "";
  let folderId = feed.bookmarkFolderId || "";

  if (bookmarkId) {
    try {
      await chrome.bookmarks.update(bookmarkId, { title, url: href });
    } catch {
      bookmarkId = "";
    }
  }

  if (!bookmarkId) {
    folderId = await ensureFeedFolder(feed, folderId);
    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title,
      url: href
    });
    bookmarkId = bookmark.id;
  }

  await persistNativeBookmarkSync(feedId, feed, bookmarkId, path, {
    title,
    link: href
  }, folderId);

  return { ok: true, feedId, bookmarkId, path };
}

async function removeBookmarkForNativeEntry(entry) {
  const path = getNativeEntryPath(entry);
  if (!path) {
    return { ok: true, skipped: "entry" };
  }

  const { settings, feeds } = await getState();
  const mode = normalizeSyncMode(settings?.mode);
  if (!(usesBookmarks(mode) && usesNativeFolder(mode))) {
    return { ok: true, skipped: "mode" };
  }

  const existing = findBookmarkMappingForNativeEntry(feeds, entry);
  if (!existing) {
    return { ok: true, skipped: "mapping" };
  }

  const feed = feeds?.[existing.feedId] || {};
  await upsertFeed(existing.feedId, {
    nativePathByBookmarkId: removeNativePathForBookmark(feed.nativePathByBookmarkId, existing.bookmarkId)
  });

  try {
    await chrome.bookmarks.remove(existing.bookmarkId);
  } catch {
    return { ok: true, skipped: "bookmark" };
  }

  return { ok: true, feedId: existing.feedId, bookmarkId: existing.bookmarkId, path };
}

async function persistNativeBookmarkSync(feedId, feed, bookmarkId, path, item, folderId) {
  const normalizedPath = normalizeNativePath(path);
  const nativePathByBookmarkId = {};

  for (const [existingBookmarkId, existingPath] of Object.entries(
    isPlainObject(feed.nativePathByBookmarkId) ? feed.nativePathByBookmarkId : {}
  )) {
    if (existingBookmarkId === bookmarkId) {
      continue;
    }
    if (normalizeNativePath(existingPath) === normalizedPath) {
      continue;
    }
    nativePathByBookmarkId[existingBookmarkId] = existingPath;
  }

  nativePathByBookmarkId[bookmarkId] = path;

  const patch = {
    nativePathByBookmarkId,
    seen: buildSeenPatch(feed, [item])
  };
  if (folderId) {
    patch.bookmarkFolderId = folderId;
  }

  await upsertFeed(feedId, patch);
}

function findBookmarkMappingForNativeEntry(feeds, entry) {
  const targetPath = normalizeNativePath(getNativeEntryPath(entry));
  if (!targetPath || !isPlainObject(feeds)) return null;

  for (const [feedKey, feed] of Object.entries(feeds)) {
    const mapping = feed?.nativePathByBookmarkId;
    if (!isPlainObject(mapping)) continue;

    for (const [bookmarkId, path] of Object.entries(mapping)) {
      if (normalizeNativePath(path) === targetPath) {
        return { feedId: feed?.id || feedKey, bookmarkId };
      }
    }
  }

  return null;
}

function findFeedIdForNativeEntry(feeds, entry, settings = {}) {
  if (!isPlainObject(feeds)) return "";

  const parts = splitNativeRelativePath(entry?.relativePath || entry?.path);
  const rootFolder = sanitizeNativePathSegment(settings.rootFolderName || "RSS");
  let feedFolder = "";

  if (parts.length >= 2 && equalsPathSegment(parts[0], rootFolder)) {
    feedFolder = parts[1];
  } else if (parts.length >= 2) {
    feedFolder = parts[parts.length - 2];
  }

  if (!feedFolder) return "";

  for (const [feedKey, feed] of Object.entries(feeds)) {
    const candidates = [feed?.title, feed?.url]
      .map(sanitizeNativePathSegment)
      .filter(Boolean);
    if (candidates.some(candidate => equalsPathSegment(candidate, feedFolder))) {
      return feed?.id || feedKey;
    }
  }

  return "";
}

function getNativeEntryHref(entry) {
  return normalizeHttpUrl(entry?.href);
}

function getNativeEntryPath(entry) {
  const path = typeof entry?.path === "string" ? entry.path.trim() : "";
  if (path) return path;
  return typeof entry?.relativePath === "string" ? entry.relativePath.trim() : "";
}

function getNativeEntryTitle(entry) {
  const title = typeof entry?.title === "string" ? entry.title.trim() : "";
  if (title) return title;

  const path = String(entry?.relativePath || entry?.path || "");
  const lastPart = splitNativeRelativePath(path).at(-1) || "Unbenannt";
  return lastPart.replace(/\.url$/i, "") || "Unbenannt";
}

function getNativeWatchInterval(settings = {}) {
  const intervalMs = Number(settings.nativeWatchIntervalMs);
  return Number.isFinite(intervalMs) && intervalMs > 0
    ? intervalMs
    : DEFAULT_NATIVE_WATCH_INTERVAL_MS;
}

function splitNativeRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeNativePath(path) {
  return String(path || "").replace(/\\/g, "/").trim().toLocaleLowerCase();
}

function sanitizeNativePathSegment(value) {
  let text = String(value || "").trim().replace(/[. ]+$/g, "");
  text = text.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) text = "Unbenannt";

  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reserved.test(text)) {
    const dotIndex = text.lastIndexOf(".");
    if (dotIndex > 0) {
      text = `${text.slice(0, dotIndex)}_${text.slice(dotIndex)}`;
    } else {
      text = `${text}_`;
    }
  }

  return text.slice(0, 120).replace(/[. ]+$/g, "") || "Unbenannt";
}

function equalsPathSegment(left, right) {
  return String(left || "").toLocaleLowerCase() === String(right || "").toLocaleLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
