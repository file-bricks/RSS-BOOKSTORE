"""Tests for the RSS-BOOKSTORE native messaging host."""

from __future__ import annotations

import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from native_host.nm_host import NativeHostError, handle_request, serve


def _encode_message(message: dict[str, object]) -> bytes:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    return struct.pack("<I", len(payload)) + payload


def _decode_message(data: bytes) -> dict[str, object]:
    payload_length = struct.unpack("<I", data[:4])[0]
    payload = data[4:4 + payload_length]
    return json.loads(payload.decode("utf-8"))


class HandleRequestTests(unittest.TestCase):
    def test_export_items_creates_nested_url_files(self) -> None:
        with TemporaryDirectory() as temp_dir:
            response = handle_request(
                {
                    "cmd": "export_items",
                    "baseDir": temp_dir,
                    "items": [
                        {
                            "folderParts": ["RSS", "Tech News"],
                            "title": "Release Notes",
                            "url": "https://example.com/release",
                        }
                    ],
                    "requestId": 7,
                }
            )

            created_path = Path(response["created"][0])
            self.assertTrue(created_path.exists())
            self.assertEqual(response["count"], 1)
            self.assertEqual(response["requestId"], 7)
            self.assertIn("Tech News", str(created_path))

    def test_export_items_rejects_unsafe_url_targets(self) -> None:
        with TemporaryDirectory() as temp_dir:
            with self.assertRaises(NativeHostError) as cm:
                handle_request(
                    {
                        "cmd": "export_items",
                        "baseDir": temp_dir,
                        "items": [
                            {
                                "folderParts": ["RSS", "Tech News"],
                                "title": "Injected",
                                "url": "https://example.com\r\nIconFile=C:\\evil.ico",
                            }
                        ],
                    }
                )

            self.assertEqual(cm.exception.code, "invalid_request")
            self.assertFalse(list(Path(temp_dir).rglob("*.url")))

    def test_export_items_rolls_back_partial_writes_on_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)
            call_count = 0

            def flaky_write_url_file(folder_path, title, href):
                nonlocal call_count
                call_count += 1
                target_dir = Path(folder_path)
                target_dir.mkdir(parents=True, exist_ok=True)
                path = target_dir / f"{title}.url"
                if call_count == 2:
                    raise OSError("disk full")
                path.write_text(f"[InternetShortcut]\nURL={href}\n", encoding="utf-8")
                return path

            with patch("native_host.nm_host.write_url_file", side_effect=flaky_write_url_file):
                with self.assertRaises(NativeHostError) as cm:
                    handle_request(
                        {
                            "cmd": "export_items",
                            "baseDir": temp_dir,
                            "items": [
                                {
                                    "folderParts": ["RSS", "Tech News"],
                                    "title": "First",
                                    "url": "https://example.com/first",
                                },
                                {
                                    "folderParts": ["RSS", "Tech News"],
                                    "title": "Second",
                                    "url": "https://example.com/second",
                                },
                            ],
                        }
                    )

            self.assertEqual(cm.exception.code, "export_failed")
            self.assertIn("Export fehlgeschlagen", cm.exception.message)
            self.assertFalse((base_dir / "RSS" / "Tech News" / "First.url").exists())
            self.assertFalse((base_dir / "RSS" / "Tech News").exists())

    def test_delete_paths_removes_url_and_prunes_empty_directories(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)
            nested_dir = base_dir / "RSS" / "Feed"
            nested_dir.mkdir(parents=True)
            shortcut = nested_dir / "Entry.url"
            shortcut.write_text("[InternetShortcut]\nURL=https://example.com\n", encoding="utf-8")

            response = handle_request(
                {
                    "cmd": "delete_paths",
                    "baseDir": temp_dir,
                    "paths": [str(shortcut)],
                }
            )

            self.assertFalse(shortcut.exists())
            self.assertFalse(nested_dir.exists())
            self.assertEqual(response["count"], 1)
            self.assertEqual(response["missing"], [])

    def test_delete_paths_requires_base_dir(self) -> None:
        with TemporaryDirectory() as temp_dir:
            shortcut = Path(temp_dir) / "Entry.url"
            shortcut.write_text("[InternetShortcut]\nURL=https://example.com\n", encoding="utf-8")

            with self.assertRaisesRegex(Exception, "baseDir"):
                handle_request(
                    {
                        "cmd": "delete_paths",
                        "paths": [str(shortcut)],
                    }
                )

            self.assertTrue(shortcut.exists())

    def test_delete_paths_skips_paths_outside_base_dir(self) -> None:
        with TemporaryDirectory() as base_temp_dir, TemporaryDirectory() as outside_temp_dir:
            outside_shortcut = Path(outside_temp_dir) / "Entry.url"
            outside_shortcut.write_text("[InternetShortcut]\nURL=https://example.com\n", encoding="utf-8")

            response = handle_request(
                {
                    "cmd": "delete_paths",
                    "baseDir": base_temp_dir,
                    "paths": [str(outside_shortcut)],
                }
            )

            self.assertTrue(outside_shortcut.exists())
            self.assertEqual(response["count"], 0)
            self.assertEqual(response["deleted"], [])
            self.assertEqual(response["skipped"], [str(outside_shortcut.resolve())])

    def test_delete_paths_skips_export_root_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)

            response = handle_request(
                {
                    "cmd": "delete_paths",
                    "baseDir": temp_dir,
                    "paths": [temp_dir],
                }
            )

            self.assertTrue(base_dir.exists())
            self.assertEqual(response["count"], 0)
            self.assertEqual(response["deleted"], [])
            self.assertEqual(response["skipped"], [str(base_dir.resolve())])

    def test_scan_folder_returns_serialized_tree(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)
            folder = base_dir / "Feed"
            folder.mkdir()
            shortcut = folder / "Entry.url"
            shortcut.write_text("[InternetShortcut]\nURL=https://example.com\n", encoding="utf-8")

            response = handle_request(
                {
                    "cmd": "scan_folder",
                    "baseDir": temp_dir,
                }
            )

            self.assertTrue(response["ok"])
            self.assertEqual(response["count"], 1)
            self.assertEqual(response["tree"]["children"][0]["title"], "Feed")

    def test_get_default_export_root_uses_onedrive_env_and_creates_folder(self) -> None:
        with TemporaryDirectory() as temp_dir:
            with patch.dict(os.environ, {"OneDriveConsumer": temp_dir}, clear=False):
                response = handle_request(
                    {
                        "cmd": "get_default_export_root",
                        "folderName": "My: RSS",
                        "create": True,
                        "requestId": 12,
                    }
                )

            expected = Path(temp_dir) / "My_ RSS"
            self.assertTrue(response["ok"])
            self.assertEqual(response["requestId"], 12)
            self.assertEqual(Path(response["oneDriveRoot"]), Path(temp_dir).resolve())
            self.assertEqual(Path(response["exportRoot"]), expected.resolve())
            self.assertTrue(expected.exists())
            self.assertTrue(response["exists"])

    def test_poll_folder_changes_reports_added_modified_and_removed_shortcuts(self) -> None:
        with TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)

            initial = handle_request(
                {
                    "cmd": "poll_folder_changes",
                    "baseDir": temp_dir,
                }
            )

            self.assertFalse(initial["changed"])
            self.assertEqual(initial["changes"]["added"], [])

            folder = base_dir / "Feed"
            folder.mkdir()
            shortcut = folder / "Entry.url"
            shortcut.write_text(
                "[InternetShortcut]\nURL=https://example.com/a\n",
                encoding="utf-8",
            )

            added = handle_request(
                {
                    "cmd": "poll_folder_changes",
                    "baseDir": temp_dir,
                    "knownState": initial["state"],
                }
            )

            self.assertTrue(added["changed"])
            self.assertEqual(added["event"], "folder_changed")
            self.assertEqual(added["changes"]["added"][0]["relativePath"], "Feed/Entry.url")
            self.assertEqual(added["changes"]["added"][0]["href"], "https://example.com/a")

            shortcut.write_text(
                "[InternetShortcut]\nURL=https://example.com/b\n",
                encoding="utf-8",
            )
            modified = handle_request(
                {
                    "cmd": "poll_folder_changes",
                    "baseDir": temp_dir,
                    "knownState": added["state"],
                }
            )

            self.assertTrue(modified["changed"])
            self.assertEqual(modified["changes"]["modified"][0]["href"], "https://example.com/b")

            shortcut.unlink()
            removed = handle_request(
                {
                    "cmd": "poll_folder_changes",
                    "baseDir": temp_dir,
                    "knownState": modified["state"],
                }
            )

            self.assertTrue(removed["changed"])
            self.assertEqual(removed["changes"]["removed"][0]["relativePath"], "Feed/Entry.url")

    def test_unknown_command_raises_error(self) -> None:
        with self.assertRaisesRegex(Exception, "Unbekanntes Kommando"):
            handle_request({"cmd": "does_not_exist"})


