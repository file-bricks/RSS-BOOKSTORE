export async function fetchFeedAndParse(url, cache = {}) {
  const headers = {};
  if (cache.etag) headers["If-None-Match"] = cache.etag;
  if (cache.lastModified) headers["If-Modified-Since"] = cache.lastModified;

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    console.warn(`[RSS-BOOK] Fetch failed for ${url}:`, err.message);
    return null;
  }

  if (res.status === 304) {
    return { title: "", items: [], etag: cache.etag, lastModified: cache.lastModified };
  }
  if (!res.ok) {
    console.warn(`[RSS-BOOK] Feed returned ${res.status}: ${url}`);
    return null;
  }

  const text = await res.text();
  const etag = res.headers.get("ETag") || "";
  const lastModified = res.headers.get("Last-Modified") || "";

  const doc = new DOMParser().parseFromString(text, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    console.warn(`[RSS-BOOK] XML parse error for ${url}`);
    return null;
  }

  // Atom?
  const atomFeed = doc.querySelector("feed");
  if (atomFeed) {
    const title = atomFeed.querySelector("title")?.textContent?.trim() || "";
    const items = [...atomFeed.querySelectorAll("entry")].map(parseAtomEntry);
    return { title, items, etag, lastModified };
  }

  // RSS 2.0?
  const rssChannel = doc.querySelector("rss channel") || doc.querySelector("channel");
  if (rssChannel) {
    const title = rssChannel.querySelector(":scope > title")?.textContent?.trim() || "";
    const items = [...doc.querySelectorAll("item")].map(parseRssItem);
    return { title, items, etag, lastModified };
  }

  console.warn(`[RSS-BOOK] Unknown feed format: ${url}`);
  return null;
}

function parseRssItem(item) {
  const title = item.querySelector("title")?.textContent?.trim() || "(ohne Titel)";
  const link = item.querySelector("link")?.textContent?.trim() || "";
  const guid = item.querySelector("guid")?.textContent?.trim() || "";
  const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";
  return { title, link, guid, published: pubDate };
}

function parseAtomEntry(entry) {
  const title = entry.querySelector("title")?.textContent?.trim() || "(ohne Titel)";
  const link =
    entry.querySelector("link[rel='alternate']")?.getAttribute("href") ||
    entry.querySelector("link")?.getAttribute("href") ||
    "";
  const id = entry.querySelector("id")?.textContent?.trim() || "";
  const updated = entry.querySelector("updated")?.textContent?.trim() || "";
  return { title, link, guid: id, published: updated };
}
