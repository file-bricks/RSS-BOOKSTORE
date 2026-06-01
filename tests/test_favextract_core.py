"""Tests for the reusable FavExtract helpers."""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from _native_host.favextract_core import (
    BookmarkNode,
    ensure_unique_path,
    read_url_file,
    sanitize_filename,
    scan_url_folder,
    write_url_file,
)


class SanitizeFilenameTests(unittest.TestCase):
    def test_replaces_invalid_characters(self) -> None:
        self.assertEqual(sanitize_filename(" report<>.md. "), "report__.md")

    def test_falls_back_for_empty_name(self) -> None:
        self.assertEqual(sanitize_filename("   "), "Unbenannt")

    def test_handles_windows_reserved_names(self) -> None:
        self.assertEqual(sanitize_filename("CON"), "CON_")

    def test_preserves_extension_when_truncating(self) -> None:
        result = sanitize_filename(f"{'x' * 80}.markdown", max_len=20)
        self.assertLessEqual(len(result), 20)
        self.assertTrue(result.endswith(".markdown"[:10]))


class UrlFileTests(unittest.TestCase):
    def test_ensure_unique_path_adds_counter(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_path = Path(temp_dir) / "entry.url"
            base_path.write_text("existing", encoding="utf-8")
            unique_path = ensure_unique_path(base_path)
            self.assertEqual(unique_path.name, "entry (2).url")

    def test_write_url_file_creates_shortcut_and_deduplicates(self) -> None:
        with TemporaryDirectory() as temp_dir:
            first = write_url_file(temp_dir, "Article", "https://example.com/a")
            second = write_url_file(temp_dir, "Article", "https://example.com/b")

            self.assertIsNotNone(first)
            self.assertIsNotNone(second)
            assert first is not None
            assert second is not None
            self.assertEqual(first.name, "Article.url")
            self.assertEqual(second.name, "Article (2).url")
            self.assertEqual(read_url_file(first), "https://example.com/a")
            self.assertEqual(read_url_file(second), "https://example.com/b")

    def test_write_url_file_returns_none_without_href(self) -> None:
        with TemporaryDirectory() as temp_dir:
            self.assertIsNone(write_url_file(temp_dir, "Empty", ""))


class ScanFolderTests(unittest.TestCase):
    def test_scan_url_folder_builds_tree(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tech_dir = root / "Tech"
            tech_dir.mkdir()

            write_url_file(root, "Homepage", "https://example.com")
            write_url_file(tech_dir, "Docs", "https://example.com/docs")
            (root / "notes.txt").write_text("ignore me", encoding="utf-8")
            (root / "broken.url").write_text("[InternetShortcut]\n", encoding="utf-8")

            tree = scan_url_folder(root)
            tree_dict = tree.to_dict()

            self.assertEqual(tree.type, "folder")
            self.assertEqual(tree.title, root.name)
            self.assertEqual(len(tree.children), 2)
            self.assertEqual(tree_dict["type"], "folder")
            self.assertEqual(tree_dict["children"][0]["title"], "Homepage")
            self.assertEqual(tree_dict["children"][1]["title"], "Tech")
            self.assertEqual(tree_dict["children"][1]["children"][0]["href"], "https://example.com/docs")

    def test_bookmark_node_rejects_unknown_type(self) -> None:
        with self.assertRaises(ValueError):
            BookmarkNode("unknown", "Broken")


if __name__ == "__main__":
    unittest.main()

