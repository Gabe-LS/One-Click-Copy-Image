#!/usr/bin/env python3
import json
import struct
import sys
import base64

import AppKit


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


def copy_gif_to_clipboard(b64):
    data = base64.b64decode(b64)

    gif_type = AppKit.NSPasteboardType("com.compuserve.gif")
    pb = AppKit.NSPasteboard.generalPasteboard()
    pb.clearContents()

    ns_data = AppKit.NSData.dataWithBytes_length_(data, len(data))
    image = AppKit.NSImage.alloc().initWithData_(ns_data)

    types = [gif_type]
    if image and image.TIFFRepresentation():
        types.append(AppKit.NSPasteboardTypeTIFF)

    pb.declareTypes_owner_(types, None)
    pb.setData_forType_(ns_data, gif_type)

    if image and image.TIFFRepresentation():
        pb.setData_forType_(image.TIFFRepresentation(), AppKit.NSPasteboardTypeTIFF)

    return True


msg = read_message()
if not msg or "action" not in msg:
    send_message({"success": False, "error": "Invalid message"})
    sys.exit(1)

if msg["action"] == "copyGif" and "base64" in msg:
    try:
        ok = copy_gif_to_clipboard(msg["base64"])
        send_message({"success": ok})
    except Exception as e:
        send_message({"success": False, "error": str(e)})
else:
    send_message({"success": False, "error": "Unknown action or missing data"})
