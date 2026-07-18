# macOS-/Linux-Native-Host-Gate

Stand: 2026-07-03

RSS-BOOKSTORE bleibt vorerst eine Windows-Chromium-Erweiterung mit
Windows-Native-Messaging-Host. Für macOS oder Linux wird aktuell kein Host,
Installer oder Paketierungspfad gestartet.

## Entscheidung

- Kein macOS-/Linux-Native-Host ohne belegte Nutzer-Nachfrage.
- Keine Platzhalter-Installer für macOS oder Linux im Release-ZIP.
- Keine Änderung am Produktversprechen: RSS-BOOKSTORE ist die Power-User-Linie
  für Windows-Sideloading, lokales `.url`-Archiv und Native Messaging.

## Warum

Der Kernnutzen hängt an Windows-Details:

- `.url`-Dateien als Explorer-/OneDrive-kompatibles Archivformat.
- PowerShell-Installer für Chrome, Edge und Brave.
- Registry-basierte Native-Messaging-Registrierung.
- README, Release-ZIP und E2E-Smoke sind auf diesen Pfad abgestimmt.

macOS und Linux haben andere Native-Messaging-Manifestpfade, andere
Dateiverknüpfungen und andere Paketierungs-/Support-Erwartungen. Ein
halbfertiger Host würde die Alpha-Installation schwerer erklären, ohne den
Windows-Kernnutzen zu verbessern.

## Demand-Gate

Ein macOS-/Linux-Machbarkeitscheck startet erst, wenn mindestens eines davon
vorliegt:

- ein konkreter Nutzer nennt Betriebssystem, Browser und Sync-Zielordner,
- ein Issue beschreibt einen echten Alltags-Workflow außerhalb von Windows,
- ein Maintainer braucht den Host selbst regelmäßig auf macOS oder Linux.

## Mindestumfang bei späterem Start

Wenn das Gate ausgelöst wird, beginnt die Arbeit mit einem separaten
Machbarkeitszweig, nicht mit stillen Änderungen am Windows-Host:

- Native-Messaging-Manifestpfade für macOS und Linux dokumentieren,
- Host-Launcher ohne Windows-Batch-Datei bereitstellen,
- Pfad- und Dateiformat-Entscheidung für `.url`-Äquivalent oder alternatives
  Linkformat treffen,
- Install-/Uninstall-Dry-Run ohne Systemmutation ergänzen,
- E2E-Smoke mit entpackter Erweiterung, Host-Ping, Export und Watcher
  dokumentieren.
