export function getFeedHostPattern(feedUrl) {
  let parsed;
  try {
    parsed = new URL(String(feedUrl || "").trim());
  } catch {
    return "";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "";
  }
  if (!parsed.hostname) {
    return "";
  }

  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}/*`;
}

export async function hasFeedHostPermission(feedUrl) {
  const origin = getFeedHostPattern(feedUrl);
  if (!origin || !globalThis.chrome?.permissions?.contains) {
    return false;
  }

  return chrome.permissions.contains({ origins: [origin] });
}

export async function requestFeedHostPermission(feedUrl) {
  const origin = getFeedHostPattern(feedUrl);
  if (!origin || !globalThis.chrome?.permissions?.request) {
    return false;
  }

  return chrome.permissions.request({ origins: [origin] });
}
