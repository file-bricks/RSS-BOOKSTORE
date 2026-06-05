"""Tests for the RSS-BOOKSTORE native messaging installer script."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import unittest


class NativeHostInstallerTests(unittest.TestCase):
    def test_installer_dry_run_reports_manifest_and_registry_plan(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        installer = project_root / "native_host" / "install_nm_host.ps1"
        extension_id = "a" * 32

        self.assertTrue(installer.exists(), "install_nm_host.ps1 is missing")

        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(installer),
                "-ExtensionId",
                extension_id,
                "-DryRun",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)

        self.assertEqual(plan["action"], "install")
        self.assertEqual(plan["hostName"], "com.file_bricks.rss_bookstore")
        self.assertEqual(plan["allowedOrigins"], [f"chrome-extension://{extension_id}/"])
        self.assertTrue(plan["hostPath"].endswith(r"native_host\nm_host.bat"))
        self.assertTrue(plan["manifestPath"].endswith(r"native_host\nm_manifest.generated.json"))
        self.assertEqual(set(plan["browsers"]), {"Chrome", "Edge", "Brave"})
        self.assertTrue(
            any(
                path.endswith(
                    r"Software\Google\Chrome\NativeMessagingHosts\com.file_bricks.rss_bookstore"
                )
                for path in plan["registryPaths"]
            )
        )


if __name__ == "__main__":
    unittest.main()
