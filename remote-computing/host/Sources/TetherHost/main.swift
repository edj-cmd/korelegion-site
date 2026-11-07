import Foundation

// Entry point. Currently a smoke-test harness: prints a pairing code and checks capture permission.
// TODO (spike 2a): WebSocket signaling server on 127.0.0.1:8787 (+ static files from client-web/ and core/),
//   libwebrtc peer connection fed by ScreenCapture, DataChannels -> InputInjector, perf loop -> PerfPolicy.step.
let pairing = PairingSession()
print("Tether host (UNTESTED skeleton). Pairing code: \(pairing.code) (valid 5 minutes)")
let cap = ScreenCapture()
var frames = 0
cap.onFrame = { _ in frames += 1 }
Task {
    do { try await cap.start(fps: 30, scale: 1.0); try await Task.sleep(nanoseconds: 3_000_000_000)
         print("captured \(frames) frames in 3 s"); await cap.stop(); exit(0) }
    catch { print("capture failed: \(error)  (grant Screen Recording in System Settings → Privacy & Security)"); exit(1) }
}
RunLoop.main.run()
