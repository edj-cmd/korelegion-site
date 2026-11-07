import Foundation
import CryptoKit

// Verifies WebCrypto ECDSA P-256 signatures (raw r||s) from paired devices. Mirrors core/auth.js.
enum Auth {
    static func payload(_ purpose: String, _ challenge: String) -> Data { Data("tether/v1/\(purpose)/\(challenge)".utf8) }

    static func verify(spkiB64: String, purpose: String, challenge: String, sigB64: String) -> Bool {
        guard let spki = Data(base64Encoded: spkiB64), let sig = Data(base64Encoded: sigB64),
              let key = try? P256.Signing.PublicKey(derRepresentation: spki),
              let ecdsa = try? P256.Signing.ECDSASignature(rawRepresentation: sig) else { return false }
        return key.isValidSignature(ecdsa, for: payload(purpose, challenge))
    }

    static func newChallenge() -> String { Data((0..<32).map { _ in UInt8.random(in: 0...255) }).base64EncodedString() }
}

/// One-time pairing code: 8 digits, 5 min, single use, 5 attempts.
final class PairingSession {
    let code: String; private let expires: Date; private var attempts = 0; private var used = false
    init(ttl: TimeInterval = 300, now: Date = Date()) { code = String(format: "%08d", Int.random(in: 0..<100_000_000)); expires = now.addingTimeInterval(ttl) }
    func redeem(_ c: String, now: Date = Date()) -> String {
        if used { return "used" }; if now > expires { return "expired" }; if attempts >= 5 { return "locked" }
        attempts += 1; if c != code { return "bad-code" }; used = true; return "ok"
    }
}

/// Paired devices persisted in a JSON file (public keys only; nothing secret). Path: ~/Library/Application Support/Tether/devices.json
struct DeviceRegistry: Codable { var devices: [String: Device] = [:]
    struct Device: Codable { var name: String; var spki: String; var added: Date }
    static var url: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Tether/devices.json") }
    static func load() -> DeviceRegistry { (try? JSONDecoder().decode(DeviceRegistry.self, from: Data(contentsOf: url))) ?? DeviceRegistry() }
    func save() throws { try FileManager.default.createDirectory(at: Self.url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: Self.url, options: .atomic) }
}
