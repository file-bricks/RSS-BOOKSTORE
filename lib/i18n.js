export function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

export function applyI18n(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    const text = t(key);
    if (text && text !== key) el.textContent = text;
  }
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) {
    const key = el.getAttribute("data-i18n-placeholder");
    const text = t(key);
    if (text && text !== key) el.placeholder = text;
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    const key = el.getAttribute("data-i18n-title");
    const text = t(key);
    if (text && text !== key) el.title = text;
  }
}
