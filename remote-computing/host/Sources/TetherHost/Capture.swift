import Foundation
import ScreenCaptureKit
import CoreMedia

// ScreenCaptureKit capture. Needs Screen Recording permission. Frames are delivered as CMSampleBuffers (IOSurface-backed).
// SPIKE 2a: hand these to the WebRTC video source (libwebrtc custom capturer) and measure CPU/latency. NOT yet wired.
final class ScreenCapture: NSObject, SCStreamOutput {
    private var stream: SCStream?
    var onFrame: ((CMSampleBuffer) -> Void)?

    func start(fps: Int, scale: Double) async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else { throw NSError(domain: "Tether", code: 1, userInfo: [NSLocalizedDescriptionKey: "no display (headless? use a dummy HDMI plug)"]) }
        let filter = SCContentFilter(display: display, excludingWindows: [])
        let cfg = SCStreamConfiguration()
        cfg.width = Int(Double(display.width) * scale); cfg.height = Int(Double(display.height) * scale)
        cfg.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
        cfg.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        cfg.showsCursor = true; cfg.queueDepth = 3
        let s = SCStream(filter: filter, configuration: cfg, delegate: nil)
        try s.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue(label: "tether.capture", qos: .userInteractive))
        try await s.startCapture(); stream = s
    }
    /// Live tier change without tearing down the stream.
    func apply(_ t: Tier, display: SCDisplay) async throws {
        let cfg = SCStreamConfiguration()
        cfg.width = Int(Double(display.width) * t.scale); cfg.height = Int(Double(display.height) * t.scale)
        cfg.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(t.fps))
        cfg.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange; cfg.showsCursor = true; cfg.queueDepth = 3
        try await stream?.updateConfiguration(cfg)
    }
    func stop() async { try? await stream?.stopCapture(); stream = nil }

    func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sb.isValid else { return }
        // Skip idle/blank frames: only forward frames SCK marks as complete.
        if let arr = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
           let status = arr.first?[.status] as? Int, status != SCFrameStatus.complete.rawValue { return }
        onFrame?(sb)
    }
}
