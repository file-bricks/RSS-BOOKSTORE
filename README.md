# RSS-BOOKSTORE

[![RSS-BOOKSTORE tests](https://github.com/file-bricks/RSS-BOOKSTORE/actions/workflows/tests.yml/badge.svg)](https://github.com/file-bricks/RSS-BOOKSTORE/actions/workflows/tests.yml)

> **Alpha — nicht produktiv getestet / Alpha — not production-tested**
> This is an alpha release. Core features are implemented and covered by automated
> tests, but the extension has not been validated in sustained everyday use.
> Use at your own risk. For a stable, store-distributed alternative see
> [RSS-BOOK](https://github.com/file-bricks/RSS-BOOK).

RSS-BOOKSTORE is the power-user edition of RSS-BOOK: a Manifest V3 browser
extension that saves RSS/Atom entries as bookmarks and can also mirror them to a
Windows folder with `.url` files through a Native Messaging host.

RSS-BOOKSTORE ist die Power-User-Variante von RSS-BOOK: eine Manifest-V3-
Browser-Erweiterung, die RSS-/Atom-Einträge als Lesezeichen speichert und sie
über einen Native-Messaging-Host bidirektional mit einem Windows-Ordner
synchronisieren kann.

## Start Here

| If you want to... | Start with |
|---|---|
| Install the extension manually | [Install Extension](#install-extension) |
| Register the Windows Native Messaging host | [Install Native Messaging Host](#install-native-messaging-host) |
| Compare this with the store-friendly sibling | [Related Project / Geschwisterprojekt](#related-project--geschwisterprojekt) |
| Audit the local sync boundary | [Scope](#scope) and [Troubleshooting](#troubleshooting) |
| Let crawlers or LLM agents classify the repo | [`llms.txt`](llms.txt) |

## Scope

RSS-BOOKSTORE is intended for GitHub/sideloading distribution, not for browser
extension stores. The Native Messaging host requires a local registry entry, so
the simpler RSS-BOOK extension remains the store-friendly version.

## Features

- RSS 2.0 and Atom feed updates
- Bookmark output for Chromium browsers
- Folder output as Windows `.url` files
- Bidirectional sync between browser bookmarks and the export folder
- Automatic OneDrive default export path: `OneDrive\RSS-BOOKSTORE`
- Per-feed optional host permissions instead of blanket `<all_urls>`
- Native Messaging host with install, dry-run, and uninstall support
- Dark-first popup and options UI with a terminal-refined visual style and a
  full light-mode fallback

## Requirements

- Windows 10/11
- Python available as `python` on `PATH`
- Chrome, Edge, Brave, or another Chromium browser with unpacked extensions
- PowerShell for Native Messaging host registration

## Install Extension

1. Download or clone this repository.
2. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
3. Enable developer mode.
4. Choose **Load unpacked** and select the `RSS-BOOKSTORE` project folder.
5. Copy the generated extension ID from the browser extension details page.

The extension ID is required for the Native Messaging manifest. Chromium IDs are
32 lowercase letters from `a` to `p`.

## Install Native Messaging Host

Open PowerShell in the project folder and replace the example ID with the ID
shown by your browser:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

The installer writes `native_host\nm_manifest.generated.json` and registers the
host name `com.file_bricks.rss_bookstore` for Chrome, Edge, and Brave under
`HKCU` by default. The manifest points to `native_host\nm_host.bat`, which
starts `native_host\nm_host.py` with `PYTHONIOENCODING=utf-8`.

Preview the registry and manifest plan without writing anything:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -DryRun
```

Register only selected browsers:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -Browser Edge
```

Uninstall the Native Messaging registration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -Uninstall
```

Use `-Scope LocalMachine` only when a machine-wide registration is explicitly
needed and PowerShell is running with administrator rights.

## Usage

Open the extension options page to add feeds and select a sync mode:

| Mode | Bookmarks | Folder | Direction |
|---|---:|---:|---|
| `BOOKMARKS` | yes | no | feed to bookmarks |
| `FOLDER` | no | yes | feed to `.url` files |
| `SYNC` | yes | yes | bookmarks and folder stay mirrored |

In `FOLDER` or `SYNC` mode, the **OneDrive-Standard** button asks the Native
Messaging host for the default export root and stores it in extension settings.
New feeds request only their specific host permission when they are added.

## Search Context

Useful discovery phrases for this repository:

- `RSS-BOOKSTORE file-bricks`
- `RSS Atom browser extension bookmarks Native Messaging`
- `Windows RSS folder sync .url files browser extension`
- `local-first RSS bookmark extension Chromium`
- `RSS-BOOK vs RSS-BOOKSTORE`

RSS-BOOKSTORE is not a hosted feed reader, not a cloud RSS service, not a
general bookmark manager, and not the Chrome Web Store build of RSS-BOOK. It is
a sideloaded Chromium extension for power users who want RSS/Atom entries as
browser bookmarks and as local Windows `.url` files.

## Troubleshooting

- If feed updates fail with a permission error, open options and grant host
  access for that feed.
- If folder export does nothing, run the installer with `-DryRun` and verify the
  extension ID and browser registry target.
- If the browser was already open while installing the host, restart the browser
  once so it reloads Native Messaging registrations.
- If Python is not found, install Python or adjust `native_host\nm_host.bat` to
  call the correct interpreter.

## Development

There is no build step. Run the JavaScript extension tests and Python Native
Messaging host tests separately:

```powershell
npm.cmd test
python -B -m unittest discover -s tests -p "test_*.py" -v
```

The same checks run on GitHub Actions in the `RSS-BOOKSTORE tests` workflow.
The `-B` flag keeps Python from writing `__pycache__` folders into the unpacked
extension directory.

`npm test` may be blocked by PowerShell execution policy on Windows; `npm.cmd
test` avoids that wrapper issue.

Regenerate the extension icon PNGs from the source drawing script:

```powershell
python .\scripts\generate_icons.py
```

This developer helper uses Pillow; it is not required for installing or running
the extension.

## GitHub Release ZIP

RSS-BOOKSTORE is distributed as a GitHub/sideloading ZIP. Build the package from
the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package_github_release.ps1
```

Preview the release contents without creating files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package_github_release.ps1 -DryRun
```

The package script writes `releases\v1.0.0\RSS-BOOKSTORE-1.0.0-github.zip` and
`releases\v1.0.0\SHA256SUMS.txt`. The ZIP contains the unpacked extension, the
release packaging script, the Native Messaging host,
`native_host\install_nm_host.ps1`, and a short `INSTALL_NATIVE_HOST.txt` setup
note. Tests, caches, generated host manifests, and prior release output are
excluded.

## Project Structure

```text
RSS-BOOKSTORE/
|-- manifest.json
|-- scripts/
|   |-- generate_icons.py
|   `-- package_github_release.ps1
|-- sw.js
|-- lib/
|   |-- bookmarks.js
|   |-- native.js
|   |-- permissions.js
|   `-- sync.js
|-- ui/
|   |-- options.html
|   `-- options.js
|-- native_host/
|   |-- favextract_core.py
|   |-- install_nm_host.ps1
|   |-- nm_host.bat
|   |-- nm_host.py
|   `-- nm_manifest.json
|-- RELEASES.md
`-- tests/
```

## Status

Native Messaging export and bidirectional sync are implemented and covered by
automated tests. The extension ships an original generated icon set and a
dark-first popup/options interface. It remains an alpha sideloading build until
there is sustained everyday-use validation.

## Related Project / Geschwisterprojekt

| Projekt | Distribution | Sync | Native Messaging |
|---|---|---|---|
| [RSS-BOOK](https://github.com/file-bricks/RSS-BOOK) | Chrome Web Store + GitHub | Einweg (Feeds → Lesezeichen) | Nein |
| **RSS-BOOKSTORE** (dieses Projekt) | GitHub / Sideloading | Bidirektional (Lesezeichen ↔ Ordner) | Ja |

RSS-BOOK is the store-friendly sibling: no Native Messaging, one-way feed-to-bookmark
sync, installable from the Chrome Web Store for any Chromium browser.
RSS-BOOKSTORE adds a local Windows folder mirror and bidirectional sync via a
Python Native Messaging host — at the cost of a manual sideload installation.
