"""Reusable FavExtract helpers for RSS-BOOKSTORE native host tooling."""

from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
import re
from urllib.parse import urlsplit


INVALID_FILENAME_CHARS = '<>:"/\\|?*'
WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}


@dataclass(slots=True)
class BookmarkNode:
    """Simple tree node for exported folders and links."""

    type: str
    title: str
    href: str | None = None
    children: list["BookmarkNode"] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.type not in {"folder", "link"}:
            raise ValueError(f"Unsupported bookmark node type: {self.type}")

    def to_dict(self) -> dict[str, object]:
        """Serialize the node into JSON-friendly data for native messaging."""
        data: dict[str, object] = {
            "type": self.type,
            "title": self.title,
        }
        if self.href:
            data["href"] = self.href
        if self.type == "folder":
            data["children"] = [child.to_dict() for child in self.children]
        return data


def sanitize_filename(name: str, replacement: str = "_", max_len: int = 180) -> str:
    """Return a Windows-safe filename while keeping the extension intact."""
    safe_name = name.strip().rstrip(". ")
    safe_name = re.sub(rf"[{re.escape(INVALID_FILENAME_CHARS)}\x00-\x1f]", replacement, safe_name)
    safe_name = re.sub(r"\s+", " ", safe_name).strip()

    if not safe_name:
        safe_name = "Unbenannt"

    base, ext = os.path.splitext(safe_name)
    if base.upper() in WINDOWS_RESERVED_NAMES:
        safe_name = f"{base}_{ext}"
        base, ext = os.path.splitext(safe_name)

    if len(safe_name) > max_len:
        ext = ext[:10]
        keep = max(max_len - len(ext), 1)
        safe_name = f"{base[:keep]}{ext}"

    return safe_name.rstrip(". ") or "Unbenannt"


def read_url_file(path: str | Path) -> str | None:
    """Read the URL from a Windows Internet Shortcut file."""
    shortcut_path = Path(path)
    try:
        with shortcut_path.open("r", encoding="utf-8-sig", errors="replace") as handle:
            for line in handle:
                stripped = line.strip()
                if stripped.upper().startswith("URL="):
                    return normalize_http_url(stripped[4:])
    except OSError:
        return None
    return None


def ensure_unique_path(path: str | Path) -> Path:
    """Return a non-conflicting path by appending ' (N)' before the suffix."""
    candidate = Path(path)
    if not candidate.exists():
        return candidate

    index = 2
    while True:
        numbered = candidate.with_name(f"{candidate.stem} ({index}){candidate.suffix}")
        if not numbered.exists():
            return numbered
        index += 1


def write_url_file(folder_path: str | Path, title: str, href: str) -> Path | None:
    """Create a .url shortcut file and return its final path."""
    safe_href = normalize_http_url(href)
    if not safe_href:
        return None

    target_dir = Path(folder_path)
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = sanitize_filename(title)
    if not filename.lower().endswith(".url"):
        filename = f"{filename}.url"

    shortcut_path = ensure_unique_path(target_dir / filename)
    content = f"[InternetShortcut]\r\nURL={safe_href}\r\n"
    with shortcut_path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(content)
    return shortcut_path


def normalize_http_url(href: str | None) -> str | None:
    """Return a single-line http(s) URL, or None for unsafe shortcut targets."""
    text = str(href or "").strip()
    if not text or "\r" in text or "\n" in text:
        return None

    parsed = urlsplit(text)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        return None
    return text


def scan_url_folder(folder_path: str | Path) -> BookmarkNode:
    """Scan a folder recursively and return a bookmark tree for .url files."""
    root_path = Path(folder_path)
    root = BookmarkNode("folder", root_path.name or str(root_path))

    for entry in sorted(root_path.iterdir(), key=lambda item: item.name.casefold()):
        if entry.is_dir():
            child = scan_url_folder(entry)
            if child.children:
                root.children.append(child)
        elif entry.is_file() and entry.suffix.lower() == ".url":
            url = read_url_file(entry)
            if url:
                root.children.append(BookmarkNode("link", entry.stem, url))

    return root


__all__ = [
    "BookmarkNode",
    "ensure_unique_path",
    "normalize_http_url",
    "read_url_file",
    "sanitize_filename",
    "scan_url_folder",
    "write_url_file",
]
