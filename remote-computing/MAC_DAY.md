# Mac mini day: start here

Goal for day one: reach the mini from your iPhone on cellular, then start the Tether host spike.

## A. Setup (~30 min)
1. Turn the mini on, finish macOS setup, use a **strong login password**.
2. Open Terminal: `git clone <this repo> && cd <repo>/remote-computing && git checkout claude/personal-remote-computing-6s0cu8`
3. `tools/setup-mac.sh doctor` — see what's wrong. Then `tools/setup-mac.sh apply` and answer the prompts.
4. Do the manual steps it prints (FileVault off, auto-login, sign in to Tailscale).
5. Install Tailscale on the MacBook and iPhone (same account).
6. **Test the fallback:** iPhone off Wi-Fi (cellular) → Tailscale on → use a VNC/Screen Sharing app, or from the MacBook: Finder → Go → Connect to Server → `vnc://<mini tailscale name>`. If this works, remote access already works and Tether is an upgrade, not a dependency.
7. Reboot the mini and confirm it comes back and is reachable without touching it.
8. Install Xcode (App Store), open it once, accept the license: `sudo xcodebuild -license accept`.
9. If no monitor is attached, buy an HDMI dummy plug.

## B. Build the host (first coding session, on the mini)
Start Claude Code in the repo on the mini and paste this:

> Read remote-computing/ARCHITECTURE.md, DEVELOPMENT.md and PROTOCOL.md. I'm on the Mac mini. Run `cd remote-computing/host && swift build` and fix the compile errors in the untested Swift skeleton, then `swift test`. Then run the capture smoke test (grant Screen Recording when asked) and report frames/second and CPU use. Don't add features until those pass.

## C. Then, in order (spike 2a → prototype 2b)
1. Capture smoke test passes; record CPU % at idle and while scrolling a web page.
2. Add the signaling server (127.0.0.1:8787, serves `client-web/` + `core/`), expose with `tailscale serve --bg 8787`.
3. Add libwebrtc: feed `ScreenCapture` frames to a video source; offer to the web client.
4. Open the HTTPS Tailscale URL in Safari on the MacBook, pair with the on-screen code, test mouse/keyboard.
5. Measure glass-to-glass latency (filmed millisecond timer) and write numbers in DEVELOPMENT.md.
6. Add to iPhone Home Screen (Share → Add to Home Screen), test touch, keyboard, background/resume.

## Decisions already made
FileVault off · Tailscale · web client for both MacBook and iPhone · libwebrtc (spike will confirm) · Developer ID deferred.
