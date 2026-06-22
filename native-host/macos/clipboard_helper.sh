#!/bin/bash
# Native messaging host for One-Click Copy Image (macOS)
# Reads a GIF from Chrome's native messaging protocol and copies it
# to the macOS clipboard with animation preserved.
# Uses only built-in macOS tools: bash, dd, od, base64, osascript.

read_msg() {
    local len_hex
    len_hex=$(dd bs=1 count=4 2>/dev/null | od -A n -t x1 | tr -d ' \n')
    [ ${#len_hex} -lt 8 ] && return 1
    local b0=0x${len_hex:0:2} b1=0x${len_hex:2:2} b2=0x${len_hex:4:2} b3=0x${len_hex:6:2}
    local len=$(( b0 + (b1 << 8) + (b2 << 16) + (b3 << 24) ))
    dd bs=1 count="$len" 2>/dev/null
}

send_msg() {
    local msg="$1" len=${#1}
    printf "\\x$(printf '%02x' $((len & 0xff)))\\x$(printf '%02x' $(((len >> 8) & 0xff)))\\x$(printf '%02x' $(((len >> 16) & 0xff)))\\x$(printf '%02x' $(((len >> 24) & 0xff)))"
    printf '%s' "$msg"
}

MSG=$(read_msg)
[ -z "$MSG" ] && { send_msg '{"success":false,"error":"no input"}'; exit 1; }

B64=$(printf '%s' "$MSG" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin).get('base64',''))" 2>/dev/null)
[ -z "$B64" ] && { send_msg '{"success":false,"error":"no base64"}'; exit 1; }

TMPFILE=$(mktemp /tmp/occi.XXXXXX.gif)
printf '%s' "$B64" | base64 -d > "$TMPFILE" 2>/dev/null

RESULT=$(/usr/bin/osascript -l JavaScript -e "
ObjC.import('AppKit');
var data = $.NSData.dataWithContentsOfFile('$TMPFILE');
var pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;
var image = $.NSImage.alloc.initWithData(data);
var tiff = image ? image.TIFFRepresentation : null;
if (tiff && !tiff.isNil()) {
    pb.declareTypesOwner(\$(['com.compuserve.gif', 'public.tiff']), null);
    pb.setDataForType(data, 'com.compuserve.gif');
    pb.setDataForType(tiff, 'public.tiff');
} else {
    pb.declareTypesOwner(\$(['com.compuserve.gif']), null);
    pb.setDataForType(data, 'com.compuserve.gif');
}
'ok';
" 2>&1)

rm -f "$TMPFILE"

if [ "$RESULT" = "ok" ]; then
    send_msg '{"success":true}'
else
    send_msg "{\"success\":false,\"error\":\"osascript failed\"}"
fi
