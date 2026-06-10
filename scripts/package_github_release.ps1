param(
    [string]$Version,

    [string]$OutputDir,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$manifestPath = Join-Path $projectRoot 'manifest.json'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $Version) {
    $Version = [string]$manifest.version
}

if ($Version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$') {
    throw "Unsupported release version: $Version"
}

$packageName = "RSS-BOOKSTORE-$Version-github"
if (-not $OutputDir) {
    $OutputDir = Join-Path $projectRoot "releases\v$Version"
}

$outputDirFull = [System.IO.Path]::GetFullPath($OutputDir)
$stagingPath = Join-Path $outputDirFull $packageName
$zipPath = Join-Path $outputDirFull "$packageName.zip"
$checksumPath = Join-Path $outputDirFull 'SHA256SUMS.txt'

$includeEntries = @(
    [ordered]@{ source = 'manifest.json'; type = 'file' },
    [ordered]@{ source = 'README.md'; type = 'file' },
    [ordered]@{ source = 'RELEASES.md'; type = 'file' },
    [ordered]@{ source = 'package.json'; type = 'file' },
    [ordered]@{ source = 'sw.js'; type = 'file' },
    [ordered]@{ source = 'scripts'; type = 'directory' },
    [ordered]@{ source = 'lib'; type = 'directory' },
    [ordered]@{ source = 'ui'; type = 'directory' },
    [ordered]@{ source = 'icons'; type = 'directory' },
    [ordered]@{ source = 'native_host\favextract_core.py'; type = 'file' },
    [ordered]@{ source = 'native_host\install_nm_host.ps1'; type = 'file' },
    [ordered]@{ source = 'native_host\nm_host.bat'; type = 'file' },
    [ordered]@{ source = 'native_host\nm_host.py'; type = 'file' },
    [ordered]@{ source = 'native_host\nm_manifest.json'; type = 'file' }
)

$excludedEntries = @(
    'tests',
    'node_modules',
    '.git',
    '.pytest_cache',
    '__pycache__',
    'releases',
    'native_host\nm_manifest.generated.json',
    'native_host\__pycache__'
)

function Assert-UnderPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Parent
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\')

    if (-not ($fullPath.Equals($fullParent, [System.StringComparison]::OrdinalIgnoreCase) -or
            $fullPath.StartsWith($fullParent + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Refusing to modify path outside release output: $fullPath"
    }
}

function Get-Sha256Hex {
    param(
        [Parameter(Mandatory = $true)][string]$Path
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return (($hashBytes | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
}

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Parent
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'

    if (-not $fullPath.StartsWith($fullParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is not below parent: $fullPath"
    }

    return $fullPath.Substring($fullParent.Length)
}

function Test-ExcludedRelativePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Trim('\', '/') -replace '/', '\'
    $segments = @($normalized -split '\\+' | Where-Object { $_ })
    $excludedSegments = @('node_modules', '.git', '.pytest_cache', '__pycache__', 'releases')

    foreach ($segment in $excludedSegments) {
        if ($segments -contains $segment) {
            return $true
        }
    }

    foreach ($excluded in $excludedEntries) {
        $excludedNormalized = $excluded.Trim('\', '/') -replace '/', '\'
        if ($normalized.Equals($excludedNormalized, [System.StringComparison]::OrdinalIgnoreCase) -or
            $normalized.StartsWith($excludedNormalized + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    $leaf = $segments[-1]
    if ($leaf -match '\.bak$') {
        return $true
    }

    return $false
}

function Copy-ReleaseEntry {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][string]$StagingRoot
    )

    if ((Get-Item -LiteralPath $SourcePath).PSIsContainer) {
        Get-ChildItem -LiteralPath $SourcePath -Recurse -File -Force | ForEach-Object {
            $relativePath = Get-RelativePath -Path $_.FullName -Parent $ProjectRoot
            if (-not (Test-ExcludedRelativePath -RelativePath $relativePath)) {
                $destinationPath = Join-Path $StagingRoot $relativePath
                $destinationDir = Split-Path -Parent $destinationPath
                if ($destinationDir -and -not (Test-Path -LiteralPath $destinationDir)) {
                    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Force
            }
        }
        return
    }

    $relativePath = Get-RelativePath -Path $SourcePath -Parent $ProjectRoot
    if (Test-ExcludedRelativePath -RelativePath $relativePath) {
        return
    }

    $destinationPath = Join-Path $StagingRoot $relativePath
    $destinationDir = Split-Path -Parent $destinationPath
    if ($destinationDir -and -not (Test-Path -LiteralPath $destinationDir)) {
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
}

function New-InstallInstructions {
    param([string]$ReleasePackageName)

    return @"
RSS-BOOKSTORE Native Messaging Setup
====================================

1. Extract this ZIP.
2. Load the extracted "$ReleasePackageName" folder as an unpacked extension in Chrome, Edge, or Brave.
3. Copy the generated 32-character extension ID from the browser extension details page.
4. Open PowerShell in the extracted "$ReleasePackageName" folder.
5. Run:

powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

Replace the example ID with the real extension ID.

Preview the registration without writing registry keys:

powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -DryRun

Uninstall the registration:

powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -Uninstall
"@
}

function New-ReleasePlan {
    $includes = @(
        foreach ($entry in $includeEntries) {
            [ordered]@{
                source = $entry.source
                type = $entry.type
            }
        }
    )

    return [ordered]@{
        packageName = $packageName
        version = $Version
        outputDir = $outputDirFull
        stagingPath = $stagingPath
        zipPath = $zipPath
        checksumPath = $checksumPath
        includes = $includes
        generated = @('INSTALL_NATIVE_HOST.txt')
        excluded = $excludedEntries
        installCommands = @(
            'powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -DryRun',
            'powershell -NoProfile -ExecutionPolicy Bypass -File .\native_host\install_nm_host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -Uninstall'
        )
    }
}

$plan = New-ReleasePlan
if ($DryRun) {
    $plan | ConvertTo-Json -Depth 6
    exit 0
}

New-Item -ItemType Directory -Path $outputDirFull -Force | Out-Null

Assert-UnderPath -Path $stagingPath -Parent $outputDirFull
Assert-UnderPath -Path $zipPath -Parent $outputDirFull
Assert-UnderPath -Path $checksumPath -Parent $outputDirFull

if (Test-Path -LiteralPath $stagingPath) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null

foreach ($entry in $includeEntries) {
    $sourcePath = Join-Path $projectRoot $entry.source
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Release source missing: $($entry.source)"
    }

    Copy-ReleaseEntry -SourcePath $sourcePath -ProjectRoot $projectRoot -StagingRoot $stagingPath
}

$instructionsPath = Join-Path $stagingPath 'INSTALL_NATIVE_HOST.txt'
New-InstallInstructions -ReleasePackageName $packageName |
    Set-Content -LiteralPath $instructionsPath -Encoding UTF8

Compress-Archive -LiteralPath $stagingPath -DestinationPath $zipPath -Force

$hash = Get-Sha256Hex -Path $zipPath
"$hash  $(Split-Path -Leaf $zipPath)" |
    Set-Content -LiteralPath $checksumPath -Encoding ASCII

Remove-Item -LiteralPath $stagingPath -Recurse -Force

[ordered]@{
    packageName = $packageName
    zipPath = $zipPath
    checksumPath = $checksumPath
    sha256 = $hash
} | ConvertTo-Json -Depth 4
