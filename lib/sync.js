import { normalizeHttpUrl } from "./url_safety.js";

export const SYNC_MODES = Object.freeze({
  BOOKMARKS: "BOOKMARKS",
  FOLDER: "FOLDER",
  SYNC: "SYNC"
});

export const DEFAULT_EXPORT_FOLDER_NAME = "RSS-BOOKSTORE";
const DEFAULT_ROOT_FOLDER_NAME = "RSS";
const MAX_ITEMS_PER_BATCH = 20;
const MAX_SEEN_ITEMS = 800;

export function normalizeSyncMode(mode) {
  return Object.values(SYNC_MODES).includes(mode) ? mode : SYNC_MODES.BOOKMARKS;
}

export function usesBookmarks(mode) {
  const normalized = normalizeSyncMode(mode);
  return normalized === SYNC_MODES.BOOKMARKS || normalized === SYNC_MODES.SYNC;
}

export function usesNativeFolder(mode) {
  const normalized = normalizeSyncMode(mode);
  return normalized === SYNC_MODES.FOLDER || normalized === SYNC_MODES.SYNC;
}

export function getExportRoot(settings = {}) {
  const root = typeof settings.exportRoot === "string" ? settings.exportRoot.trim() : "";
  return root;
}

export function mergeNativePathByBookmarkId(currentMapping = {}, addedBookmarks = [], createdPaths = []) {
  const next = isObject(currentMapping) ? { ...currentMapping } : {};
  const limit = Math.min(addedBookmarks.length, createdPaths.length);

  for (let index = 0; index < limit; index++) {
    const bookmarkId = String(addedBookmarks[index]?.id || "").trim();
    const path = typeof createdPaths[index] === "string" ? createdPaths[index].trim() : "";
    if (bookmarkId && path) {
      next[bookmarkId] = path;
    }
  }

  return next;
}

export function findNativePathForBookmark(feeds = {}, bookmarkId) {
  const id = String(bookmarkId || "").trim();
  if (!id || !isObject(feeds)) return null;

  for (const [feedKey, feed] of Object.entries(feeds)) {
    const mapping = feed?.nativePathByBookmarkId;
    if (!isObject(mapping)) continue;

    const path = typeof mapping[id] === "string" ? mapping[id].trim() : "";
    if (path) {
      return { feedId: feed?.id || feedKey, path };
    }
  }

  return null;
}

export function removeNativePathForBookmark(currentMapping = {}, bookmarkId) {
  const next = isObject(currentMapping) ? { ...currentMapping } : {};
  delete next[String(bookmarkId || "").trim()];
  return next;
}

export function selectFreshFeedItems(feed, items, maxItems = MAX_ITEMS_PER_BATCH) {
  const seen = { ...(feed?.seen || {}) };
  const freshItems = [];

  for (const item of items || []) {
    if (freshItems.length >= maxItems) break;
    const safeLink = normalizeHttpUrl(item?.link);
    if (!safeLink) continue;

    const key = makeFeedItemKey(item);
    if (seen[key]) continue;

    seen[key] = Date.now();
    freshItems.push({ ...item, link: safeLink });
  }

  return freshItems;
}

export function buildSeenPatch(feed, deliveredItems, timestamp = Date.now()) {
  const seen = { ...(feed?.seen || {}) };
  for (const item of deliveredItems || []) {
    if (!normalizeHttpUrl(item?.link)) continue;
    seen[makeFeedItemKey(item)] = timestamp;
  }
  trimLRU(seen, MAX_SEEN_ITEMS);
  return seen;
}

export function toNativeExportItems(feed, items, settings = {}) {
  const rootFolder = cleanFolderPart(settings.rootFolderName || DEFAULT_ROOT_FOLDER_NAME);
  const feedFolder = cleanFolderPart(feed?.title || feed?.url || "Feed");

  return (items || [])
    .map(item => ({ item, safeLink: normalizeHttpUrl(item?.link) }))
    .filter(({ safeLink }) => safeLink)
    .map(({ item, safeLink }) => ({
      folderParts: [rootFolder, feedFolder],
      title: item.title || safeLink,
      url: safeLink
    }));
}

export function makeFeedItemKey(item) {
  return item.guid || item.link || simpleHash(`${item.title}|${item.published}|${item.link}`);
}

function cleanFolderPart(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_ROOT_FOLDER_NAME;
}

function simpleHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return (h >>> 0).toString(16);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimLRU(seen, max) {
  const keys = Object.keys(seen);
  if (keys.length <= max) return;
  keys.sort((a, b) => seen[a] - seen[b]);
  for (let i = 0; i < keys.length - max; i++) {
    delete seen[keys[i]];
  }
}
