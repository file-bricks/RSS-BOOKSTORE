const COMMON_FEED_PATHS = [
  "/feed",
  "/feed/",
  "/rss",
  "/rss/",
  "/atom.xml",
  "/feed.xml",
  "/rss.xml",
  "/index.xml",
  "/feeds/posts/default"
];

export function collectFeedLinksFromDocument() {
  const found = [];
  const seen = new Set();
  const add = (url, title) => {
    if (!url) return;
    try {
      const abs = new URL(url, location.href).href;
      if (seen.has(abs)) return;
      seen.add(abs);
      found.push({ url: abs, title: title || "" });
    } catch {}
  };

  for (const link of document.querySelectorAll("link[href]")) {
    const relTokens = (link.getAttribute("rel") || "").toLowerCase().split(/\s+/);
    if (!relTokens.includes("alternate")) continue;

    const type = (link.getAttribute("type") || "").toLowerCase();
    if (
      type.includes("rss") ||
      type.includes("atom") ||
      type === "application/xml" ||
      type === "text/xml"
    ) {
      add(link.href, link.title);
    }
  }

  const feedRe = /(^|\/)(feed|rss|atom|feeds|feed\.xml|rss\.xml|atom\.xml|index\.xml)(\/|\.xml|$|\?)/i;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") || "";
    const text = (anchor.textContent || "").trim().toLowerCase();
    if (feedRe.test(href) || /^(rss|atom|feed)$/i.test(text)) {
      add(anchor.href, anchor.title || anchor.textContent?.trim() || "");
    }
  }

  return { feeds: found, pageUrl: location.href };
}

export async function probeCommonFeedPaths(pageUrl, existingFeeds = [], fetchImpl = globalThis.fetch) {
  if (!pageUrl || typeof fetchImpl !== "function") return [];

  const discovered = [];
  const seen = new Set(existingFeeds.map((feed) => feed.url).filter(Boolean));
  let origin;

  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  const probes = await Promise.all(COMMON_FEED_PATHS.map(async (path) => {
    const url = origin + path;
    if (seen.has(url)) return null;

    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "follow" });
      if (!response.ok) return null;

      const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
      const text = (await response.text()).slice(0, 2048);
      const looksFeed =
        contentType.includes("xml") ||
        contentType.includes("rss") ||
        contentType.includes("atom") ||
        /<rss[\s>]/i.test(text) ||
        /<feed[\s>]/i.test(text) ||
        /<rdf:RDF[\s>]/i.test(text);

      return looksFeed ? { url: response.url || url, title: "" } : null;
    } catch {
      return null;
    }
  }));

  for (const feed of probes) {
    if (feed && !seen.has(feed.url)) {
      seen.add(feed.url);
      discovered.push(feed);
    }
  }

  return discovered;
}
