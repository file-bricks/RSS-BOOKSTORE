import { upsertFeed } from "./storage.js";
import { makeFeedItemKey } from "./sync.js";
import { normalizeHttpUrl } from "./url_safety.js";

const ROOT_FOLDER_TITLE = "RSS";
const MAX_ITEMS_PER_BATCH = 20;

export async function ensureFeedFolder(feed, existingFolderId) {
  if (existingFolderId) {
    try {
      const nodes = await chrome.bookmarks.get(existingFolderId);
      if (nodes?.[0]?.id) return existingFolderId;
    } catch { /* folder was deleted, recreate */ }
  }

  const rootId = await ensureRootFolder();
  const title = feed.title || feed.url;
  const folder = await chrome.bookmarks.create({ parentId: rootId, title });
  return folder.id;
}

async function ensureRootFolder() {
  const tree = await chrome.bookmarks.getTree();
  const otherBookmarks = findOtherBookmarks(tree[0]);
  const parentId = otherBookmarks?.id || tree[0].children?.[1]?.id || tree[0].children?.[0]?.id;

  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(c => !c.url && c.title === ROOT_FOLDER_TITLE);
  if (existing) return existing.id;

  const root = await chrome.bookmarks.create({ parentId, title: ROOT_FOLDER_TITLE });
  return root.id;
}

function findOtherBookmarks(node) {
  // Chrome: "Other Bookmarks" or "Andere Lesezeichen" (typically id "2")
  const otherTitles = ["Other bookmarks", "Other Bookmarks", "Andere Lesezeichen", "Weitere Lesezeichen"];
  if (otherTitles.includes(node.title)) return node;
  for (const child of (node.children || [])) {
    const found = findOtherBookmarks(child);
    if (found) return found;
  }
  return null;
}

export async function addItemsToBookmarks(feed, folderId, items, options = {}) {
  const seen = { ...(feed.seen || {}) };
  let addedCount = 0;
  const newestTitles = [];
  const addedItems = [];
  const addedBookmarks = [];
  const markSeen = options.markSeen !== false;

  for (const item of items) {
    if (addedCount >= MAX_ITEMS_PER_BATCH) break;

    const key = makeFeedItemKey(item);
    if (seen[key]) continue;
    const safeLink = normalizeHttpUrl(item.link);
    if (!safeLink) continue;

    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: item.title,
      url: safeLink
    });

    seen[key] = Date.now();
    addedCount++;
    newestTitles.push(item.title);
    addedItems.push(item);
    addedBookmarks.push({
      id: bookmark.id,
      title: bookmark.title || item.title,
      url: bookmark.url || safeLink
    });
  }

  if (markSeen) {
    trimLRU(seen, 800);
    await upsertFeed(feed.id, { seen });
  }

  return { addedCount, newestTitles, addedItems, addedBookmarks };
}

export async function pruneOldBookmarks(feed) {
  const days = feed.retentionDays;
  if (!days || days <= 0) return;
  if (!feed.bookmarkFolderId) return;

  const cutoff = Date.now() - days * 24 * 60 * 60_000;

  let children;
  try {
    children = await chrome.bookmarks.getChildren(feed.bookmarkFolderId);
  } catch {
    return; // folder doesn't exist
  }

  for (const node of children) {
    if (!node.url) continue;
    if (node.dateAdded && node.dateAdded < cutoff) {
      await chrome.bookmarks.remove(node.id);
    }
  }
}

function trimLRU(seen, max) {
  const keys = Object.keys(seen);
  if (keys.length <= max) return;
  keys.sort((a, b) => seen[a] - seen[b]);
  for (let i = 0; i < keys.length - max; i++) {
    delete seen[keys[i]];
  }
}
