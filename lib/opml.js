export function generateOPML(feeds) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    '    <title>RSS-BOOKSTORE Feeds</title>',
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    '  </head>',
    '  <body>'
  ];

  for (const feed of feeds) {
    const title = escapeXml(feed.title || feed.url);
    const url = escapeXml(feed.url);
    lines.push(`    <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" />`);
  }

  lines.push('  </body>', '</opml>', '');
  return lines.join('\n');
}

export function parseOPML(xmlText) {
  const feeds = [];
  const re = /<outline\s[^>]*xmlUrl\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;

  for (const match of xmlText.matchAll(re)) {
    const tag = match[0];
    const xmlUrl = decodeXmlEntities(match[1]);
    if (!xmlUrl) continue;

    const textMatch = tag.match(/\btext\s*=\s*["']([^"']*)["']/i);
    const titleMatch = tag.match(/\btitle\s*=\s*["']([^"']*)["']/i);
    const title = decodeXmlEntities((titleMatch || textMatch)?.[1] || "");

    feeds.push({ url: xmlUrl, title });
  }

  return feeds;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
