param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [ValidateSet('Chrome', 'Edge', 'Brave')]
    [string[]]$Browser = @('Chrome', 'Edge', 'Brave'),

    [ValidateSet('CurrentUser', 'LocalMachine')]
    [string]$Scope = 'CurrentUser',

    [string]$HostName = 'com.file_bricks.rss_bookstore',

    [string]$ManifestOutput,

    [switch]$Uninstall,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostPath = Join-Path $scriptDir 'nm_host.bat'
if (-not $ManifestOutput) {
    $ManifestOutput = Join-Path $scriptDir 'nm_manifest.generated.json'
}

function Get-RegistryRoot {
    param([string]$RequestedScope)

    if ($RequestedScope -eq 'LocalMachine') {
        return 'HKLM:\'
    }
    return 'HKCU:\'
}

function Get-BrowserNativeHostSubkey {
    param([string]$Name)

    switch ($Name) {
        'Chrome' { return "Software\Google\Chrome\NativeMessagingHosts\$HostName" }
        'Edge' { return "Software\Microsoft\Edge\NativeMessagingHosts\$HostName" }
        'Brave' { return "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName" }
        default { throw "Unsupported browser: $Name" }
    }
}

function Get-RegistryPaths {
    $root = Get-RegistryRoot -RequestedScope $Scope
    return @(
        foreach ($name in $Browser) {
            Join-Path $root (Get-BrowserNativeHostSubkey -Name $name)
        }
    )
}

function New-ManifestObject {
    return [ordered]@{
        name = $HostName
        description = 'RSS-BOOKSTORE Native Messaging Host for folder export and sync.'
        path = (Resolve-Path -LiteralPath $hostPath).Path
        type = 'stdio'
        allowed_origins = @("chrome-extension://$ExtensionId/")
    }
}

function New-Plan {
    param([string]$Action)

    return [ordered]@{
        action = $Action
        hostName = $HostName
        extensionId = $ExtensionId
        browsers = @($Browser)
        scope = $Scope
        hostPath = (Resolve-Path -LiteralPath $hostPath).Path
        manifestPath = $ManifestOutput
        allowedOrigins = @("chrome-extension://$ExtensionId/")
        registryPaths = @(Get-RegistryPaths)
    }
}

if (-not (Test-Path -LiteralPath $hostPath -PathType Leaf)) {
    throw "Native host launcher not found: $hostPath"
}

if ($Uninstall) {
    $plan = New-Plan -Action 'uninstall'
    if ($DryRun) {
        $plan | ConvertTo-Json -Depth 5
        exit 0
    }

    foreach ($registryPath in $plan.registryPaths) {
        if (Test-Path -LiteralPath $registryPath) {
            Remove-Item -LiteralPath $registryPath -Force
            Write-Host "Removed $registryPath"
        }
    }
    exit 0
}

$manifest = New-ManifestObject
$plan = New-Plan -Action 'install'

if ($DryRun) {
    $plan | ConvertTo-Json -Depth 5
    exit 0
}

$manifest |
    ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $ManifestOutput -Encoding UTF8

foreach ($registryPath in $plan.registryPaths) {
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $ManifestOutput
    Write-Host "Registered $HostName for $registryPath"
}

Write-Host "Manifest written to $ManifestOutput"
