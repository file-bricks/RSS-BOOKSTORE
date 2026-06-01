const DEFAULT_SETTINGS = {
  updateOnStartup: true,
  globalIntervalMinutes: 0,
  rootFolderName: "RSS",
  rootFolderId: "",
  deleteBookmarksOnUnsubscribe: false,
  mode: "BOOKMARKS",
  exportRoot: ""
};

export async function getState() {
  const data = await chrome.storage.local.get(["settings", "feeds"]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    feeds: data.feeds || {}
  };
}

export async function setState(state) {
  await chrome.storage.local.set(state);
}

export async function getSettings() {
  const { settings } = await getState();
  return settings;
}

export async function updateSettings(patch) {
  const { settings } = await getState();
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}

export async function upsertFeed(feedId, patch) {
  const { feeds } = await getState();
  feeds[feedId] = { ...(feeds[feedId] || {}), ...patch, id: feedId };
  await chrome.storage.local.set({ feeds });
}

export async function removeFeed(feedId) {
  const { feeds } = await getState();
  delete feeds[feedId];
  await chrome.storage.local.set({ feeds });
}

export async function getAllFeeds() {
  const { feeds } = await getState();
  return Object.values(feeds);
}

export async function getEnabledFeeds() {
  const feeds = await getAllFeeds();
  return feeds.filter(f => f.enabled);
}
