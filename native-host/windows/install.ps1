param(
    [string]$ExtensionId,
    [switch]$Uninstall
)

$HostName = "com.occi.clipboard_helper"
$InstallDir = "$env:LOCALAPPDATA\occi"
$HostExe = "$InstallDir\clipboard_helper.exe"
$HostCs = "$InstallDir\clipboard_helper.cs"
$Launcher = "$InstallDir\clipboard_helper.bat"
$RemoteBase = "https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/windows"
$RemoteCsUrl = "$RemoteBase/clipboard_helper.cs"
$ScriptDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { "" }
$SourceCs = if ($ScriptDir) { "$ScriptDir\clipboard_helper.cs" } else { "" }

$BrowserRegPaths = @{
    "Chrome"   = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
    "Brave"    = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName"
    "Edge"     = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
    "Vivaldi"  = "HKCU:\Software\Vivaldi\NativeMessagingHosts\$HostName"
    "Chromium" = "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
}

$BrowserManifestDirs = @{
    "Chrome" = "$env:LOCALAPPDATA\Google\Chrome\User Data\NativeMessagingHosts"
    "Brave"  = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts"
    "Edge"   = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\NativeMessagingHosts"
}

function Confirm-Action($prompt) {
    $answer = Read-Host "$prompt [y/N]"
    return $answer -match '^[yY]$'
}

function Get-ExistingIds {
    $manifestFile = "$InstallDir\$HostName.json"
    if (Test-Path $manifestFile) {
        $content = Get-Content $manifestFile -Raw
        $ids = [regex]::Matches($content, 'chrome-extension://([a-z]{32})/') | ForEach-Object { $_.Groups[1].Value }
        return @($ids)
    }
    return @()
}

function Do-Uninstall {
    Write-Host ""
    Write-Host "One-Click Copy Image - Uninstall GIF Helper"
    Write-Host "--------------------------------------------"
    Write-Host ""
    Write-Host "This will remove the GIF clipboard helper from your PC."
    Write-Host ""
    Write-Host "What will be removed:"

    $found = $false

    foreach ($browser in $BrowserRegPaths.Keys) {
        if (Test-Path $BrowserRegPaths[$browser]) {
            Write-Host "  - $browser browser registration"
            $found = $true
        }
    }

    foreach ($browser in $BrowserManifestDirs.Keys) {
        $f = "$($BrowserManifestDirs[$browser])\$HostName.json"
        if (Test-Path $f) {
            Write-Host "  - $browser manifest file"
            $found = $true
        }
    }

    if (Test-Path $InstallDir) {
        Write-Host "  - Helper files in $InstallDir"
        $found = $true
    }

    if (-not $found) {
        Write-Host ""
        Write-Host "Nothing to remove - the helper is not installed."
        return
    }

    Write-Host ""
    Write-Host "The extension itself will not be affected. You can reinstall"
    Write-Host "the helper at any time by running this script again."
    Write-Host ""

    if (-not (Confirm-Action "Remove the helper?")) {
        Write-Host "Cancelled - nothing was changed."
        return
    }

    Write-Host ""

    foreach ($browser in $BrowserRegPaths.Keys) {
        $regPath = $BrowserRegPaths[$browser]
        if (Test-Path $regPath) {
            Remove-Item $regPath -Force
            Write-Host "  Removed $browser registration"
        }
    }

    foreach ($browser in $BrowserManifestDirs.Keys) {
        $f = "$($BrowserManifestDirs[$browser])\$HostName.json"
        if (Test-Path $f) {
            Remove-Item $f -Force
            Write-Host "  Removed $browser manifest"
        }
    }

    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
        Write-Host "  Removed $InstallDir"
    }

    Write-Host ""
    Write-Host "All done! Restart your browser to finish."
}

