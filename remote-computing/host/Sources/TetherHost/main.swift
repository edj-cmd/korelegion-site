import Foundation
import WebRTC

// Tether host: signaling per protocol/PROTOCOL.md (reference: tools/refhost.js, tested end to end), capture -> WebRTC.
// UNTESTED. Usage: TetherHost [--web /path/to/remote-computing]   (default: current directory)
let root = URL(fileURLWithPath: CommandLine.arguments.drop(while: { $0 != "--web" }).dropFirst().first ?? FileManager.default.currentDirectoryPath)
var registry = DeviceRegistry.load()
var pairing = PairingSession()
print("Tether host (UNTESTED). Pairing code: \(pairing.code)  (5 min, single use)")

RTCInitializeSSL()
let factory = RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(), decoderFactory: RTCDefaultVideoDecoderFactory())
let source = factory.videoSource(); let capturer = RTCVideoCapturer(delegate: source)
let input = InputInjector(); let capture = ScreenCapture()
var sessions: [ObjectIdentifier: Session] = [:]
let lock = NSLock()

capture.onFrame = { sb in push(sb, to: source, capturer: capturer) }
Task { do { try await capture.start(fps: 60, scale: 1.0) } catch { print("capture failed: \(error)  (grant Screen Recording; check a display is attached)"); exit(1) } }

let server = HostServer(clientWeb: root.appendingPathComponent("client-web"), core: root.appendingPathComponent("core"))
server.onConnection = { ws in
    var deviceId: String?; var challenge: String?; var session: Session?
    ws.onText = { text in
        guard let m = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any], let type = m["type"] as? String else { return }
        lock.lock(); defer { lock.unlock() }
        switch type {
        case "pair":
            let r = pairing.redeem(m["code"] as? String ?? "")
            guard r == "ok", let pub = m["pub"] as? String else { return ws.send(["type": "error", "reason": r]) }
            let id = UUID().uuidString; registry.devices[id] = .init(name: String((m["name"] as? String ?? "device").prefix(40)), spki: pub, added: Date())
            try? registry.save(); pairing = PairingSession(); ws.send(["type": "paired", "id": id])
        case "hello":
            guard let id = m["id"] as? String, registry.devices[id] != nil else { return ws.send(["type": "error", "reason": "unauthorized"]) }
            deviceId = id; challenge = Auth.newChallenge(); ws.send(["type": "challenge", "challenge": challenge!])
        case "auth":
            guard let id = deviceId, let c = challenge, let sig = m["sig"] as? String,
                  Auth.verify(spkiB64: registry.devices[id]!.spki, purpose: "connect", challenge: c, sigB64: sig) else { challenge = nil; return ws.send(["type": "error", "reason": "unauthorized"]) }
            challenge = nil; ws.send(["type": "ready"])
            let s = Session(factory: factory, source: source, ws: ws, input: input); session = s
            sessions[ObjectIdentifier(s)] = s; s.start()
        case "answer", "ice": session?.handleSignal(m)
        default: break
        }
    }
    ws.onClose = { lock.lock(); defer { lock.unlock() }; if let s = session { s.stop(); sessions[ObjectIdentifier(s)] = nil } }
}
do { try server.start(); print("listening on 127.0.0.1:8787 — run: tailscale serve --bg 8787") } catch { print("server failed: \(error)"); exit(1) }
RunLoop.main.run()
