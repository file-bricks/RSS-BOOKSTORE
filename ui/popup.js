import { getAllFeeds, upsertFeed, getSettings } from "../lib/storage.js";
import { applyI18n } from "../lib/i18n.js";

const feedList = document.getElementById("feedList");
const statusEl = document.getElementById("status");
const discoverSection = document.getElementById("discoverSection");

function getDiscoveredFeedAddLabel(feed) {
  const target = (feed.title || feed.url || "Feed").trim();
  return `Feed hinzufügen: ${target}`;
}

async function render() {
  const feeds = await getAllFeeds();

  if (feeds.length === 0) {
    feedList.innerHTML = '<div class="empty">Keine Feeds abonniert.<br>Klicke auf Einstellungen.</div>';
    return;
  }

  feedList.innerHTML = "";
  for (const feed of feeds) {
    const div = document.createElement("div");
    div.className = "feed-item";

    const name = document.createElement("span");
    name.className = "feed-name";
    name.textContent = feed.title || feed.url;
    name.title = feed.url;

    const info = document.createElement("div");
    info.className = "feed-info";

    const time = document.createElement("span");
    time.className = "feed-count";
    if (feed.lastFetch) {
      const ago = Math.round((Date.now() - feed.lastFetch) / 60000);
      time.textContent = ago < 1 ? "gerade eben" : `vor ${ago} Min`;
    } else {
      time.textContent = "nie aktualisiert";
    }
    info.appendChild(time);

    if (feed.lastError) {
      const err = document.createElement("span");
      err.className = "feed-error";
      err.textContent = feed.lastError;
      err.title = feed.lastError;
      info.appendChild(err);
    }

    div.appendChild(name);
    div.appendChild(info);
    feedList.appendChild(div);
  }
}

// Update all
document.getElementById("updateBtn").addEventListener("click", async () => {
  const btn = document.getElementById("updateBtn");
  showStatus("Aktualisiere...", "");
  btn.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({ action: "updateAll" });
    if (res?.ok) {
      showStatus("Fertig!", "success");
    } else {
      showStatus(`Fehler: ${res?.error || "Unbekannt"}`, "error");
    }
  } catch (err) {
    showStatus(`Fehler: ${err.message}`, "error");
  }

  btn.disabled = false;
  setTimeout(() => { statusEl.textContent = ""; statusEl.className = "status"; }, 3000);
  await render();
});

// Feed Autodiscovery
document.getElementById("discoverBtn").addEventListener("click", async () => {
  const btn = document.getElementById("discoverBtn");
  btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showStatus("Kein aktiver Tab.", "");
      btn.disabled = false;
      return;
    }

    const res = await chrome.runtime.sendMessage({ action: "discoverFeeds", tabId: tab.id });
    if (res?.ok && res.feeds.length > 0) {
      showDiscoveredFeeds(res.feeds);
    } else {
      discoverSection.className = "discover-section";
      showStatus("Keine Feeds gefunden.", "");
    }
  } catch (err) {
    showStatus(`Fehler: ${err.message}`, "error");
  }

  btn.disabled = false;
});

function showDiscoveredFeeds(feeds) {
  discoverSection.className = "discover-section visible";
  discoverSection.innerHTML = `<div class="discover-info">${feeds.length} Feed(s) gefunden</div>`;

  for (const feed of feeds) {
    const row = document.createElement("div");
    row.className = "discover-item";

    const label = document.createElement("span");
    label.textContent = feed.title || feed.url;
    label.title = feed.url;

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    const addLabel = getDiscoveredFeedAddLabel(feed);
    addBtn.title = addLabel;
    addBtn.setAttribute("aria-label", addLabel);
    addBtn.addEventListener("click", async () => {
      const id = crypto.randomUUID();
      await upsertFeed(id, {
        url: feed.url,
        title: feed.title,
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
      try {
        await chrome.runtime.sendMessage({ action: "updateFeed", feedId: id });
      } catch {}
      addBtn.textContent = "✓";
      addBtn.disabled = true;
      addBtn.title = `Hinzugefügt: ${feed.title || feed.url}`;
      addBtn.setAttribute("aria-label", addBtn.title);
      showStatus("Feed hinzugefügt.", "success");
      setTimeout(() => { statusEl.textContent = ""; statusEl.className = "status"; }, 2000);
      await render();
    });

    row.appendChild(label);
    row.appendChild(addBtn);
    discoverSection.appendChild(row);
  }
}

// Open bookmarks
document.getElementById("openFeedsBtn").addEventListener("click", async () => {
  const settings = await getSettings();
  const folderId = settings.rootFolderId || "";
  const isEdge = navigator.userAgent.includes("Edg/");
  const url = isEdge
    ? `edge://favorites/${folderId ? "?id=" + folderId : ""}`
    : `chrome://bookmarks/${folderId ? "?id=" + folderId : ""}`;
  await chrome.tabs.create({ url });
  window.close();
});

// Settings
document.getElementById("optionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function showStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = "status" + (type ? ` ${type}` : "");
}

applyI18n();
render();