function Do-Install {
    param([string]$Id)

    Write-Host ""
    Write-Host "One-Click Copy Image - GIF Helper Setup"
    Write-Host "----------------------------------------"
    Write-Host ""
    Write-Host "Welcome! This installs a small helper that lets the extension"
    Write-Host "copy animated GIFs to your clipboard. Without it, GIFs are"
    Write-Host "saved to your Downloads folder instead."
    Write-Host ""
    Write-Host "The helper:"
    Write-Host "  - Runs only when you click Copy on a GIF"
    Write-Host "  - Uses only built-in Windows tools (no extra software)"
    Write-Host "  - Stays in your user folder (no admin needed)"
    Write-Host "  - Is easy to remove (see instructions at the end)"
    Write-Host ""

    if (-not $Id) {
        Write-Host "To find your extension ID:"
        Write-Host "  1. Open chrome://extensions (or brave://extensions)"
        Write-Host "  2. Find 'One-Click Copy Image'"
        Write-Host "  3. Copy the ID (32 lowercase letters)"
        Write-Host ""
        $Id = Read-Host "Extension ID"
    }

    if ($Id -notmatch '^[a-z]{32}$') {
        Write-Host ""
        Write-Host "That doesn't look like a valid extension ID."
        Write-Host "It should be exactly 32 lowercase letters, like: linegepjibpagogcacmjfcpclppgjgmm"
        exit 1
    }

    $allIds = @($Id)
    $existingIds = @(Get-ExistingIds)
    foreach ($existing in $existingIds) {
        if ($existing -and $existing -ne $Id) {
            $allIds += $existing
        }
    }

    $detectedBrowsers = @()
    foreach ($browser in $BrowserRegPaths.Keys) {
        $parent = Split-Path $BrowserRegPaths[$browser]
        if (Test-Path $parent) {
            $detectedBrowsers += $browser
        }
    }
    if ($detectedBrowsers.Count -eq 0) { $detectedBrowsers = @("Chrome") }

    Write-Host ""
    Write-Host "Ready to install. Here's what will happen:"
    Write-Host ""
    Write-Host "  1. Copy the helper script to $InstallDir"
    Write-Host "  2. Register it with: $($detectedBrowsers -join ', ')"
    if ($allIds.Count -gt 1) {
        Write-Host "  3. Allowed extension IDs:"
        foreach ($id in $allIds) {
            Write-Host "     - $id"
        }
    }
    Write-Host ""

    if (-not (Confirm-Action "Continue?")) {
        Write-Host "Cancelled - nothing was changed."
        return
    }

    Write-Host ""

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    if ($SourceCs -and (Test-Path $SourceCs)) {
        Copy-Item $SourceCs $HostCs -Force
    } else {
        Write-Host "  Downloading helper..."
        try {
            Invoke-WebRequest -Uri $RemoteCsUrl -OutFile $HostCs -UseBasicParsing
        } catch {
            Write-Host ""
            Write-Host "Download failed. Check your internet connection and try again."
            exit 1
        }
    }

    Write-Host "  Compiling helper..."
    $csc = Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) "csc.exe"
    $cscArgs = "/nologo /out:`"$HostExe`" /r:System.Windows.Forms.dll /r:System.Drawing.dll `"$HostCs`""
    $compile = Start-Process $csc -ArgumentList $cscArgs -Wait -PassThru -WindowStyle Hidden
    if ($compile.ExitCode -ne 0) {
        Write-Host "  Compilation failed. Make sure .NET Framework is installed."
        exit 1
    }
    Remove-Item $HostCs -Force -ErrorAction SilentlyContinue
    Write-Host "  Helper compiled"

    Set-Content $Launcher "@echo off`n`"$HostExe`""
    Write-Host "  Helper installed"

    $origins = @($allIds | ForEach-Object { "chrome-extension://$_/" })

    $manifest = @{
        name = $HostName
        description = "Clipboard helper for One-Click Copy Image"
        path = $Launcher
        type = "stdio"
        allowed_origins = $origins
    } | ConvertTo-Json

    $manifestFile = "$InstallDir\$HostName.json"
    Set-Content $manifestFile $manifest -Encoding UTF8

    $installed = 0
    foreach ($browser in $BrowserRegPaths.Keys) {
        $regPath = $BrowserRegPaths[$browser]
        $parent = Split-Path $regPath
        if (-not (Test-Path $parent)) { continue }
        New-Item -Path $regPath -Force | Out-Null
        Set-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestFile
        Write-Host "  Registered for $browser"
        $installed++
    }

    foreach ($browser in $BrowserManifestDirs.Keys) {
        $dir = $BrowserManifestDirs[$browser]
        if (Test-Path (Split-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Set-Content "$dir\$HostName.json" $manifest -Encoding UTF8
        }
    }

    if ($installed -eq 0) {
        $regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
        New-Item -Path $regPath -Force | Out-Null
        Set-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestFile
        Write-Host "  Registered for Chrome"
    }

    Write-Host ""
    Write-Host "All done! Restart your browser, and GIF copying will work."
    Write-Host ""
    Write-Host "To remove the helper, run:"
    Write-Host "  irm https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/windows/install.ps1 -OutFile `$env:TEMP\occi-install.ps1; powershell -ExecutionPolicy Bypass -File `$env:TEMP\occi-install.ps1 -Uninstall; Remove-Item `$env:TEMP\occi-install.ps1"
}

if ($Uninstall) {
    Do-Uninstall
} else {
    Do-Install -Id $ExtensionId
}
