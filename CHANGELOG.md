# Changelog / Änderungsprotokoll

Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Sicherheit / Security

- Feed- und `.url`-Ziel-URLs werden vor Bookmark- und Native-Host-Ausgabe auf
  einzeilige `http`-/`https`-URLs begrenzt; unsichere Schemata wie
  `javascript:`/`file:` und CRLF-Injection-Versuche werden verworfen.

### Geändert / Changed

- `ui/popup.html` + `ui/options.html`: **UI-Redesign v2** — Terminal-Refined-Ästhetik:
  Dark-first (GitHub-Dark-Palette `#0d1117`), Terminal-Grün (`#00e676`) als Akzent statt
  generischem Rot, `ui-monospace` für Brand/URLs/Status. Popup: Header-Bereich,
  Feed-Count als grünes Badge, monospace Status-Bar. Options: `# Section`-Header,
  dunklere Input-Felder, Code-Font für Feed-URLs, Info/Warn-Boxen mit Farbkodierung.
  Light-Mode bleibt als vollständige Alternative erhalten.
- `.github/workflows/tests.yml` ergänzt: Windows-CI für JavaScript-Extension-Tests,
  Python-Native-Messaging-Tests und `compileall`.
- `PORTIERUNGSPLAN.md` usecase-basiert auf die reale Alpha-Architektur geschärft.
- `AUFGABEN.txt` und `STATE.md` synchronisiert.

## [1.0.0-alpha] - 2026-06-01

> **Alpha-Release:** Noch nicht im Alltagsbetrieb getestet. Für Power-User und Entwickler.

### Hinzugefügt / Added

- Feed-Import (RSS 2.0 und Atom) mit Bookmark-Ausgabe
- Ordnerexport als Windows `.url`-Dateien via File System Access API
- Bidirektionaler Sync zwischen Browser-Lesezeichen und lokalem Ordner
- Native Messaging Host (`_native_host/nm_host.py`) mit `ping`, `export_items`, `delete_paths`, `scan_folder`
- Polling-basierter Datei-Watcher mit `folder_changed`-Events
- PowerShell-Installer (`_native_host/install_nm_host.ps1`) für Chrome, Edge und Brave
- Automatischer OneDrive-Standardpfad (`OneDrive\RSS-BOOKSTORE`) ohne manuellen Ordnerpicker
- Dynamische Host-Permissions pro Feed statt `<all_urls>`
- OPML-Import/Export
- Feed-Autodiscovery
- Dark Mode
- Eigenes Icon-Set (16/48/128 px, generiert via `scripts/generate_icons.py`)
- GitHub-Release-ZIP-Packer (`scripts/package_github_release.ps1`)
- Automatisierte Tests: JavaScript (`npm test`) und Python (`python -m unittest`)
