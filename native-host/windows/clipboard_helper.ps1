function Read-NativeMessage {
    $stdin = [System.Console]::OpenStandardInput()
    $lenBuf = New-Object byte[] 4
    $read = $stdin.Read($lenBuf, 0, 4)
    if ($read -lt 4) { return $null }
    $len = [BitConverter]::ToUInt32($lenBuf, 0)
    if ($len -eq 0 -or $len -gt 50000000) { return $null }
    $msgBuf = New-Object byte[] $len
    $offset = 0
    while ($offset -lt $len) {
        $read = $stdin.Read($msgBuf, $offset, $len - $offset)
        if ($read -le 0) { return $null }
        $offset += $read
    }
    return [System.Text.Encoding]::UTF8.GetString($msgBuf) | ConvertFrom-Json
}

function Send-NativeMessage($obj) {
    $json = $obj | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $stdout = [System.Console]::OpenStandardOutput()
    $lenBuf = [BitConverter]::GetBytes([uint32]$bytes.Length)
    $stdout.Write($lenBuf, 0, 4)
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}

function Copy-GifToClipboard($base64) {
    $gifBytes = [Convert]::FromBase64String($base64)
    $tmpFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "occi-clipboard.gif")
    [System.IO.File]::WriteAllBytes($tmpFile, $gifBytes)

    $clipScript = @"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
`$gifPath = '$tmpFile'
`$gifBytes = [System.IO.File]::ReadAllBytes(`$gifPath)
`$ms = New-Object System.IO.MemoryStream(,`$gifBytes)
`$image = [System.Drawing.Image]::FromStream(`$ms)
`$data = New-Object System.Windows.Forms.DataObject
`$data.SetData('GIF', `$false, (New-Object System.IO.MemoryStream(,`$gifBytes)))
`$data.SetImage(`$image)
`$files = New-Object System.Collections.Specialized.StringCollection
`$files.Add(`$gifPath)
`$data.SetFileDropList(`$files)
[System.Windows.Forms.Clipboard]::SetDataObject(`$data, `$true)
`$image.Dispose()
`$ms.Dispose()
"@

    $proc = Start-Process powershell.exe -ArgumentList "-NoProfile -STA -ExecutionPolicy Bypass -Command `"$clipScript`"" -Wait -PassThru -WindowStyle Hidden
    return $proc.ExitCode -eq 0
}

try {
    $msg = Read-NativeMessage
    if (-not $msg) {
        Send-NativeMessage @{ success = $false; error = "no input" }
        exit 1
    }

    if ($msg.action -eq "copyGif" -and $msg.base64) {
        $ok = Copy-GifToClipboard $msg.base64
        if ($ok) {
            Send-NativeMessage @{ success = $true }
        } else {
            Send-NativeMessage @{ success = $false; error = "Clipboard copy failed" }
        }
    } else {
        Send-NativeMessage @{ success = $false; error = "Unknown action" }
    }
} catch {
    Send-NativeMessage @{ success = $false; error = $_.Exception.Message }
}
