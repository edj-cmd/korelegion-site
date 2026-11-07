# DEVELOPMENT

## Current status
Phase 1 (research & architecture) delivered as documents. No product code exists. See ARCHITECTURE.md and DEPENDENCIES.md.

## Environment
- This cloud container: Linux, Rust/Go/Node available, **no Swift/macOS/iPhone**. Used for docs, protocol/policy logic and web client unit tests only.
- Real build/test target: the Mac mini (host), MacBook, iPhone. Phase 2 needs to run there (e.g. a Claude Code session on the Mac mini with Xcode/Swift installed).
- Code location: currently inside `korelegion-site` (an unrelated marketing repo) only because this session is scoped to it. Recommend moving to its own private repo before code is written.

## Roadmap
| Phase | Deliverable | Exit criteria |
|---|---|---|
| 0 (this week, on Mac) | Enable macOS Screen Sharing over Tailscale as fallback; decide FileVault/sleep/dummy-plug questions | You can reach the mini from phone/laptop off-network |
| 1 | Docs (done) | You approve decisions |
| 2a Spike | SCK → VideoToolbox → libwebrtc custom source; measure CPU and latency on LAN | Working video in Safari; numbers recorded |
| 2b Prototype | Host + web client (MacBook Safari), pairing, mouse/keyboard, over Tailscale | Usable desktop session; glass-to-glass measured |
| 3 | Perf engine, 4 profiles, reconnection, benchmarks with netem-style impairment | Documented before/after |
| 4 | PWA polish on iPhone: touch, pinch-zoom, soft keyboard, resume | Daily-usable on real iPhone |
| 5 | Reliability/security: launchd, crash recovery, sleep, network switching, soak tests | Multi-day soak without intervention |
| 6 | Terminal, file browser, agent workflows (modular) | Core perf unaffected |

## Smallest prototype to build first
One Swift command-line host: capture main display, hardware-encode H.264, send over WebRTC to a static web page opened in Safari on the MacBook via `tailscale serve`, with mouse/keyboard back over a DataChannel and a one-time pairing code. No file transfer, clipboard, adaptation, or multi-display yet. Goal: prove latency and the PWA path before investing further.

## Known limitations / open questions
See ARCHITECTURE.md §6. Open decisions for the owner: FileVault, headless display solution, repo location, acceptance of Tailscale dependency, Apple Developer ID.

## Next steps
1. Owner reviews docs and answers open decisions.
2. Owner enables Phase 0 fallback.
3. Start Phase 2a spike on the Mac mini.

## Phase 0 checklist — do when the Mac mini arrives (owner action)
Decision made: FileVault OFF (the mini stays at home; reliable remote recovery matters more).
- [ ] Create a strong login password (the mini is reachable over the network).
- [ ] System Settings → Privacy & Security → FileVault → Turn Off (wait for decryption).
- [ ] Users & Groups → Automatically log in as (appears once FileVault is off).
- [ ] Energy → "Prevent automatic sleeping when the display is off" ON; "Start up automatically after a power failure" ON.
- [ ] Install Tailscale on the mini, MacBook and iPhone; sign in with the same account.
- [ ] General → Sharing → Screen Sharing ON (fallback while we build).
- [ ] Test from the iPhone on cellular: connect via Tailscale and Screen Sharing.
- [ ] Consider an HDMI dummy plug if the mini runs without a monitor.
- [ ] Install Xcode (for the Phase 2 host build).
Until the mini exists: Phase 2 host work is blocked; web client UI and performance-policy logic can be built and unit-tested without it.
