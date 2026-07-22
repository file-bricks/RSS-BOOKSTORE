# Changelog / Änderungsprotokoll

Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Dokumentation & Sichtbarkeit / Documentation & Visibility

- Erstellen von `README_de.md` als vollständige deutsche Startseite und Dokumentation für deutschsprachige Anwender.
- Hinzufügen einer zweisprachigen Umschaltnavigation (`[English](README.md) | [Deutsch](README_de.md)`) am Kopf von `README.md` und `README_de.md`.
- Integration eines Mermaid-Architektur- und Datenflussdiagramms in `README.md` und `README_de.md` zur Visualisierung der Zusammenspiel von Service Worker, Bookmarks API, Python Native Messaging Host und Windows-Ordner.
- Aktualisierung von `llms.txt` mit standardisiertem `Last-checked: 2026-07-22` Header, erweiterten Suchphrasen und LLM-Kontext für automatisierte Indexer.

### Fehlerbehebung / Fixed

- `tests/platform-gate.test.mjs` prüft das macOS-/Linux-Demand-Gate nur noch
  gegen die versionierte Gate-Dokumentation. Dadurch benötigt die CI keine
  absichtlich lokale, ignorierte Planungsdatei.
- OPML-Import dekodiert XML-Entities jetzt nur einmal und unterstützt numerische
  Entities, damit maskierte Entity-Texte nicht zu Markup werden.
- `ui/popup.js`: Der kompakte `+`-Button in der Feed-Autodiscovery bleibt
  bewusst symbolisch, liefert jetzt aber einen sprechenden Accessible Name und
  Tooltip-Kontext pro vorgeschlagenem Feed; der deaktivierte Abschlusszustand
  `✓` kündigt ebenfalls klar an, dass der Feed bereits hinzugefügt wurde.
- `ui/popup.html` + `ui/popup.js`: Die kompakte Feed-Liste bleibt sichtbar
  unverändert, exponiert aber jetzt Listensemantik und pro Feed-Zeile einen
  zusammenfassenden Accessible Name mit Feedname, Aktualitätsstatus und Fehlern.
- Release-ZIP `v1.0.0` enthielt nur 6 von 11 `lib/`-Modulen. Die fünf fehlenden
  Module (`discovery.js`, `export.js`, `i18n.js`, `opml.js`, `url_safety.js`) sind
  jetzt im neu gebauten ZIP enthalten.
- `scripts/package_github_release.ps1`: BUGSWEEP-Backup-Artefakte (`.bak`-Dateien)
  werden jetzt automatisch aus dem Release-ZIP ausgeschlossen.
- `sw.js` (ETag-Cache): `??` in `updateOneFeed` durch `||` ersetzt — bei HTTP-200-
  Antwort ohne `ETag`/`Last-Modified`-Header wird der gespeicherte Wert beibehalten
  statt geleert und die 304-Cache-Validierung damit deaktiviert.
- `sw.js` (leerer-Items-Pfad): Fehlende Titel-Aktualisierung ergänzt;
  `title: feed.title || parsed.title` gilt jetzt auch wenn der Server keine neuen
  Items liefert.
- Bug A (`ui/options.js`): OPML-Export-Anker nicht im DOM eingehängt;
  `revokeObjectURL` synchron aufgerufen → Download in Firefox/iOS Safari defekt.
  Fix: `body.appendChild/removeChild` + `setTimeout`-Defer.
- Bug B (`lib/sync.js`): `simpleHash` nutzte `*` statt `Math.imul`; Ganzzahl-
  Überlauf nach ~44 Zeichen kollabierte lange Titel auf denselben Hash-Key.
- Bug C (`lib/storage.js`): `upsertFeed`/`removeFeed` ohne Serialisierung;
  gleichzeitige Alarm- und Message-Handler konnten Writes überschreiben.
  Fix: Promise-Mutex `withFeedLock`.
- Bug D (`manifest.json`): `icons`-Feld im PWA-Webmanifest-Array-Format statt
  Browser-Extension-Objekt-Format. Fix: `{ "16": ..., "48": ..., "128": ... }`.
- Bug E/F (`manifest.json`): fehlende `scripting`- und `activeTab`-Permissions
  für `chrome.scripting.executeScript` ergänzt.

### Tests / Tests

- Manifest-/Icon-Vertrag erneut gegen den echten Projektstand geprüft: `npm.cmd test`
  91/91, vollständige Python-Native-Host-Suite 29/29 und `git diff --check`
  grün. Der frühere TASKWRITER-Hinweis auf zwei Manifest-/Icon-Fehler war stale;
  Produktcode brauchte keinen weiteren Eingriff.
- `tests/popup-accessibility.test.mjs`: Neuer Guard prüft die semantische
  Feed-Liste und den zusammengefassten Screenreader-Kontext der Popup-Feedzeilen.
- `tests/popup-accessibility.test.mjs`: Neue Regression stellt sicher, dass die
  kompakte Symbolaktion in der Popup-Feed-Autodiscovery einen stabilen
  Accessible Name und Tooltip-Kontext exponiert.
- `tests/release-package.test.mjs`: Neuer Test prüft, dass das gebaute ZIP alle
  11 `lib/*.js`-Module enthält und keine `.bak`-Dateien.
- `tests/etag-cache-sw.test.mjs`: Titel-Update im leeren-Items-Pfad abgedeckt;
  `tests/extension-paths.test.mjs` überspringt `__pycache__`-Verzeichnisse global.
- `tests/bugsweep-20260610.test.mjs`: 12 neue Tests für Bugs A–F; 107 Tests
  (79 JS + 28 Python) grün.

### Dokumentation / Documentation

- `AUFGABEN.txt`, `STATE.md`, `PORTIERUNGSPLAN.md` und `llms.txt` auf den
  verifizierten 2026-07-22-Stand synchronisiert; `TW-RBS-01` ist mit dem
  aktuellen 16/48/128-Icon-Vertrag bestätigt und `TW-RBS-03` abgeschlossen.
  Der manuelle Browser-/Native-Host-E2E-Smoke und die zentrale
  Lifecycle-/Prefix-Entscheidung bleiben ausdrücklich offen.
- README um Start-Here-Tabelle, Suchkontext und klare Abgrenzung zu gehosteten
  RSS-Diensten, allgemeinen Bookmark-Managern und der Store-Version RSS-BOOK
  ergänzt.
- `llms.txt` als maschinenlesbarer Projektkontext für Crawler, LLM-Agenten und
  Repo-Kataloge ergänzt.
- `package.json` um Beschreibung und Keywords für die lokale Extension- und
  Native-Messaging-Positionierung erweitert.
- `E2E_SMOKE.md`: manuelles End-to-End-Rauchtest-Runbook für Extension-Install,
  Feed-Polling, Bookmark-, Ordner- und SYNC-Modus ergänzt.
- `MACOS_LINUX_NATIVE_HOST_GATE.md`: macOS-/Linux-Native-Host bleibt ein
  Nachfrage-Gate; ohne belegten Nutzerbedarf werden keine Platzhalter-Installer
  oder Host-Ports gestartet.

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
