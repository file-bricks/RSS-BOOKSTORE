# Changelog / Änderungsprotokoll

Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Geändert / Changed

- `PORTIERUNGSPLAN.md` usecase-basiert auf die reale Alpha-Architektur geschärft: RSS-BOOKSTORE bleibt GitHub-/Sideloading-Extension mit Windows-Native-Messaging-Host; Browser-Store, Windows Store, Web/PWA, Android und iOS sind Nicht-Ziele.
- `AUFGABEN.txt` und `STATE.md` auf den Plattform-Review und die nächsten manuellen Smoke-Schritte synchronisiert.

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
