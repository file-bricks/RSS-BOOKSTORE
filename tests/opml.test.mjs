import { test } from "node:test";
import assert from "node:assert/strict";

import { generateOPML, parseOPML } from "../lib/opml.js";

// --- generateOPML ---

test("generateOPML produces valid OPML with title and feed entries", () => {
  const opml = generateOPML([
    { url: "https://example.com/feed.xml", title: "Example Feed" },
    { url: "https://other.org/rss", title: "Other" }
  ]);

  assert.ok(opml.includes('<?xml version="1.0"'));
  assert.ok(opml.includes('<opml version="2.0">'));
  assert.ok(opml.includes("<title>RSS-BOOKSTORE Feeds</title>"));
  assert.ok(opml.includes('xmlUrl="https://example.com/feed.xml"'));
  assert.ok(opml.includes('xmlUrl="https://other.org/rss"'));
  assert.ok(opml.includes('text="Example Feed"'));
  assert.ok(opml.includes('text="Other"'));
});

test("generateOPML escapes XML special characters in title and url", () => {
  const opml = generateOPML([
    { url: "https://example.com/feed?a=1&b=2", title: 'Feed <"special"> & more' }
  ]);

  assert.ok(opml.includes("a=1&amp;b=2"));
  assert.ok(opml.includes("Feed &lt;&quot;special&quot;&gt; &amp; more"));
  assert.ok(!opml.includes("<\"special\">"));
  assert.ok(!opml.includes("a=1&b=2"));
});

test("generateOPML falls back to url when title is empty", () => {
  const opml = generateOPML([{ url: "https://example.com/feed.xml", title: "" }]);
  assert.ok(opml.includes('text="https://example.com/feed.xml"'));
});

test("generateOPML returns well-formed OPML for empty feed list", () => {
  const opml = generateOPML([]);
  assert.ok(opml.includes("<body>"));
  assert.ok(opml.includes("</body>"));
  assert.ok(!opml.includes("<outline"));
});

// --- parseOPML ---

test("parseOPML extracts feeds from standard OPML", () => {
  const xml = `<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Feed A" title="Feed A" type="rss" xmlUrl="https://a.com/feed.xml" />
    <outline text="Feed B" title="Feed B" type="rss" xmlUrl="https://b.com/rss" />
  </body>
</opml>`;

  const feeds = parseOPML(xml);
  assert.equal(feeds.length, 2);
  assert.equal(feeds[0].url, "https://a.com/feed.xml");
  assert.equal(feeds[0].title, "Feed A");
  assert.equal(feeds[1].url, "https://b.com/rss");
});

test("parseOPML decodes XML entities in title and url", () => {
  const xml = `<opml><body>
    <outline text="A &amp; B" xmlUrl="https://example.com/feed?a=1&amp;b=2" />
  </body></opml>`;

  const [feed] = parseOPML(xml);
  assert.equal(feed.title, "A & B");
  assert.equal(feed.url, "https://example.com/feed?a=1&b=2");
});

test("parseOPML falls back to text attribute when title is absent", () => {
  const xml = `<opml><body>
    <outline text="Only Text" xmlUrl="https://example.com/feed.xml" />
  </body></opml>`;

  const [feed] = parseOPML(xml);
  assert.equal(feed.title, "Only Text");
});

test("parseOPML ignores outlines without xmlUrl", () => {
  const xml = `<opml><body>
    <outline text="No URL" type="rss" />
    <outline text="Has URL" type="rss" xmlUrl="https://example.com/feed.xml" />
  </body></opml>`;

  const feeds = parseOPML(xml);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].title, "Has URL");
});

test("parseOPML returns empty array for invalid XML", () => {
  assert.deepEqual(parseOPML("not xml at all"), []);
  assert.deepEqual(parseOPML(""), []);
});

test("generateOPML output is parseable by parseOPML", () => {
  const original = [
    { url: "https://example.com/feed.xml", title: "Example" },
    { url: "https://other.org/rss?x=1&y=2", title: "Other & More" }
  ];

  const roundtripped = parseOPML(generateOPML(original));
  assert.equal(roundtripped.length, 2);
  assert.equal(roundtripped[0].url, original[0].url);
  assert.equal(roundtripped[0].title, original[0].title);
  assert.equal(roundtripped[1].url, original[1].url);
  assert.equal(roundtripped[1].title, original[1].title);
});
