param(
    [string]$ExtensionId,
    [switch]$Uninstall
)

$HostName = "com.occi.clipboard_helper"
$InstallDir = "$env:LOCALAPPDATA\occi"
$Helper = "$InstallDir\clipboard_helper.ps1"
$Launcher = "$InstallDir\clipboard_helper.bat"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Source = "$ScriptDir\native-host\windows\clipboard_helper.ps1"

$RegPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName"
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
    "HKCU:\Software\Vivaldi\NativeMessagingHosts\$HostName"
    "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
)

function Do-Uninstall {
    Write-Host "Uninstalling One-Click Copy Image native helper..."
    $removed = 0

    foreach ($regPath in $RegPaths) {
        if (Test-Path $regPath) {
            Remove-Item $regPath -Force
            $removed++
        }
    }

    # Also remove manifest files (some browsers use file-based lookup)
    $manifestDirs = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\NativeMessagingHosts"
        "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts"
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\NativeMessagingHosts"
    )
    foreach ($dir in $manifestDirs) {
        $f = "$dir\$HostName.json"
        if (Test-Path $f) {
            Remove-Item $f -Force
            $removed++
        }
    }

    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
        $removed++
    }

    if ($removed -gt 0) {
        Write-Host "Removed. Restart your browser."
    } else {
        Write-Host "Nothing to remove."
    }
}

function Do-Install {
    param([string]$Id)

    if (-not $Id) {
        Write-Host ""
        Write-Host "To find your extension ID:"
        Write-Host "  1. Open chrome://extensions or brave://extensions"
        Write-Host "  2. Find 'One-Click Copy Image'"
        Write-Host "  3. Copy the ID (32 lowercase letters)"
        Write-Host ""
        $Id = Read-Host "Extension ID"
    }

    if ($Id -notmatch '^[a-z]{32}$') {
        Write-Host "Error: extension ID must be 32 lowercase letters"
        exit 1
    }

    if (-not (Test-Path $Source)) {
        Write-Host "Error: $Source not found"
        exit 1
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item $Source $Helper -Force

    # Batch launcher — Chrome can't execute .ps1 directly
    Set-Content $Launcher "@echo off`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Helper`""

    $manifest = @{
        name = $HostName
        description = "Clipboard helper for One-Click Copy Image"
        path = $Launcher
        type = "stdio"
        allowed_origins = @("chrome-extension://$Id/")
    } | ConvertTo-Json

    $manifestFile = "$InstallDir\$HostName.json"
    Set-Content $manifestFile $manifest -Encoding UTF8

    # Register via HKCU registry (no admin needed)
    $installed = 0
    foreach ($regPath in $RegPaths) {
        $parent = Split-Path $regPath
        if (-not (Test-Path $parent)) { continue }
        New-Item -Path $regPath -Force | Out-Null
        Set-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestFile
        $browser = ($regPath -split '\\')[3]
        Write-Host "  Installed for $browser"
        $installed++
    }

    # Also write manifest files for browsers that use file-based lookup
    $manifestDirs = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\NativeMessagingHosts"
        "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts"
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\NativeMessagingHosts"
    )
    foreach ($dir in $manifestDirs) {
        if (Test-Path (Split-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Set-Content "$dir\$HostName.json" $manifest -Encoding UTF8
        }
    }

    if ($installed -eq 0) {
        # Fallback: register for Chrome
        $regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
        New-Item -Path $regPath -Force | Out-Null
        Set-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestFile
        Write-Host "  Installed for Chrome (default)"
    }

    Write-Host ""
    Write-Host "Helper: $Helper"
    Write-Host "Extension ID: $Id"
    Write-Host ""
    Write-Host "Restart your browser to activate."
}

if ($Uninstall) {
    Do-Uninstall
} else {
    Do-Install -Id $ExtensionId
}
