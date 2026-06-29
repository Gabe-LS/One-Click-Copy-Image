using System;
using System.Collections.Specialized;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

class Program {
    [STAThread]
    static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "--copy")
            return CopyToClipboard(args.Length > 1 ? args[1] : null);
        return NativeHost();
    }

    static int CopyToClipboard(string gifPath) {
        if (gifPath == null || !File.Exists(gifPath)) return 1;
        try {
            byte[] gifBytes = File.ReadAllBytes(gifPath);
            using (var ms = new MemoryStream(gifBytes))
            using (var image = Image.FromStream(ms)) {
                var data = new DataObject();
                data.SetData("GIF", false, new MemoryStream(gifBytes));
                data.SetImage(image);
                var files = new StringCollection();
                files.Add(gifPath);
                data.SetFileDropList(files);
                Clipboard.SetDataObject(data, true, 10, 100);
            }
            Application.DoEvents();
            return 0;
        } catch {
            return 1;
        }
    }

    static int NativeHost() {
        try {
            byte[] msg = ReadNativeMessage();
            if (msg == null) {
                SendNativeMessage("{\"success\":false,\"error\":\"no input\"}");
                return 1;
            }

            string json = Encoding.UTF8.GetString(msg);
            string action = ExtractJsonString(json, "action");
            string base64 = ExtractJsonString(json, "base64");

            if (action != "copyGif" || base64 == null) {
                SendNativeMessage("{\"success\":false,\"error\":\"Unknown action\"}");
                return 0;
            }

            byte[] gifBytes = Convert.FromBase64String(base64);
            string installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "occi");
            string gifPath = Path.Combine(installDir, "clipboard.gif");
            File.WriteAllBytes(gifPath, gifBytes);

            string self = Process.GetCurrentProcess().MainModule.FileName;
            var proc = Process.Start(new ProcessStartInfo {
                FileName = self,
                Arguments = "--copy \"" + gifPath + "\"",
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
