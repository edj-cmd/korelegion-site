import Foundation
import Network
import CryptoKit

// HTTP static server + minimal RFC 6455 WebSocket on one loopback port. Port of tools/refhost.js (which is tested end to end).
// Exposed to the tailnet with `tailscale serve --bg 8787`; binds 127.0.0.1 only, so nothing is reachable without Tailscale.
final class WSConnection {
    let conn: NWConnection; var buf = Data(); var isWS = false
    var onText: ((String) -> Void)?; var onClose: (() -> Void)?; private var closed = false
    init(_ c: NWConnection) { conn = c }

    func send(_ obj: [String: Any]) {
        guard let d = try? JSONSerialization.data(withJSONObject: obj) else { return }
        var h = Data([0x81])
        if d.count < 126 { h.append(UInt8(d.count)) }
        else if d.count < 65536 { h.append(126); h.append(UInt8(d.count >> 8)); h.append(UInt8(d.count & 0xff)) }
        else { h.append(127); for i in (0..<8).reversed() { h.append(UInt8((UInt64(d.count) >> (UInt64(i) * 8)) & 0xff)) } }
        conn.send(content: h + d, completion: .contentProcessed { _ in })
    }
    func close() { conn.send(content: Data([0x88, 0]), completion: .contentProcessed { [weak self] _ in self?.conn.cancel() }) }
    func fireClose() { if !closed { closed = true; onClose?() } }

    /// Parses complete frames from buf. Client frames are always masked.
    func parseFrames() {
        while buf.count >= 2 {
            let b = [UInt8](buf); let op = b[0] & 0x0f; let masked = b[1] & 0x80 != 0
            var len = Int(b[1] & 0x7f); var off = 2
            if len == 126 { guard b.count >= 4 else { return }; len = Int(b[2]) << 8 | Int(b[3]); off = 4 }
            else if len == 127 { guard b.count >= 10 else { return }; len = (2..<10).reduce(0) { $0 << 8 | Int(b[$1]) }; off = 10 }
            if len > 1_000_000 { close(); return }
            let need = off + (masked ? 4 : 0) + len; guard b.count >= need else { return }
            var payload = Array(b[(off + (masked ? 4 : 0))..<need])
            if masked { let m = Array(b[off..<off + 4]); for i in 0..<payload.count { payload[i] ^= m[i % 4] } }
            buf = Data(b[need...])
            if op == 8 { close(); return }
            if op == 1, let s = String(bytes: payload, encoding: .utf8) { onText?(s) }
        }
    }
}

final class HostServer {
    let port: NWEndpoint.Port; let webRoot: URL; let coreRoot: URL
    var onConnection: ((WSConnection) -> Void)?
    private var listener: NWListener?
    init(port: UInt16 = 8787, clientWeb: URL, core: URL) { self.port = NWEndpoint.Port(rawValue: port)!; webRoot = clientWeb; coreRoot = core }

    func start() throws {
        let params = NWParameters.tcp; params.requiredInterfaceType = .loopback
        let l = try NWListener(using: params, on: port)
        l.newConnectionHandler = { [weak self] c in self?.accept(c) }
        l.start(queue: .global(qos: .userInteractive)); listener = l
    }

    private func accept(_ c: NWConnection) {
        let w = WSConnection(c); c.start(queue: .global(qos: .userInteractive))
        func read() {
            c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, err in
                if let data { w.buf.append(data); if w.isWS { w.parseFrames() } else { self?.handleHTTP(w) } }
                if done || err != nil { w.fireClose(); c.cancel(); return }
                read()
            }
        }
        read()
    }

    private func handleHTTP(_ w: WSConnection) {
        guard let end = w.buf.range(of: Data("\r\n\r\n".utf8)), let head = String(data: w.buf[..<end.lowerBound], encoding: .utf8) else { return }
        w.buf = Data(w.buf[end.upperBound...])
        let lines = head.components(separatedBy: "\r\n"); let parts = lines[0].split(separator: " ")
        guard parts.count >= 2 else { return w.conn.cancel() }
        var path = String(parts[1]).components(separatedBy: "?")[0]
        var hdr: [String: String] = [:]
        for l in lines.dropFirst() { if let i = l.firstIndex(of: ":") { hdr[l[..<i].lowercased()] = l[l.index(after: i)...].trimmingCharacters(in: .whitespaces) } }
        if path == "/ws", let key = hdr["sec-websocket-key"] {
            let accept = Data(Insecure.SHA1.hash(data: Data((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").utf8))).base64EncodedString()
            w.conn.send(content: Data("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: \(accept)\r\n\r\n".utf8), completion: .contentProcessed { _ in })
            w.isWS = true; onConnection?(w); w.parseFrames(); return
        }
        if path == "/" { path = "/index.html" }
        let base = path.hasPrefix("/core/") ? coreRoot.deletingLastPathComponent() : webRoot
        let file = base.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(base.standardizedFileURL.path), let body = try? Data(contentsOf: file) else {
            w.conn.send(content: Data("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8), completion: .contentProcessed { _ in w.conn.cancel() }); return
        }
        let type = ["html": "text/html", "js": "text/javascript", "webmanifest": "application/manifest+json"][file.pathExtension] ?? "application/octet-stream"
        w.conn.send(content: Data("HTTP/1.1 200 OK\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".utf8) + body,
                    completion: .contentProcessed { _ in w.conn.cancel() })
    }
}
