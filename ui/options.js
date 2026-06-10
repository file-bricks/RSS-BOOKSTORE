import { getState, upsertFeed, removeFeed, updateSettings, getAllFeeds } from "../lib/storage.js";
import { generateOPML, parseOPML } from "../lib/opml.js";
import { exportAllFeedsToFolder } from "../lib/export.js";
import { applyI18n } from "../lib/i18n.js";
import { getFeedHostPattern, hasFeedHostPermission, requestFeedHostPermission } from "../lib/permissions.js";

// --- Settings ---

async function loadSettings() {
  const { settings } = await getState();
  document.getElementById("updateOnStartup").checked = settings.updateOnStartup;
  document.getElementById("globalInterval").value = settings.globalIntervalMinutes || 0;
  document.getElementById("rootFolderName").value = settings.rootFolderName || "RSS";
  document.getElementById("deleteBookmarks").checked = settings.deleteBookmarksOnUnsubscribe || false;
  document.getElementById("syncMode").value = settings.mode || "BOOKMARKS";
  document.getElementById("exportRoot").value = settings.exportRoot || "";
}

document.getElementById("saveSettings").addEventListener("click", async () => {
  await updateSettings({
    updateOnStartup: document.getElementById("updateOnStartup").checked,
    globalIntervalMinutes: Number(document.getElementById("globalInterval").value) || 0,
    rootFolderName: document.getElementById("rootFolderName").value.trim() || "RSS",
    deleteBookmarksOnUnsubscribe: document.getElementById("deleteBookmarks").checked,
    mode: document.getElementById("syncMode").value || "BOOKMARKS",
    exportRoot: document.getElementById("exportRoot").value.trim()
  });
  chrome.runtime.sendMessage({ action: "restartNativeWatch" });
  showStatus("settingsStatus", "Gespeichert!");
});

document.getElementById("useDefaultExportRoot").addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: "resolveDefaultExportRoot" });
    if (!response?.ok) {
      throw new Error(response?.error || "Standardpfad konnte nicht ermittelt werden.");
    }
    document.getElementById("exportRoot").value = response.exportRoot || "";
    showStatus("settingsStatus", "OneDrive-Standardpfad gesetzt.");
  } catch (err) {
    showStatus("settingsStatus", `Fehler: ${err.message}`, true);
  }
});

// --- Add Feed ---

document.getElementById("addBtn").addEventListener("click", async () => {
  const urlInput = document.getElementById("feedUrl");
  const url = urlInput.value.trim();
  if (!url) return;

  const feedHostPattern = getFeedHostPattern(url);
  if (!feedHostPattern) {
    showStatus("settingsStatus", "Feed-URL muss mit http:// oder https:// beginnen.", true);
    return;
  }

  const granted = await requestFeedHostPermission(url);
  if (!granted) {
    showStatus("settingsStatus", `Hostzugriff nicht erteilt: ${feedHostPattern}`, true);
    return;
  }

  const id = crypto.randomUUID();
  await upsertFeed(id, {
    url,
    enabled: true,
    notify: true,
    intervalMinutes: 0,
    retentionDays: 30,
    bookmarkFolderId: "",
    lastFetch: 0,
    lastEtag: "",
    lastModified: "",
    lastError: "",
    seen: {}
  });

  urlInput.value = "";
  try {
    await chrome.runtime.sendMessage({ action: "updateFeed", feedId: id });
  } catch (err) {
    console.warn("[RSS-BOOKSTORE] Could not trigger initial feed update:", err.message);
  }
  await renderFeeds();
});

// --- OPML Import ---

document.getElementById("importOPMLBtn").addEventListener("click", () => {
  document.getElementById("opmlFileInput").click();
});

document.getElementById("opmlFileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = parseOPML(text);
    if (parsed.length === 0) {
      showStatus("feedStatus", "Keine Feeds in OPML gefunden.", true);
      return;
    }

    let imported = 0;
    const { feeds } = await getState();
    const existingUrls = new Set(Object.values(feeds).map(f => f.url));

    for (const item of parsed) {
      if (existingUrls.has(item.url)) continue;
      const id = crypto.randomUUID();
      await upsertFeed(id, {
        url: item.url,
        title: item.title,
        enabled: true,
        notify: true,
        intervalMinutes: 0,
        retentionDays: 30,
        bookmarkFolderId: "",
        lastFetch: 0,
        lastEtag: "",
        lastModified: "",
        lastError: "",
        seen: {}
      });
      imported++;
    }

    showStatus("feedStatus", `${imported} Feeds importiert.`);
    await renderFeeds();
  } catch (err) {
    showStatus("feedStatus", `Fehler: ${err.message}`, true);
  }

  e.target.value = "";
});

