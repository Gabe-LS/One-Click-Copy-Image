using System;
using System.Diagnostics;
using System.IO;
using System.Text;

class Program {
    static int Main() {
        try {
            byte[] msg = ReadNativeMessage();
            if (msg == null) {
                SendNativeMessage("{\"success\":false,\"error\":\"no input\"}");
                return 1;
            }

            string json = Encoding.UTF8.GetString(msg);
            string base64 = ExtractBase64(json);
            string action = ExtractAction(json);

            if (action != "copyGif" || base64 == null) {
                SendNativeMessage("{\"success\":false,\"error\":\"Unknown action\"}");
                return 0;
            }

            byte[] gifBytes = Convert.FromBase64String(base64);
            string installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "occi");
            string gifPath = Path.Combine(installDir, "clipboard.gif");
            File.WriteAllBytes(gifPath, gifBytes);

            string clipExe = Path.Combine(installDir, "clipboard_copy.exe");
            var proc = Process.Start(new ProcessStartInfo {
                FileName = clipExe,
                Arguments = "\"" + gifPath + "\"",
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
            proc.WaitForExit();

            if (proc.ExitCode == 0) {
                SendNativeMessage("{\"success\":true}");
            } else {
                SendNativeMessage("{\"success\":false,\"error\":\"Clipboard copy failed\"}");
            }
            return 0;
        } catch (Exception ex) {
            SendNativeMessage("{\"success\":false,\"error\":\"" + Escape(ex.Message) + "\"}");
            return 1;
        }
    }

    static byte[] ReadNativeMessage() {
        var stdin = Console.OpenStandardInput();
        byte[] lenBuf = new byte[4];
        if (stdin.Read(lenBuf, 0, 4) < 4) return null;
        uint len = BitConverter.ToUInt32(lenBuf, 0);
        if (len == 0 || len > 50000000) return null;
        byte[] msgBuf = new byte[len];
        int offset = 0;
        while (offset < len) {
            int read = stdin.Read(msgBuf, offset, (int)(len - offset));
            if (read <= 0) return null;
            offset += read;
        }
        return msgBuf;
    }

    static void SendNativeMessage(string json) {
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        var stdout = Console.OpenStandardOutput();
        stdout.Write(BitConverter.GetBytes((uint)bytes.Length), 0, 4);
        stdout.Write(bytes, 0, bytes.Length);
        stdout.Flush();
    }

    static string ExtractAction(string json) {
        return ExtractJsonString(json, "action");
    }

    static string ExtractBase64(string json) {
        return ExtractJsonString(json, "base64");
    }

    static string ExtractJsonString(string json, string key) {
        string pattern = "\"" + key + "\"";
        int i = json.IndexOf(pattern);
        if (i < 0) return null;
        i = json.IndexOf('"', i + pattern.Length);
        if (i < 0) return null;
        i++;
        int end = json.IndexOf('"', i);
        if (end < 0) return null;
        return json.Substring(i, end - i);
    }

    static string Escape(string s) {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
    }
}
