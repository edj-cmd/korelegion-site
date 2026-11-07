import Foundation
import WebRTC
import CoreMedia
import AppKit

// One authenticated client = one Session: WebRTC peer connection (host is the offerer), data channels, perf loop.
// UNTESTED against the real libwebrtc API: names/signatures follow stasel/WebRTC (Google's ObjC API) from memory; fix on first build.
final class Session: NSObject, RTCPeerConnectionDelegate, RTCDataChannelDelegate {
    private let factory: RTCPeerConnectionFactory; private let source: RTCVideoSource
    private let ws: WSConnection; private let input: InputInjector
    private var pc: RTCPeerConnection?; private var ptr: RTCDataChannel?; private var ctl: RTCDataChannel?
    private var perf = PerfState(.balanced); private var sender: RTCRtpSender?
    var onTier: ((Tier) -> Void)?

    init(factory: RTCPeerConnectionFactory, source: RTCVideoSource, ws: WSConnection, input: InputInjector) {
        self.factory = factory; self.source = source; self.ws = ws; self.input = input; super.init()
    }

    func start() {
        let cfg = RTCConfiguration(); cfg.iceServers = []; cfg.sdpSemantics = .unifiedPlan     // tailnet: no STUN/TURN
        let c = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        guard let pc = factory.peerConnection(with: cfg, constraints: c, delegate: self) else { return }
        self.pc = pc
        let track = factory.videoTrack(with: source, trackId: "screen")
        sender = pc.add(track, streamIds: ["tether"])
        let pi = RTCDataChannelConfiguration(); pi.isOrdered = false; pi.maxRetransmits = 0
        ptr = pc.dataChannel(forLabel: "ptr", configuration: pi); ptr?.delegate = self
        ctl = pc.dataChannel(forLabel: "ctl", configuration: RTCDataChannelConfiguration()); ctl?.delegate = self
        pc.offer(for: c) { [weak self] sdp, _ in
            guard let self, let sdp else { return }
            pc.setLocalDescription(sdp) { _ in self.ws.send(["type": "offer", "sdp": sdp.sdp]) }
        }
    }
    func handleSignal(_ m: [String: Any]) {
        if m["type"] as? String == "answer", let s = m["sdp"] as? String { pc?.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: s)) { _ in } }
        if m["type"] as? String == "ice", let c = m["candidate"] as? [String: Any], let s = c["candidate"] as? String {
            pc?.add(RTCIceCandidate(sdp: s, sdpMLineIndex: Int32(c["sdpMLineIndex"] as? Int ?? 0), sdpMid: c["sdpMid"] as? String)) { _ in }
        }
    }
    func stop() { pc?.close(); pc = nil }

    // Apply the performance engine's target to the encoder (bitrate/fps via RTCRtpSender; resolution via capture scale).
    private func apply(_ t: Tier) {
        if let p = sender?.parameters.encodings.first { p.maxBitrateBps = NSNumber(value: Int(t.bitrate)); p.maxFramerate = NSNumber(value: t.fps)
            let params = sender!.parameters; params.encodings = [p]; sender!.parameters = params }
        onTier?(t)
        sendCtl(["t": "tier", "scale": t.scale, "fps": t.fps, "bitrate": t.bitrate, "reason": "policy"])
    }
    private func sendCtl(_ o: [String: Any]) {
        guard let d = try? JSONSerialization.data(withJSONObject: o) else { return }
        ctl?.sendData(RTCDataBuffer(data: d, isBinary: false))
    }

    func dataChannel(_ ch: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        guard let m = (try? JSONSerialization.jsonObject(with: buffer.data)) as? [String: Any], let t = m["t"] as? String else { return }
        switch t {
        case "profile": if let n = m["name"] as? String, let p = Profile(rawValue: n) { perf = PerfState(p); apply(p.tiers[p.start]) }
        case "stats":
            let s = NetStats(rttMs: m["rttMs"] as? Double ?? 0, lossPct: m["lossPct"] as? Double ?? 0, jitterMs: m["jitterMs"] as? Double ?? 0, availBps: m["availBps"] as? Double ?? 0)
            let r = PerfPolicy.step(perf, s); perf = r.state; if r.changed { apply(r.target) }
        case "clip": if let s = m["s"] as? String, s.count <= 100_000 { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(s, forType: .string) }
        default: input.handle(m)      // TODO: reject messages that fail the core/input.js validation rules before injecting
        }
    }
    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {}
    func peerConnection(_ pc: RTCPeerConnection, didGenerate c: RTCIceCandidate) {
        ws.send(["type": "ice", "candidate": ["candidate": c.sdp, "sdpMLineIndex": Int(c.sdpMLineIndex), "sdpMid": c.sdpMid ?? ""]])
    }
    func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCSignalingState) {}
    func peerConnection(_ pc: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ pc: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ pc: RTCPeerConnection) {}
    func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCIceConnectionState) {}
    func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCIceGatheringState) {}
    func peerConnection(_ pc: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ pc: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}

/// Feeds ScreenCaptureKit frames into libwebrtc's video source.
func push(_ sb: CMSampleBuffer, to source: RTCVideoSource, capturer: RTCVideoCapturer) {
    guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
    let ts = Int64(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sb)) * 1_000_000_000)
    source.capturer(capturer, didCapture: RTCVideoFrame(buffer: RTCCVPixelBuffer(pixelBuffer: pb), rotation: ._0, timeStampNs: ts))
}
