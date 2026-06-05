# Beitragsrichtlinie / Contributing Guide

## Deutsch

Danke für Ihr Interesse an RSS-BOOKSTORE.

### Wie Sie beitragen können

1. **Bug melden:** Öffnen Sie ein GitHub Issue mit Reproduktionsschritten.
2. **Feature vorschlagen:** Beschreiben Sie Nutzen, Zielgruppe und erwartetes Verhalten.
3. **Code beitragen:** Erstellen Sie einen Pull Request gegen `main`.

### Lokale Entwicklung

RSS-BOOKSTORE ist eine Manifest-V3-Browser-Erweiterung ohne Build-Schritt.

1. Repository klonen
2. `edge://extensions/` oder `chrome://extensions/` öffnen
3. Entwicklermodus aktivieren
4. Diesen Ordner als entpackte Erweiterung laden
5. Extension-ID aus den Browser-Erweiterungsdetails kopieren
6. Native Messaging Host registrieren: `powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId <ID>`
7. Änderung testen, Extension neu laden, Verhalten im Pull Request beschreiben

JavaScript-Tests: `npm.cmd test`
Python-Tests: `python -B -m unittest discover -s tests -p "test_*.py" -v`
`-B` verhindert `__pycache__`-Ordner im entpackten Extension-Pfad.

### Pull Requests

- Kleine, klar abgegrenzte Änderungen bevorzugen
- Keine API-Keys, Tokens, lokalen Testdaten oder privaten Feedlisten committen
- Keine hardcodierten lokalen Pfade
- Änderungen am Native Messaging Host separat von Extension-Änderungen halten
- Neue Features mit Tests absichern (JavaScript oder Python)

### Lizenz

Beiträge werden unter der MIT-Lizenz dieses Projekts eingereicht, sofern im Pull Request nichts anderes ausdrücklich vereinbart wird.

---

## English

Thank you for your interest in RSS-BOOKSTORE.

### How to Contribute

1. **Report bugs:** Open a GitHub issue with reproduction steps.
2. **Suggest features:** Describe the benefit, target user, and expected behavior.
3. **Contribute code:** Open a pull request against `main`.

### Local Development

RSS-BOOKSTORE is a Manifest V3 browser extension with no build step.

1. Clone the repository
2. Open `edge://extensions/` or `chrome://extensions/`
3. Enable developer mode
4. Load this folder as an unpacked extension
5. Copy the generated extension ID from the browser extension details page
6. Register the Native Messaging host: `powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId <ID>`
7. Test the change, reload the extension, and describe the behavior in the pull request

JavaScript tests: `npm.cmd test`
Python tests: `python -B -m unittest discover -s tests -p "test_*.py" -v`
`-B` prevents `__pycache__` folders in the unpacked extension path.

### Pull Requests

- Prefer small, focused changes
- Do not commit API keys, tokens, local test data, or private feed lists
- Do not hardcode local paths
- Keep Native Messaging host changes separate from extension changes
- Cover new features with tests (JavaScript or Python)

### License

Contributions are submitted under this project's MIT license unless explicitly agreed otherwise in the pull request.
