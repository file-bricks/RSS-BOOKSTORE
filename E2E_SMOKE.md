# RSS-BOOKSTORE — End-to-End Smoke-Test

Manuelles Runbook für den Erststart nach Installation.
Alle Schritte einmal durchlaufen, bevor eine neue Version als "funktionsfähig" gilt.

---

## Voraussetzungen

| Voraussetzung | Prüfung |
|---|---|
| Chromium-Browser (Chrome, Edge oder Brave) | installiert |
| PowerShell 5.1+ | `$PSVersionTable.PSVersion` |
| Python 3.9+ | `python --version` |
| ZIP entpackt | Ordner `RSS-BOOKSTORE-1.0.0-github` vorhanden |

---

## Phase 1: Extension laden

1. Browser öffnen → `chrome://extensions` (oder `edge://extensions`)
2. **Entwicklermodus** aktivieren (Schalter oben rechts)
3. **Entpackte Erweiterung laden** → Ordner `RSS-BOOKSTORE-1.0.0-github` auswählen
4. Extension erscheint in der Liste ohne Fehlermeldung
5. Extension-ID (32 Zeichen, nur `a–p`) aus der Detailseite kopieren

Erwartetes Ergebnis: Kein Fehler, kein `chrome-extension://` Redirect-Problem.

---

## Phase 2: Native Messaging Host installieren

```powershell
# Im entpackten Ordner RSS-BOOKSTORE-1.0.0-github ausführen:
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\native_host\install_nm_host.ps1 `
  -ExtensionId <deine-32-zeichen-id>
```

Dry-Run (ohne Registry-Schreibzugriff):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\native_host\install_nm_host.ps1 `
  -ExtensionId <deine-32-zeichen-id> -DryRun
```

Erwartetes Ergebnis: Meldung `Native Messaging Host registered.`, keine Fehler.
Registry-Schlüssel: `HKCU:\Software\Google\Chrome\NativeMessagingHosts\rss_bookstore_host`

---

## Phase 3: Extension-Verbindung prüfen

1. Extension-Popup öffnen (Icon in der Toolbar)
2. **Status-Bar** zeigt: `Host connected` (grün)  
   — NICHT: `Host unavailable` (dann Phase 2 wiederholen)

---

## Phase 4: Feed hinzufügen und SYNC prüfen

### 4a — Testfeed hinzufügen

1. Options öffnen (Zahnrad-Icon oder `chrome://extensions` → Details → Extension-Optionen)
2. Feed-URL eintragen: `https://feeds.arstechnica.com/arstechnica/index` (öffentlicher Feed)
3. **Hinzufügen** klicken
4. Feed erscheint in der Liste

### 4b — Export-Ordner konfigurieren

1. In Options: **Export-Pfad** auf einen leeren lokalen Testordner setzen  
   (z. B. `C:\Temp\RSS-BOOKSTORE-test`)
2. Speichern

### 4c — SYNC auslösen

1. Popup öffnen → **SYNC** klicken
2. Status: `Sync complete` (oder ähnliche Erfolgsmeldung)
3. Im Export-Ordner: `.url`-Dateien für die Feed-Einträge vorhanden

Erwartetes Ergebnis: Mindestens 1 `.url`-Datei mit gültigem Inhalt (`[InternetShortcut]\nURL=https://...`).

---

## Phase 5: Bidirektionaler Sync (optional, wenn Bookmark-Modus aktiv)

1. Bookmark manuell im Browser anlegen (im Bookmarks-Ordner der Extension)
2. SYNC auslösen
3. `.url`-Datei für das Bookmark erscheint im Export-Ordner

---

## Phase 6: Deinstallation (Cleanup nach Test)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\native_host\install_nm_host.ps1 `
  -ExtensionId <deine-32-zeichen-id> -Uninstall
```

Extension in `chrome://extensions` entfernen.
Testordner löschen.

---

## Bekannte Einschränkungen (Alpha)

- macOS- und Linux-Native-Host existiert noch nicht (nur Windows)
- Keine Browser-Store-Verteilung — ausschließlich Sideloading
- `favextract_core.py` benötigt Netzwerkzugriff für Favicon-Download (optional)
