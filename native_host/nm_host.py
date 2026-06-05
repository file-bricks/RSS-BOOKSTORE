"""Native Messaging host for RSS-BOOKSTORE."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
import json
import os
from pathlib import Path
import struct
import sys
import time
from typing import BinaryIO

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from native_host.favextract_core import read_url_file, scan_url_folder, sanitize_filename, write_url_file


HOST_NAME = "com.file_bricks.rss_bookstore"
MAX_MESSAGE_BYTES = 1_000_000
DEFAULT_EXPORT_FOLDER_NAME = "RSS-BOOKSTORE"


class NativeHostError(Exception):
    """Raised when a request cannot be processed safely."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _read_message(stream: BinaryIO) -> dict[str, object] | None:
    """Read a single framed native message from the binary stream."""
    length_prefix = stream.read(4)
    if not length_prefix:
        return None
    if len(length_prefix) != 4:
        raise NativeHostError("invalid_frame", "Unvollständiger Message-Header.")

    message_length = struct.unpack("<I", length_prefix)[0]
    if message_length <= 0 or message_length > MAX_MESSAGE_BYTES:
        raise NativeHostError("invalid_frame", f"Ungültige Message-Größe: {message_length}")

    payload = stream.read(message_length)
    if len(payload) != message_length:
        raise NativeHostError("invalid_frame", "Unvollständiger Message-Body.")

    try:
        message = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise NativeHostError("invalid_json", f"Ungültiges JSON: {exc.msg}") from exc

    if not isinstance(message, dict):
        raise NativeHostError("invalid_request", "Top-Level JSON muss ein Objekt sein.")

    return message


def _write_message(stream: BinaryIO, message: Mapping[str, object]) -> None:
    """Write a single framed native message to the binary stream."""
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    if len(payload) > MAX_MESSAGE_BYTES:
        raise NativeHostError("response_too_large", "Antwort überschreitet die Größenbegrenzung.")
    stream.write(struct.pack("<I", len(payload)))
    stream.write(payload)
    stream.flush()


