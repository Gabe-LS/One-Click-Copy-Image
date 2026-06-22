#!/usr/bin/python3
"""
Native messaging host that copies GIF data to the macOS clipboard.
Uses osascript (JXA) to access NSPasteboard — no dependencies beyond macOS itself.
"""

import json
import struct
import sys
import base64
import subprocess
import tempfile
import os


def copy_gif_to_clipboard(gif_bytes):
    with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as f:
        f.write(gif_bytes)
        tmp_path = f.name

    try:
        jxa = (
            """
ObjC.import('AppKit');
var data = $.NSData.dataWithContentsOfFile('%s');
var gifType = 'com.compuserve.gif';
var tiffType = 'public.tiff';
var pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;
var image = $.NSImage.alloc.initWithData(data);
var tiff = image.TIFFRepresentation;
if (tiff && !tiff.isNil()) {
    pb.declareTypesOwner($([gifType, tiffType]), null);
    pb.setDataForType(data, gifType);
    pb.setDataForType(tiff, tiffType);
} else {
    pb.declareTypesOwner($([gifType]), null);
    pb.setDataForType(data, gifType);
}
'ok';
"""
            % tmp_path
        )

        result = subprocess.run(
            ["/usr/bin/osascript", "-l", "JavaScript", "-e", jxa],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0 and "ok" in result.stdout
    finally:
        os.unlink(tmp_path)


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack("<I", raw)[0]
    if length == 0 or length > 50_000_000:
        return None
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    return json.loads(data)


def send_message(obj):
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


msg_in = read_message()
if not msg_in or "action" not in msg_in:
    send_message({"success": False, "error": "Invalid message"})
    sys.exit(1)

if msg_in["action"] == "copyGif" and "base64" in msg_in:
    try:
        gif_bytes = base64.b64decode(msg_in["base64"])
        ok = copy_gif_to_clipboard(gif_bytes)
        send_message({"success": ok})
    except Exception as e:
        send_message({"success": False, "error": str(e)})
else:
    send_message({"success": False, "error": "Unknown action or missing data"})
