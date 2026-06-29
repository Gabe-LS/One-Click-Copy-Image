Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type -ReferencedAssemblies @("System.Drawing", "System.Windows.Forms") -TypeDefinition @"
using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

public class GifClipboard {
    public static string CopyGif(byte[] gifBytes) {
        string error = null;
        var thread = new Thread(() => {
            try {
                using (var ms = new MemoryStream(gifBytes))
                using (var image = Image.FromStream(ms)) {
                    var data = new DataObject();
                    data.SetData("GIF", false, new MemoryStream(gifBytes));
                    data.SetImage(image);
                    Clipboard.SetDataObject(data, true);
                }
            } catch (Exception ex) {
                error = ex.Message;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return error;
    }
}
"@

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

try {
    $msg = Read-NativeMessage
    if (-not $msg) {
        Send-NativeMessage @{ success = $false; error = "no input" }
        exit 1
    }

    if ($msg.action -eq "copyGif" -and $msg.base64) {
        $gifBytes = [Convert]::FromBase64String($msg.base64)
        $copyErr = [GifClipboard]::CopyGif($gifBytes)
        if ($copyErr) {
            Send-NativeMessage @{ success = $false; error = $copyErr }
        } else {
            Send-NativeMessage @{ success = $true }
        }
    } else {
        Send-NativeMessage @{ success = $false; error = "Unknown action" }
    }
} catch {
    Send-NativeMessage @{ success = $false; error = $_.Exception.Message }
}