class ServeTests(unittest.TestCase):
    def test_serve_roundtrip_writes_native_frame(self) -> None:
        stdin = io.BytesIO(_encode_message({"cmd": "ping", "requestId": 5}))
        stdout = io.BytesIO()

        exit_code = serve(stdin, stdout)
        response = _decode_message(stdout.getvalue())

        self.assertEqual(exit_code, 0)
        self.assertTrue(response["ok"])
        self.assertEqual(response["host"], "com.file_bricks.rss_bookstore")
        self.assertEqual(response["requestId"], 5)

    def test_serve_returns_error_payload_for_invalid_request(self) -> None:
        stdin = io.BytesIO(_encode_message({"cmd": ""}))
        stdout = io.BytesIO()

        exit_code = serve(stdin, stdout)
        response = _decode_message(stdout.getvalue())

        self.assertEqual(exit_code, 0)
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"], "invalid_request")

    def test_serve_starts_watch_folder_with_initial_state(self) -> None:
        with TemporaryDirectory() as temp_dir:
            stdin = io.BytesIO(
                _encode_message(
                    {
                        "cmd": "watch_folder",
                        "baseDir": temp_dir,
                        "requestId": 9,
                        "intervalMs": 1,
                        "maxPolls": 0,
                    }
                )
            )
            stdout = io.BytesIO()

            exit_code = serve(stdin, stdout)
            response = _decode_message(stdout.getvalue())

            self.assertEqual(exit_code, 0)
            self.assertTrue(response["ok"])
            self.assertTrue(response["watching"])
            self.assertEqual(response["requestId"], 9)
            self.assertEqual(response["state"], {})

    def test_script_entrypoint_imports_when_started_directly(self) -> None:
        host_script = Path(__file__).resolve().parents[1] / "native_host" / "nm_host.py"
        with TemporaryDirectory() as temp_dir:
            result = subprocess.run(
                [sys.executable, str(host_script)],
                input=b"",
                capture_output=True,
                cwd=temp_dir,
                timeout=5,
            )

        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))


if __name__ == "__main__":
    unittest.main()