// --- OPML Export ---

document.getElementById("exportOPMLBtn").addEventListener("click", async () => {
  const feeds = await getAllFeeds();
  if (feeds.length === 0) return;

  const opml = generateOPML(feeds);
  const blob = new Blob([opml], { type: "text/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "rss-bookstore-feeds.opml";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showStatus("feedStatus", "OPML exportiert.");
});

// --- Folder Export (Einweg, File System Access API) ---

document.getElementById("exportAllFoldersBtn").addEventListener("click", async () => {
  try {
    const feeds = await getAllFeeds();
    const exported = await exportAllFeedsToFolder(feeds);
    showStatus("feedStatus", `${exported} Lesezeichen exportiert.`);
  } catch (err) {
    showStatus("feedStatus", `Fehler: ${err.message}`, true);
  }
});

// --- Feed List ---

async function renderFeeds() {
  const { feeds } = await getState();
  const list = document.getElementById("feedList");
  const feedArray = Object.values(feeds);

  if (feedArray.length === 0) {
    list.innerHTML = '<div class="empty">Noch keine Feeds abonniert.</div>';
    return;
  }

  list.innerHTML = "";
  for (const feed of feedArray) {
    const hasHostAccess = await hasFeedHostPermission(feed.url);
    const hostPattern = getFeedHostPattern(feed.url);
    const card = document.createElement("div");
    card.className = `feed-card${feed.enabled ? "" : " disabled"}${feed.lastError ? " has-error" : ""}`;

    const errorHtml = feed.lastError
      ? `<div class="feed-error">${escapeHtml(feed.lastError)}</div>`
      : "";

    card.innerHTML = `
      <div class="feed-header">
        <span class="feed-title">${escapeHtml(feed.title || feed.url)}</span>
        <button class="danger" data-action="remove" data-id="${feed.id}">Deabonnieren</button>
      </div>
      <div class="feed-url">${escapeHtml(feed.url)}</div>
      ${errorHtml}
      ${hostPattern && !hasHostAccess ? `
        <div class="feed-permission">
          <button type="button" data-action="grant-permission" data-id="${feed.id}">
            Hostzugriff erlauben
          </button>
          <span>${escapeHtml(hostPattern)}</span>
        </div>
      ` : ""}
      <div class="feed-controls">
        <label>
          <input type="checkbox" data-field="enabled" data-id="${feed.id}" ${feed.enabled ? "checked" : ""}>
          Aktiv
        </label>
        <label>
          <input type="checkbox" data-field="notify" data-id="${feed.id}" ${feed.notify ? "checked" : ""}>
          Benachrichtigung
        </label>
        <label>
          Intervall (Min):
          <input type="number" data-field="intervalMinutes" data-id="${feed.id}" value="${feed.intervalMinutes || 0}" min="0">
        </label>
        <label>
          Behalten (Tage):
          <input type="number" data-field="retentionDays" data-id="${feed.id}" value="${feed.retentionDays || 0}" min="0">
        </label>
      </div>
    `;

    card.addEventListener("change", async (e) => {
      const field = e.target?.dataset?.field;
      const id = e.target?.dataset?.id;
      if (!field || !id) return;
      const value = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
      await upsertFeed(id, { [field]: value });
    });

    card.querySelector("[data-action='remove']").addEventListener("click", async () => {
      const { settings } = await getState();
      if (settings.deleteBookmarksOnUnsubscribe && feed.bookmarkFolderId) {
        try {
          await chrome.bookmarks.removeTree(feed.bookmarkFolderId);
        } catch { /* folder already gone */ }
      }
      await removeFeed(feed.id);
      await renderFeeds();
    });

    const grantButton = card.querySelector("[data-action='grant-permission']");
    if (grantButton) {
      grantButton.addEventListener("click", async () => {
        const granted = await requestFeedHostPermission(feed.url);
        if (!granted) {
          showStatus("settingsStatus", `Hostzugriff nicht erteilt: ${hostPattern}`, true);
          return;
        }
        showStatus("settingsStatus", `Hostzugriff erteilt: ${hostPattern}`);
        await renderFeeds();
      });
    }

    list.appendChild(card);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(elementId, text, isError = false) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = `status${isError ? " error" : ""}`;
  setTimeout(() => {
    el.textContent = "";
    el.className = "status";
  }, 3000);
}

// --- Init ---

applyI18n();
loadSettings();
renderFeeds();
