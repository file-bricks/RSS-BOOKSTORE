# Changelog / Änderungsprotokoll

Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Dokumentation / Documentation

- README um Start-Here-Tabelle, Suchkontext und klare Abgrenzung zu gehosteten
  RSS-Diensten, allgemeinen Bookmark-Managern und der Store-Version RSS-BOOK
  ergänzt.
- `llms.txt` als maschinenlesbarer Projektkontext für Crawler, LLM-Agenten und
  Repo-Kataloge ergänzt.
- `package.json` um Beschreibung und Keywords für die lokale Extension- und
  Native-Messaging-Positionierung erweitert.

### Sicherheit / Security

- Feed- und `.url`-Ziel-URLs werden vor Bookmark- und Native-Host-Ausgabe auf
  einzeilige `http`-/`https`-URLs begrenzt; unsichere Schemata wie
  `javascript:`/`file:` und CRLF-Injection-Versuche werden verworfen.

### Geändert / Changed

- Native-Messaging-Hilfsdateien liegen jetzt unter `native_host`, damit der
  Projektordner ohne Chromium-Fehler als entpackte Erweiterung geladen werden
  kann.
- `ui/popup.html` + `ui/options.html`: **UI-Redesign v2** — Terminal-Refined-Ästhetik:
  Dark-first (GitHub-Dark-Palette `#0d1117`), Terminal-Grün (`#00e676`) als Akzent statt
  generischem Rot, `ui-monospace` für Brand/URLs/Status. Popup: Header-Bereich,
  Feed-Count als grünes Badge, monospace Status-Bar. Options: `# Section`-Header,
  dunklere Input-Felder, Code-Font für Feed-URLs, Info/Warn-Boxen mit Farbkodierung.
  Light-Mode bleibt als vollständige Alternative erhalten.
- `.github/workflows/tests.yml` ergänzt: Windows-CI für JavaScript-Extension-Tests,
  Python-Native-Messaging-Tests und cachefreien Python-Syntaxcheck.
- Tests prüfen jetzt, dass der entpackte Extension-Pfad keine Chromium-reservierten
  führenden Unterstrich-Namen enthält.
- `PORTIERUNGSPLAN.md` usecase-basiert auf die reale Alpha-Architektur geschärft.
- `AUFGABEN.txt` und `STATE.md` synchronisiert.

## [1.0.0-alpha] - 2026-06-01

> **Alpha-Release:** Noch nicht im Alltagsbetrieb getestet. Für Power-User und Entwickler.

### Hinzugefügt / Added

- Feed-Import (RSS 2.0 und Atom) mit Bookmark-Ausgabe
- Ordnerexport als Windows `.url`-Dateien via File System Access API
- Bidirektionaler Sync zwischen Browser-Lesezeichen und lokalem Ordner
- Native Messaging Host (`native_host/nm_host.py`) mit `ping`, `export_items`, `delete_paths`, `scan_folder`
- Polling-basierter Datei-Watcher mit `folder_changed`-Events
- PowerShell-Installer (`native_host/install_nm_host.ps1`) für Chrome, Edge und Brave
- Automatischer OneDrive-Standardpfad (`OneDrive\RSS-BOOKSTORE`) ohne manuellen Ordnerpicker
- Dynamische Host-Permissions pro Feed statt `<all_urls>`
- OPML-Import/Export
- Feed-Autodiscovery
- Dark Mode
- Eigenes Icon-Set (16/48/128 px, generiert via `scripts/generate_icons.py`)
- GitHub-Release-ZIP-Packer (`scripts/package_github_release.ps1`)
- Automatisierte Tests: JavaScript (`npm test`) und Python (`python -m unittest`)
