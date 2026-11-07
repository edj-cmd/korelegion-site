# HANDOFF — Tether (personal remote-computing platform)

Repo: `edj-cmd/korelegion-site`, branch `claude/personal-remote-computing-6s0cu8`, folder `remote-computing/`.
(The repo is the Kore Legion marketing site; the project lives in its own subfolder and can move to its own repo later.)
"Tether" is a working name Claude chose, not a product name.

## 1. Goal
Control the owner's Mac mini (M-series, 16 GB, macOS) from a 2020 Intel MacBook Pro and an iPhone, from anywhere, with low latency, adaptive quality, strong security and low host overhead. Better than Jump Desktop and Astropad Workbench is the aspiration; it must be proven by measurement (BENCHMARK_PLAN.md). The Mac mini **has not arrived yet**; it will have a monitor attached. The owner also uses Claude Cowork on the Mac mini and leaves it in charge of many tasks, so Tether doubles as a supervision tool.

## 2. Decisions made (with the owner)
- FileVault **off**, automatic login on, no sleep, display never sleeps (mini stays at home).
- Tailscale as the network layer; no public ports. Host binds 127.0.0.1:8787 and is exposed with `tailscale serve`.
- WebRTC + H.264; one web client serves both the MacBook and the iPhone PWA. Native MacBook client only if browser keyboard limits hurt.
- Host in Swift (ScreenCaptureKit, VideoToolbox via libwebrtc, CGEvent). Google libwebrtc via a prebuilt Swift package is the plan, pending a spike.
- Performance engine is a small rule-based policy, not AI.
- Apple Developer ID ($99/yr): deferred until the prototype works.
- Not building enterprise features, analytics, or remote power control.

## 3. What exists (honest status)
| Area | Files | State |
|---|---|---|
| Performance policy, 4 profiles | `core/perf.js` | Built; 11 unit tests pass |
| Pairing + ECDSA P-256 challenge auth | `core/auth.js` | Built; 7 tests pass |
| Input wire format + validation | `core/input.js` | Built; 5 tests pass |
| Touch gestures (tap, drag, 2-finger scroll/right-click, pinch, tap-drag) | `client-web/gestures.js` | Built; 9 tests pass. Feel needs a real iPhone |
| Web client / PWA (pairing UI, reconnect, key bar, profiles, stats, paste-to-Mac) | `client-web/` | Verified in headless Chromium via e2e. Never run on iOS or against the real host |
| Reference host (Node, zero deps) | `tools/refhost.js`, `tools/serve.js` | Built; executable spec of the protocol |
| End-to-end test | `tools/e2e.cjs` | **12 checks pass** (real client + reference host + fake media peer) |
| Protocol spec | `protocol/PROTOCOL.md` | Written |
| Swift host (server, WebRTC session, capture, input, clipboard, perf, auth, launchd plist) | `host/`, `tools/com.tether.host.plist` | **Written, never compiled.** libwebrtc API names and package URL/version are from memory |
| Mac setup helper | `tools/setup-mac.sh` | Written, `bash -n` only; never run (needs macOS) |
| Docs | `ARCHITECTURE.md`, `DEPENDENCIES.md`, `DEVELOPMENT.md`, `COMPETITORS.md`, `BENCHMARK_PLAN.md`, `MAC_DAY.md` | Written |

Tests: `npm test` (32 unit tests); `node tools/e2e.cjs` (needs Playwright + Chromium). Local client preview: `node tools/serve.js`; reference host: `node tools/refhost.js`.

## 4. Not built
File transfer; multi-display; terminal (plan: tmux + web terminal); Cowork "I'm driving" takeover and view-only modes; Mac→phone clipboard; input validation inside the Swift host (TODO in `Session.swift`); real-network benchmarks; WebRTC ICE-restart (client reconnects with a fresh session instead).

## 5. Unverified claims to re-check
Licenses other than RustDesk (AGPL-3.0), MeshCentral and Guacamole (Apache-2.0), which were read from READMEs. Tailscale details; iOS Safari PWA behavior (background suspension, keyboard, clipboard, WebCrypto key persistence in an installed PWA); libwebrtc package name/version/API; `launchctl` commands for Screen Sharing; whether capture survives the monitor being off. Competitor facts are vendor marketing (COMPETITORS.md); prices may have changed. Latency targets in ARCHITECTURE.md are goals, not results.

## 6. Known risks
FileVault-off tradeoff accepted. TCC permissions (Screen Recording, Accessibility) need a stable signed binary or macOS may re-prompt. A compromised Tether pairing would give control of everything Cowork can touch, so keep pairing strict. iOS may kill the PWA in the background (design = fast reconnect). Cloud container had no Swift/macOS/iPhone, so all host code is untested.

## 7. Next steps (in order)
1. Owner: set up the Mac mini via `MAC_DAY.md` + `tools/setup-mac.sh`; install Tailscale on all devices.
2. Run BENCHMARK_PLAN.md baselines for Jump Desktop and Workbench **before** building further.
3. On the mini: `cd remote-computing/host && swift build`; fix compile errors (verify libwebrtc package/version/license); `swift test`.
4. Run the host; `tailscale serve --bg 8787`; open the HTTPS URL in Safari on the MacBook; pair with the on-screen code; confirm video + input. Check against `node tools/e2e.cjs` behavior if something differs.
5. Measure latency; record in BENCHMARK_PLAN.md; add to iPhone Home Screen; test touch, keyboard, background/resume.
6. Port remaining TODOs; add takeover/view-only modes; Phase 5 reliability soak; Phase 6 terminal/AI workflows.
7. Decide buy-vs-build from the benchmark verdict rules. If Jump Desktop is good enough, narrow Tether to the supervision/agent layer.

## 8. Kickoff prompt for the next Claude session (on the Mac mini)
> Read remote-computing/HANDOFF.md, ARCHITECTURE.md, DEVELOPMENT.md and PROTOCOL.md. I'm on the Mac mini with Xcode. Branch claude/personal-remote-computing-6s0cu8. First run `node tools/e2e.cjs` and `npm test` to confirm the baseline, then `cd remote-computing/host && swift build` and fix compile errors in the untested Swift host (verify the libwebrtc package URL/version/license first). Don't add features until it builds, `swift test` passes, and the web client connects to it. Be honest about what you tested.

## 9. Working agreements
Do not claim something works without testing it. Prefer permissive licenses; never copy AGPL/GPL code. No new dependencies without a reason. Keep DEVELOPMENT.md current. Commit to the designated branch; do not open a PR unless asked.
