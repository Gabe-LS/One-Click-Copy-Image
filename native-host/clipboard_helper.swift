import AppKit
import Foundation

// Chrome native messaging: messages are length-prefixed (4-byte LE uint32) JSON.

func readMessage() -> [String: Any]? {
    var lengthBytes = [UInt8](repeating: 0, count: 4)
    guard fread(&lengthBytes, 1, 4, stdin) == 4 else { return nil }
    let length = UInt32(lengthBytes[0])
        | UInt32(lengthBytes[1]) << 8
        | UInt32(lengthBytes[2]) << 16
        | UInt32(lengthBytes[3]) << 24
    guard length > 0, length < 50_000_000 else { return nil }

    var buffer = [UInt8](repeating: 0, count: Int(length))
    guard fread(&buffer, 1, Int(length), stdin) == Int(length) else { return nil }

    let data = Data(buffer)
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
}

func sendMessage(_ dict: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
    var length = UInt32(data.count)
    fwrite(&length, 4, 1, stdout)
    data.withUnsafeBytes { fwrite($0.baseAddress!, 1, data.count, stdout) }
    fflush(stdout)
}

func copyGifToClipboard(base64: String) -> Bool {
    guard let data = Data(base64Encoded: base64) else { return false }

    let gifType = NSPasteboard.PasteboardType("com.compuserve.gif")
    let pb = NSPasteboard.general
    pb.clearContents()

    var types: [NSPasteboard.PasteboardType] = [gifType]
    if let image = NSImage(data: data), let tiff = image.tiffRepresentation {
        types.append(.tiff)
        pb.declareTypes(types, owner: nil)
        pb.setData(data, forType: gifType)
        pb.setData(tiff, forType: .tiff)
    } else {
        pb.declareTypes(types, owner: nil)
        pb.setData(data, forType: gifType)
    }

    return true
}

guard let msg = readMessage(),
      let action = msg["action"] as? String else {
    sendMessage(["success": false, "error": "Invalid message"])
    exit(1)
}

if action == "copyGif" {
    guard let base64 = msg["base64"] as? String else {
        sendMessage(["success": false, "error": "Missing base64 data"])
        exit(1)
    }
    let ok = copyGifToClipboard(base64: base64)
    sendMessage(["success": ok])
} else {
    sendMessage(["success": false, "error": "Unknown action"])
}
