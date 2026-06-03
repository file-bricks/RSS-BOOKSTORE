export function normalizeHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text || /[\r\n]/.test(text)) {
    return "";
  }

  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}
