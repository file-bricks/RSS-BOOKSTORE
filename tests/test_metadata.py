"""Contract tests validating repository hygiene, PEP 621 compliance, and safety invariants."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_notice_file_exists_and_valid():
    notice_path = REPO_ROOT / "NOTICE"
    assert notice_path.exists(), "NOTICE file must exist at repo root"
    content = notice_path.read_text(encoding="utf-8")
    assert "Lukas Geiger" in content
    assert "file-bricks" in content
    assert "open-bricks" in content
    assert "INV-LOCAL-01" in content
    assert "INV-LOCAL-02" in content
    assert "INV-LOCAL-03" in content
    assert "INV-LOCAL-10" in content
    assert "§ 521 BGB" in content


def test_third_party_licenses_sbom_and_invariants():
    sbom_path = REPO_ROOT / "THIRD_PARTY_LICENSES.md"
    assert sbom_path.exists(), "Level 1 SBOM THIRD_PARTY_LICENSES.md must exist"
    content = sbom_path.read_text(encoding="utf-8")
    for inv in (f"INV-LOCAL-{i:02d}" for i in range(1, 11)):
        assert inv in content, f"Missing invariant {inv} in THIRD_PARTY_LICENSES.md"
    assert "Zero-Copyleft" in content
    assert "PSF-2.0" in content
    assert "MIT" in content

    txt_path = REPO_ROOT / "THIRD_PARTY_LICENSES.txt"
    assert txt_path.exists(), "Direct inventory THIRD_PARTY_LICENSES.txt must exist"
    txt_content = txt_path.read_text(encoding="utf-8")
    assert re.search(r"Direct Runtime Dependencies\s+-+\s+None declared\.", txt_content)
    assert "THIRD_PARTY_LICENSES.md" in txt_content


def test_pyproject_pep621_compliance_and_frozen_version():
    pyproject_path = REPO_ROOT / "pyproject.toml"
    assert pyproject_path.exists(), "pyproject.toml must exist"
    data = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))

    project = data.get("project", {})
    # Strict Version-Freeze check (T-20260920-167562623)
    assert project.get("version") == "1.0.0", "Version must remain frozen at 1.0.0"

    license_files = project.get("license-files", [])
    expected_files = ["LICENSE", "NOTICE", "THIRD_PARTY_LICENSES.md", "THIRD_PARTY_LICENSES.txt"]
    for expected in expected_files:
        assert expected in license_files, f"Missing {expected} in project.license-files"

    urls = project.get("urls", {})
    assert "Notice" in urls
    assert "Third-Party Licenses" in urls
    assert "Parent Organization" in urls

    pytest_opts = data.get("tool", {}).get("pytest", {}).get("ini_options", {})
    norecursedirs = pytest_opts.get("norecursedirs", [])
    assert ".pytest_tmp" in norecursedirs
    assert "node_modules" in norecursedirs
    assert "releases" in norecursedirs


def test_gitignore_guards_multi_host_and_locks():
    gitignore_path = REPO_ROOT / ".gitignore"
    assert gitignore_path.exists(), ".gitignore must exist"
    content = gitignore_path.read_text(encoding="utf-8")

    # Cloud sync guards
    assert "*-WORKSTATION*" in content
    assert "*-ASUS*" in content
    assert "*-LAPTOP*" in content
    assert "*-Mac Studio*" in content
    assert "*conflicted copy*" in content

    # System locks
    assert "LOCK" in content
    assert "LOCK.*" in content
    assert "LOCK.user.*" in content
    assert "LOCK.until.*" in content
    assert "LOCK.condition.*" in content
    assert ".automation-lock" in content

    # Tooling caches
    assert ".pytest_tmp/" in content
    assert ".ruff_cache/" in content
    assert "uv.lock" in content
    assert "!package-lock.json" in content


def test_ci_workflows_timeout_and_concurrency():
    workflows_dir = REPO_ROOT / ".github" / "workflows"
    assert workflows_dir.exists(), ".github/workflows must exist"

    tests_yml = (workflows_dir / "tests.yml").read_text(encoding="utf-8")
    assert "timeout-minutes: 15" in tests_yml
    assert "cancel-in-progress: true" in tests_yml
    assert "permissions:" in tests_yml
    assert "contents: read" in tests_yml
    assert "ruff check ." in tests_yml
    assert "pytest" in tests_yml

    stale_yml = (workflows_dir / "stale.yml").read_text(encoding="utf-8")
    assert "timeout-minutes: 10" in stale_yml
    assert "cancel-in-progress: true" in stale_yml

    welcome_yml = (workflows_dir / "welcome.yml").read_text(encoding="utf-8")
    assert "timeout-minutes: 5" in welcome_yml
    assert "cancel-in-progress: true" in welcome_yml


def test_security_policy_sla_and_statutory_disclaimer():
    sec_path = REPO_ROOT / "SECURITY.md"
    assert sec_path.exists(), "SECURITY.md must exist"
    content = sec_path.read_text(encoding="utf-8")
    assert "48 Stunden" in content
    assert "48 hours" in content
    assert "§ 521 BGB" in content


def test_readme_metadata_and_legal_section_parity():
    readme_en = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    readme_de = (REPO_ROOT / "README_de.md").read_text(encoding="utf-8")

    assert "NOTICE" in readme_en and "NOTICE" in readme_de
    assert "THIRD_PARTY_LICENSES.md" in readme_en and "THIRD_PARTY_LICENSES.md" in readme_de
    assert "§ 521 BGB" in readme_en and "§ 521 BGB" in readme_de
    assert "INV-LOCAL-01" in readme_en and "INV-LOCAL-01" in readme_de


def test_marketing_log_exists():
    log_path = REPO_ROOT / "MARKETING-LOG.txt"
    assert log_path.exists(), "MARKETING-LOG.txt must exist"
    content = log_path.read_text(encoding="utf-8")
    assert "INV-LOCAL-01" in content
    assert "file-bricks" in content
