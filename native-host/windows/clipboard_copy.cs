using System;
using System.Collections.Specialized;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

class Program {
    [STAThread]
    static int Main(string[] args) {
        if (args.Length < 1) return 1;
        try {
            byte[] gifBytes = File.ReadAllBytes(args[0]);
            using (var ms = new MemoryStream(gifBytes))
            using (var image = Image.FromStream(ms)) {
                var data = new DataObject();
                data.SetData("GIF", false, new MemoryStream(gifBytes));
                data.SetImage(image);
                var files = new StringCollection();
                files.Add(args[0]);
                data.SetFileDropList(files);
                Clipboard.SetDataObject(data, true);
            }
            return 0;
        } catch {
            return 1;
        }
    }
}
