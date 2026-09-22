# Sicherheitsrichtlinie / Security Policy

## Deutsch

### Sicherheitslücken melden

Bitte melden Sie Sicherheitsprobleme verantwortungsvoll:

1. **Kein öffentliches Issue eröffnen**
2. GitHub Private Vulnerability Reporting verwenden: `Security` -> `Advisories` -> `New`
3. Beschreibung, Reproduktionsschritte, betroffene Version und mögliche Auswirkungen angeben

Falls Private Vulnerability Reporting im Repository nicht verfügbar ist, kontaktieren Sie den Maintainer über GitHub und veröffentlichen Sie keine Details in einem öffentlichen Issue.

### Geltungsbereich

- Manifest-V3-Berechtigungen und Host-Zugriffe
- Feed-Abruf, Feed-Autodiscovery und Netzwerkverhalten
- Bookmark-Erstellung, Bookmark-Löschung und lokale Extension-Speicherung
- Native Messaging Host: Dateioperationen, Registry-Einträge, Prozess-Kommunikation
- OPML-Import/Export
- Bidirektionaler Ordner-Sync

### Nicht im Geltungsbereich

- Sicherheitsprobleme fremder Feed-Server oder Browser
- Inhalte, Tracking oder Schadcode innerhalb fremder Feeds
- Verlust lokaler Browserdaten außerhalb der von RSS-BOOKSTORE verwalteten Lesezeichen

### Reaktion & Service Level Agreement (SLA)

- **Erstbewertung (Initial Triage):** Innerhalb von 48 Stunden nach Eingang einer vertraulichen Meldung (INV-LOCAL-10).
- **Behebungsziel (Remediation Target):** Kritische Schwachstellen werden prioritär innerhalb von 5 Werktagen adressiert und über ein Patch-Release bereitgestellt.
- **Haftungsausschluss gem. § 521 BGB:** Die Bereitstellung dieser Software erfolgt unentgeltlich (Gefälligkeitsrecht). Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt. Siehe kanonische `NOTICE`.

---

## English

### Reporting a Vulnerability

Please report security issues responsibly:

1. **Do not open a public issue**
2. Use GitHub Private Vulnerability Reporting: `Security` -> `Advisories` -> `New`
3. Include a description, reproduction steps, affected version, and potential impact

If private vulnerability reporting is not available in this repository, contact the maintainer through GitHub and do not publish details in a public issue.

### Scope

- Manifest V3 permissions and host access
- Feed fetching, feed autodiscovery, and network behavior
- Bookmark creation, bookmark deletion, and local extension storage
- Native Messaging host: file operations, registry entries, process communication
- OPML import/export
- Bidirectional folder sync

### Out of Scope

- Security issues in third-party feed servers or browsers
- Content, tracking, or malicious code inside third-party feeds
- Loss of local browser data outside bookmarks managed by RSS-BOOKSTORE

### Response & Service Level Agreement (SLA)

- **Initial Triage:** Within 48 hours of receipt via GitHub Private Vulnerability Reporting (INV-LOCAL-10).
- **Remediation Target:** Critical vulnerabilities are prioritized with a target patch release within 5 business days.
- **Statutory Limitation of Liability (§ 521 BGB):** RSS-BOOKSTORE is provided free of charge under open-source terms. Under German statutory law (§ 521 BGB Gefälligkeitsrecht) and the MIT License, liability is limited to intent and gross negligence. See `NOTICE` for full attribution and legal details.
