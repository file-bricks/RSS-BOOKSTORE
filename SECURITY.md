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

### Reaktion

RSS-BOOKSTORE ist ein kleines Open-Source-Projekt. Kritische Meldungen werden priorisiert; bitte geben Sie angemessene Zeit vor einer öffentlichen Offenlegung.

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

### Response

RSS-BOOKSTORE is a small open-source project. Critical reports are prioritized; please allow reasonable time before public disclosure.
