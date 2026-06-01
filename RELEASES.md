# RSS-BOOKSTORE Releases

## v1.0.0 GitHub Package

Status: locally packageable for GitHub/sideloading distribution.

Build the release ZIP from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package_github_release.ps1
```

Preview the exact file list without creating artifacts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package_github_release.ps1 -DryRun
```

The script writes:

- `releases\v1.0.0\RSS-BOOKSTORE-1.0.0-github.zip`
- `releases\v1.0.0\SHA256SUMS.txt`

The ZIP includes the unpacked extension, the release packaging script, the
Native Messaging host, the PowerShell host installer, and
`INSTALL_NATIVE_HOST.txt`. It excludes tests, cache folders, generated Native
Messaging manifests, and prior release output.

GitHub publishing checklist:

- Upload the ZIP and `SHA256SUMS.txt`.
- Mention that RSS-BOOKSTORE is sideload-only because Native Messaging needs a
  local registry registration.
- Tell users to load the extracted folder as an unpacked extension before
  running `_native_host\install_nm_host.ps1` with their generated extension ID.