def _expect_string(payload: Mapping[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise NativeHostError("invalid_request", f"Feld '{key}' muss ein nicht-leerer String sein.")
    return value


def _expect_mapping(value: object, field_name: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise NativeHostError("invalid_request", f"Eintrag '{field_name}' muss ein Objekt sein.")
    return value


def _expect_string_list(value: object, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise NativeHostError("invalid_request", f"Feld '{field_name}' muss eine Liste sein.")
    result: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str):
            raise NativeHostError(
                "invalid_request",
                f"Eintrag {index} in '{field_name}' muss ein String sein.",
            )
        cleaned = item.strip()
        if cleaned:
            result.append(cleaned)
    return result


def _expect_int(
    value: object,
    field_name: str,
    *,
    default: int | None = None,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    if value is None:
        if default is None:
            raise NativeHostError("invalid_request", f"Feld '{field_name}' muss eine Zahl sein.")
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise NativeHostError("invalid_request", f"Feld '{field_name}' muss eine ganze Zahl sein.")
    if minimum is not None and value < minimum:
        raise NativeHostError("invalid_request", f"Feld '{field_name}' muss mindestens {minimum} sein.")
    if maximum is not None and value > maximum:
        raise NativeHostError("invalid_request", f"Feld '{field_name}' darf hoechstens {maximum} sein.")
    return value


def _expect_bool(value: object, field_name: str, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raise NativeHostError("invalid_request", f"Feld '{field_name}' muss ein Boolean sein.")


def _normalize_base_dir(base_dir: str) -> Path:
    path = Path(base_dir).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _detect_onedrive_root() -> Path:
    candidates: list[Path] = []
    for env_name in ("OneDriveConsumer", "OneDriveCommercial", "OneDrive"):
        raw_path = os.environ.get(env_name)
        if raw_path:
            candidates.append(Path(raw_path))

    home = Path.home()
    candidates.extend(path for path in sorted(home.glob("OneDrive*")) if path.is_dir())
    candidates.append(home / "OneDrive")

    seen: set[str] = set()
    fallback: Path | None = None
    for candidate in candidates:
        try:
            resolved = candidate.expanduser().resolve()
        except OSError:
            continue
        key = str(resolved).casefold()
        if key in seen:
            continue
        seen.add(key)
        if fallback is None:
            fallback = resolved
        if resolved.exists() and resolved.is_dir():
            return resolved

    return fallback or (home / "OneDrive")


def _folder_path_from_parts(base_dir: Path, folder_parts: Iterable[str]) -> Path:
    current = base_dir
    for raw_part in folder_parts:
        safe_part = sanitize_filename(raw_part, replacement="_", max_len=120)
        current = current / safe_part
    return current


def _count_links(tree: Mapping[str, object]) -> int:
    if tree.get("type") == "link":
        return 1
    children = tree.get("children")
    if not isinstance(children, list):
        return 0
    return sum(_count_links(child) for child in children if isinstance(child, Mapping))


def _snapshot_url_folder(base_dir: Path) -> dict[str, dict[str, object]]:
    state: dict[str, dict[str, object]] = {}

    for shortcut in sorted(base_dir.rglob("*.url"), key=lambda item: item.as_posix().casefold()):
        if not shortcut.is_file():
            continue

        href = read_url_file(shortcut)
        if not href:
            continue

        try:
            stat = shortcut.stat()
            relative_path = shortcut.relative_to(base_dir).as_posix()
        except OSError:
            continue

        state[relative_path] = {
            "relativePath": relative_path,
            "path": str(shortcut),
            "title": shortcut.stem,
            "href": href,
            "size": stat.st_size,
            "mtimeNs": stat.st_mtime_ns,
        }

    return state


def _normalize_known_state(value: object, field_name: str = "knownState") -> dict[str, dict[str, object]]:
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise NativeHostError("invalid_request", f"Feld '{field_name}' muss ein Objekt sein.")

    normalized: dict[str, dict[str, object]] = {}
    for raw_key, raw_entry in value.items():
        if not isinstance(raw_key, str) or not raw_key.strip():
            raise NativeHostError("invalid_request", f"Schluessel in '{field_name}' muss ein String sein.")
        entry = _expect_mapping(raw_entry, f"{field_name}.{raw_key}")
        relative_path = entry.get("relativePath")
        if not isinstance(relative_path, str) or not relative_path.strip():
            relative_path = raw_key

        normalized[relative_path] = {
            "relativePath": relative_path,
            "path": str(entry.get("path", "")),
            "title": str(entry.get("title", Path(relative_path).stem)),
            "href": str(entry.get("href", "")),
            "size": entry.get("size"),
            "mtimeNs": entry.get("mtimeNs"),
        }

    return normalized


def _entry_signature(entry: Mapping[str, object]) -> tuple[object, object, object]:
    return (entry.get("href"), entry.get("size"), entry.get("mtimeNs"))


def _diff_url_states(
    previous: Mapping[str, Mapping[str, object]],
    current: Mapping[str, Mapping[str, object]],
) -> dict[str, list[Mapping[str, object]]]:
    previous_keys = set(previous)
    current_keys = set(current)
    shared_keys = previous_keys & current_keys

    return {
        "added": [current[key] for key in sorted(current_keys - previous_keys)],
        "removed": [previous[key] for key in sorted(previous_keys - current_keys)],
        "modified": [
            current[key]
            for key in sorted(shared_keys)
            if _entry_signature(previous[key]) != _entry_signature(current[key])
        ],
    }


def _change_count(changes: Mapping[str, list[Mapping[str, object]]]) -> int:
    return sum(len(items) for items in changes.values())


def _folder_change_response(
    base_dir: Path,
    current_state: dict[str, dict[str, object]],
    previous_state: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    changes = _diff_url_states(previous_state, current_state)
    count = _change_count(changes)
    response: dict[str, object] = {
        "ok": True,
        "baseDir": str(base_dir),
        "state": current_state,
        "changes": changes,
        "changed": count > 0,
        "count": count,
    }
    if count > 0:
        response["event"] = "folder_changed"
    return response


def _handle_export_items(message: Mapping[str, object]) -> dict[str, object]:
    base_dir = _normalize_base_dir(_expect_string(message, "baseDir"))
    raw_items = message.get("items")
    if not isinstance(raw_items, list):
        raise NativeHostError("invalid_request", "Feld 'items' muss eine Liste sein.")

    jobs: list[tuple[int, Path, str, str]] = []
    for index, raw_item in enumerate(raw_items):
        item = _expect_mapping(raw_item, f"items[{index}]")
        folder_parts = _expect_string_list(item.get("folderParts"), f"items[{index}].folderParts")
        title = _expect_string(item, "title")
        url = _expect_string(item, "url")
        target_dir = _folder_path_from_parts(base_dir, folder_parts)
        jobs.append((index, target_dir, title, url))

    created: list[str] = []
    created_paths: list[Path] = []
    try:
        for index, target_dir, title, url in jobs:
            created_path = write_url_file(target_dir, title, url)
            if created_path is None:
                raise NativeHostError("invalid_request", f"Eintrag {index} enthält keine URL.")
            created_paths.append(Path(created_path))
            created.append(str(created_path))
    except NativeHostError:
        _rollback_created_paths(created_paths, base_dir)
        raise
    except Exception as exc:
        _rollback_created_paths(created_paths, base_dir)
        raise NativeHostError("export_failed", f"Export fehlgeschlagen: {exc}") from exc

    return {
        "ok": True,
        "created": created,
        "count": len(created),
    }


def _rollback_created_paths(created_paths: Iterable[Path], stop_dir: Path | None) -> None:
    for created_path in reversed([Path(path) for path in created_paths]):
        try:
            if created_path.exists():
                created_path.unlink()
        except OSError:
            pass
        try:
            _prune_empty_parents(created_path, stop_dir)
        except OSError:
            pass


def _prune_empty_parents(path: Path, stop_dir: Path | None) -> None:
    current = path.parent
    while stop_dir is not None and current != stop_dir and current.exists():
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _handle_delete_paths(message: Mapping[str, object]) -> dict[str, object]:
    raw_paths = message.get("paths")
    if not isinstance(raw_paths, list):
        raise NativeHostError("invalid_request", "Feld 'paths' muss eine Liste sein.")

    base_dir = _normalize_base_dir(_expect_string(message, "baseDir"))

    deleted: list[str] = []
    missing: list[str] = []
    skipped: list[str] = []

    for index, raw_path in enumerate(raw_paths):
        if not isinstance(raw_path, str) or not raw_path.strip():
            raise NativeHostError("invalid_request", f"Eintrag {index} in 'paths' ist ungültig.")

        candidate = Path(raw_path).expanduser().resolve()
        if candidate == base_dir:
            skipped.append(str(candidate))
            continue
        if base_dir not in candidate.parents:
            skipped.append(str(candidate))
            continue
        if not candidate.exists():
            missing.append(str(candidate))
            continue

        if candidate.is_file() and candidate.suffix.lower() == ".url":
            candidate.unlink()
            deleted.append(str(candidate))
            _prune_empty_parents(candidate, base_dir)
        elif candidate.is_dir():
            try:
                candidate.rmdir()
            except OSError:
                skipped.append(str(candidate))
            else:
                deleted.append(str(candidate))
        else:
            skipped.append(str(candidate))

    return {
        "ok": True,
        "deleted": deleted,
        "missing": missing,
        "skipped": skipped,
        "count": len(deleted),
    }


def _handle_scan_folder(message: Mapping[str, object]) -> dict[str, object]:
    base_dir = _normalize_base_dir(_expect_string(message, "baseDir"))
    tree = scan_url_folder(base_dir).to_dict()
    return {
        "ok": True,
        "tree": tree,
        "count": _count_links(tree),
    }


def _handle_get_default_export_root(message: Mapping[str, object]) -> dict[str, object]:
    raw_folder_name = message.get("folderName")
    folder_name = (
        raw_folder_name.strip()
        if isinstance(raw_folder_name, str) and raw_folder_name.strip()
        else DEFAULT_EXPORT_FOLDER_NAME
    )
    folder_name = sanitize_filename(folder_name, replacement="_", max_len=80)
    create = _expect_bool(message.get("create"), "create", default=True)

    onedrive_root = _detect_onedrive_root()
    export_root = onedrive_root / folder_name
    if create:
        export_root.mkdir(parents=True, exist_ok=True)

    return {
        "ok": True,
        "oneDriveRoot": str(onedrive_root),
        "exportRoot": str(export_root),
        "folderName": folder_name,
        "exists": export_root.exists(),
    }


def _handle_poll_folder_changes(message: Mapping[str, object]) -> dict[str, object]:
    base_dir = _normalize_base_dir(_expect_string(message, "baseDir"))
    current_state = _snapshot_url_folder(base_dir)
    previous_state = (
        _normalize_known_state(message.get("knownState"))
        if "knownState" in message
        else current_state
    )
    return _folder_change_response(base_dir, current_state, previous_state)


def _stream_folder_watch(message: Mapping[str, object], stdout: BinaryIO) -> None:
    base_dir = _normalize_base_dir(_expect_string(message, "baseDir"))
    interval_ms = _expect_int(
        message.get("intervalMs"),
        "intervalMs",
        default=1000,
        minimum=1,
        maximum=60_000,
    )
    max_polls = None
    if "maxPolls" in message:
        max_polls = _expect_int(
            message.get("maxPolls"),
            "maxPolls",
            minimum=0,
            maximum=1_000_000,
        )

    previous_state = _snapshot_url_folder(base_dir)
    initial_response: dict[str, object] = {
        "ok": True,
        "watching": True,
        "baseDir": str(base_dir),
        "state": previous_state,
    }
    request_id = message.get("requestId")
    if request_id is not None:
        initial_response["requestId"] = request_id
    _write_message(stdout, initial_response)

    polls = 0
    while max_polls is None or polls < max_polls:
        time.sleep(interval_ms / 1000)
        current_state = _snapshot_url_folder(base_dir)
        response = _folder_change_response(base_dir, current_state, previous_state)
        polls += 1
        if response["changed"]:
            del response["changed"]
            _write_message(stdout, response)
            previous_state = current_state


def _handle_ping(_: Mapping[str, object]) -> dict[str, object]:
    return {"ok": True, "host": HOST_NAME}


def handle_request(message: Mapping[str, object]) -> dict[str, object]:
    """Process a single request object and return a JSON-friendly response."""
    request_id = message.get("requestId")
    command = message.get("cmd")

    if not isinstance(command, str) or not command.strip():
        raise NativeHostError("invalid_request", "Feld 'cmd' muss ein nicht-leerer String sein.")

    handlers = {
        "delete_paths": _handle_delete_paths,
        "export_items": _handle_export_items,
        "get_default_export_root": _handle_get_default_export_root,
        "ping": _handle_ping,
        "poll_folder_changes": _handle_poll_folder_changes,
        "scan_folder": _handle_scan_folder,
    }

    handler = handlers.get(command)
    if handler is None:
        raise NativeHostError("unknown_command", f"Unbekanntes Kommando: {command}")

    response = handler(message)
    if request_id is not None:
        response["requestId"] = request_id
    return response


def _error_response(error: NativeHostError, request_id: object = None) -> dict[str, object]:
    response: dict[str, object] = {
        "ok": False,
        "error": error.code,
        "message": error.message,
    }
    if request_id is not None:
        response["requestId"] = request_id
    return response


def serve(stdin: BinaryIO, stdout: BinaryIO) -> int:
    """Serve native messaging requests until EOF."""
    while True:
        try:
            message = _read_message(stdin)
        except NativeHostError as error:
            _write_message(stdout, _error_response(error))
            return 1

        if message is None:
            return 0

        request_id = message.get("requestId")
        try:
            if message.get("cmd") == "watch_folder":
                _stream_folder_watch(message, stdout)
                continue
            response = handle_request(message)
        except NativeHostError as error:
            response = _error_response(error, request_id=request_id)

        _write_message(stdout, response)


def main() -> int:
    """Entrypoint for the Windows launcher and direct CLI execution."""
    return serve(sys.stdin.buffer, sys.stdout.buffer)


if __name__ == "__main__":
    raise SystemExit(main())
