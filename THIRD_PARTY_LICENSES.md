# Third-Party Licenses & Runtime Invariants

**Repository:** `file-bricks/RSS-BOOKSTORE`  
**Stand:** 2026-09-22  
**Version:** 1.0.0  
**SPDX-License-Identifier:** MIT  
**Application Title:** RSS-BOOKSTORE  
**Distribution Mode:** GitHub Sideloading (Manifest V3 + Python Native Messaging)  
**Umbrella Ecosystem:** `open-bricks` / `file-bricks`  

---

## 1. Overview & Compliance Architecture

`RSS-BOOKSTORE` is an open-source, local-first power-user Chromium browser
extension and Windows Native Messaging host released under the permissive
**MIT License**.

RSS-BOOKSTORE is built exclusively upon **standard Chromium extension APIs**
(Manifest V3) and the **Python Standard Library**. It has **zero external runtime
dependencies** (zero npm runtime packages, zero pip runtime packages).
All runtime components, packaging manifests, and development toolchains have been
cataloged and audited for license compliance, unprivileged local execution,
and zero-copyleft guarantees.

---

## 2. Dependency Inventory & SPDX Audit

### 2.1 Core Runtime Dependencies

| Package / Component | Declared Constraint | License (SPDX) | Type / Purpose | Copyleft Compliance |
|---|---|---|---|---|
| **Chromium Extension APIs** | Manifest V3 | `BSD-3-Clause` | WebExtension APIs (`bookmarks`, `runtime`, `permissions`, `storage`, `alarms`) | Permissive (No copyleft, unencumbered) |
| **Python Standard Library** | >= 3.10 | `PSF-2.0` | Native Messaging host runtime (`json`, `struct`, `sys`, `os`, `pathlib`, `urllib`, `xml.etree`) | Permissive (No copyleft, commercially usable) |
| **Vanilla ES6 JavaScript** | Modern ECMAScript | `MIT` | Background Service Worker (`sw.js`), UI logic (`ui/`), and helper libraries (`lib/`) | Permissive (No copyleft, 100% original MIT) |

### 2.2 Development, Testing & Optional Helpers

| Package / Component | Version Constraint | License (SPDX) | Type / Purpose | Copyleft? |
|---|---|---|---|---|
| **Node.js Test Runner** | Node.js >= 18 | `MIT` | Built-in test runner (`node --test tests/*.mjs`) | No |
| **pytest** | >= 8.0.0 | `MIT` | Automated unit, integration, and metadata contract testing | No |
| **ruff** | >= 0.4.0 | `MIT OR Apache-2.0` | Static analysis, code formatting, and linting | No |
| **Pillow (PIL)** | Optional script helper | `HPND` | Developer asset helper (`scripts/generate_icons.py`, not bundled into release) | No |

---

## 3. Zero-Copyleft Affirmation & User Data Protection

1. **Permissive Application Licensing:** RSS-BOOKSTORE is licensed under the MIT License.
2. **Zero Copyleft on User Feeds & Bookmarks:** User RSS/Atom feed subscriptions, browser bookmarks, and local folder `.url` files remain the exclusive private property of the user and are never tainted by copyleft obligations.
3. **Local-First Processing:** Feeds are fetched directly from user-specified endpoints; no intermediate cloud proxy, analytics tracker, or remote collector is contacted.
4. **Commercial and Homelab Friendly:** Permitted for unrestricted use in personal, academic, enterprise, and homelab environments.

---

## 4. System Invariants & Governance Compliance

RSS-BOOKSTORE strictly conforms to the 10 System Invariants of the `open-bricks` / `file-bricks` portfolio:

| Invariant | Name | Specification & Implementation in RSS-BOOKSTORE |
|---|---|---|
| `INV-LOCAL-01` | **Zero Unsolicited Network Egress** | Network access is strictly restricted to user-configured RSS/Atom feeds with optional per-feed host permissions. Zero background telemetry or cloud relays. |
| `INV-LOCAL-02` | **Unprivileged Execution** | Executes strictly in standard user context (`RunAsInvoker`). The Native Messaging host installer registers under `HKCU` by default without requiring administrator elevation. |
| `INV-LOCAL-03` | **Zero External Runtime Dependencies** | Powered solely by Chromium extension APIs and Python standard library. Zero npm runtime dependencies, zero pip runtime dependencies. |
| `INV-LOCAL-04` | **Non-Destructive Bidirectional Sync** | Safe synchronization between browser bookmarks and Windows `.url` files with atomic write semantics and HTTP ETag/Last-Modified caching. |
| `INV-LOCAL-05` | **Open Standards Interoperability** | Standard OPML import/export support and standard Windows Internet Shortcut (`.url`) formatting. |
| `INV-LOCAL-06` | **Offline Sideload Package & Installer** | Self-contained release ZIP with dry-run PowerShell installer (`install_nm_host.ps1 -DryRun`). |
| `INV-LOCAL-07` | **Native Messaging Isolation** | Strict 32-character extension ID registration and standard binary-length prefixed stdio communication boundary. |
| `INV-LOCAL-08` | **100% Permissive Open Source** | Clean MIT License. Zero viral or copyleft contagion. |
| `INV-LOCAL-09` | **Bilingual Parity EN/DE** | Full reciprocal English (`README.md`) and German (`README_de.md`) documentation and UI internationalization. |
| `INV-LOCAL-10` | **Security & Vulnerability SLA** | Documented 48-hour response Service Level Agreement for security disclosures. |
