# ARCHITECTURE — Personal Remote Computing Platform (working name: "Tether")

Status: Phase 1 proposal. **Nothing here has been built or tested yet.**
Evidence labels: **[verified]** = checked against a primary source this session; **[knowledge]** = from my background knowledge, must be re-checked; **[device-test]** = can only be settled on your real hardware.

## 1. Goals (condensed)
Control a Mac mini from a MacBook (Intel 2020) and an iPhone, from anywhere, with low latency, adaptive quality, strong security, and low host overhead (16 GB RAM). Lightweight beats feature-rich.

## 2. Research findings

| Project | License | What it is | Verdict |
|---|---|---|---|
| RustDesk | **AGPL-3.0** [verified] | Rust remote desktop; own rendezvous/relay servers, libvpx/aom/opus via vcpkg, Flutter UI [verified] | **Study only. Do not copy code.** AGPL is incompatible with a proprietary product; also no browser/PWA client. Its design (hole punching + relay fallback) is reusable as an idea. |
| MeshCentral | Apache-2.0 [verified] | Self-hosted Node.js management server + agents; browser remote desktop, terminal, files [verified] | Fleet-management oriented (Intel AMT, groups). Heavy for one machine; its desktop path is not a hardware-video pipeline [knowledge]. Useful reference for terminal/file relay. **Not adopted.** |
| Apache Guacamole | Apache-2.0 [verified] | HTML5 gateway over VNC/RDP/SSH via guacd [knowledge] | Image-diff streaming over WebSocket, no hardware video, and it needs a VNC server on the Mac [knowledge]. Wrong fit for "feels like sitting at it". **Not adopted.** |

Conclusion: none of the three gives hardware-encoded low-latency video to Safari. The right proven building block is **WebRTC**, which every browser (including iOS Safari) already decodes in hardware.

## 3. Decisions (ADRs, brief)

**ADR-1 Transport: WebRTC (video track + DataChannels).** Brings congestion control (GCC), NACK/FEC, jitter buffering, SRTP/DTLS encryption, and hardware decode in Safari for free. Tradeoff: large dependency; limited encoder tuning. Alternative (custom UDP + own codec pipeline) rejected: reinvents what WebRTC solves, and cannot run in a PWA.

**ADR-2 Reachability: Tailscale as the network layer.** WireGuard-based mesh, NAT traversal, relay fallback (DERP), device identity + ACLs, MagicDNS, free-for-personal tier [knowledge]. Host exposes **no public port**. `tailscale serve` supplies a trusted HTTPS cert for the PWA (service workers/PWA install require HTTPS) [knowledge]. Tradeoffs: iPhone must run the Tailscale app (VPN slot), dependency on Tailscale's coordination service (Headscale is an escape hatch). Raw WireGuard rejected as primary (no NAT traversal tooling to build/maintain). Own signaling + coturn TURN kept as a **later** fallback.

**ADR-3 One video format for all clients: H.264 (constrained baseline/high), 4:2:0.** Hardware-encoded on Apple Silicon via VideoToolbox; hardware-decoded on the Intel MacBook and iPhone. HEVC/AV1 later, only if measurement justifies it (Safari WebRTC HEVC support must be verified [device-test]).

**ADR-4 Host: native Swift app/launch agent.** ScreenCaptureKit (capture, GPU-resident IOSurface frames, damage-aware) → VideoToolbox → WebRTC sender. CGEvent for input injection. Swift is the only sane way to reach these APIs. Tradeoff: Swift for the host core. Rust remains an option for shared logic (e.g. the performance-engine policy) but is **not** introduced until needed.

**ADR-5 WebRTC library on host: Google libwebrtc (BSD-3) via a prebuilt Swift package, evaluated against str0m (Rust, MIT).** Default plan: libwebrtc, because built-in GCC bandwidth estimation and `RTCRtpSender` parameters (max bitrate / framerate / scale-down) are exactly the knobs the performance engine drives. Prototype step 0 verifies a custom frame source can be fed from ScreenCaptureKit zero-copy. If not, fall back to str0m + own VideoToolbox encoder (more control, more work). Package choice is a **decision-pending-spike**, not final.

**ADR-6 Client strategy: web client first, native MacBook client only if needed.** The PWA and the MacBook can share one codebase (TypeScript, no framework, tiny bundle). Browsers cannot capture Cmd-Tab/Cmd-Q/system shortcuts and have no Pointer Lock on iOS; if MacBook ergonomics demand it, add a thin native client (Swift + VideoToolbox decode) later. This pulls a minimal viewer forward from Phase 4 into Phase 2, because it de-risks both devices at once. (This deviates from your phase order; reasoning is that the PWA is the highest-risk client and should be tested early.)

**ADR-7 Input path.** Pointer motion on an unordered/unreliable DataChannel (drop stale moves, coalesce); keys, clicks, clipboard, and file chunks on a reliable ordered channel. Host injects via CGEvent.

**ADR-8 Performance engine = a small policy loop, not an AI.** Inputs: WebRTC stats (RTT, jitter, loss, available outgoing bitrate, encoded fps, frames dropped/encode time) sampled ~1 Hz (faster only during a degrading event). Outputs: target bitrate, fps cap, resolution scale. Hysteresis: degrade fast (<1 s), recover slowly (5–10 s steps). Profiles are just different parameter envelopes. "Predictive" mode (trend of RTT/loss slope) is deferred until real logs exist. No model, no extra daemon, runs inside the host process.

## 4. Component layout

```
 iPhone PWA ─┐                         ┌───────────────────────────────┐
             ├─ HTTPS+WebRTC over ─────▶  Mac mini host (launchd agent)│
 MacBook web ┘   Tailscale (WireGuard)  │  SCK capture → VT H.264      │
   client                               │  libwebrtc sender + DC       │
                                        │  CGEvent input, pasteboard   │
                                        │  pairing + auth, perf engine │
                                        │  static web client server    │
                                        └───────────────────────────────┘
```
- `host/` Swift package: capture, encode, rtc, input, auth, perf, files.
- `client-web/` TypeScript PWA (also the MacBook client).
- `docs/`, `tools/bench/` (latency + bitrate benchmarking).
Signaling for v1 is a single authenticated HTTPS/WebSocket endpoint served **by the host itself** over the tailnet. No cloud server of our own.

## 5. Security model
- Layer 1: tailnet membership + Tailscale ACLs (only your devices).
- Layer 2: app-level pairing. Host shows a one-time code/QR; client generates a WebCrypto P-256/Ed25519 key (non-extractable where supported), host stores the public key. Each connection = signed challenge. Revocable list on host.
- Layer 3: DTLS-SRTP on the media path; session tokens short-lived.
- Host secrets in macOS Keychain. Input injection refused unless authenticated peer; lockout/rate-limit on failed auth. No remote power controls.
- Open question [device-test]: persistence of WebCrypto keys in an installed iOS PWA (storage eviction behavior).

## 6. Known technical limits and risks (be aware now)
1. **FileVault + reboot:** after a reboot, a FileVault Mac sits at pre-boot unlock; no network service (Tailscale included) is up until someone unlocks it. Remote recovery from a power cut is impossible with FileVault on. Decision for you: FileVault off (physical-security tradeoff) or accept the limit. [knowledge]
2. **Login window / lock screen:** a user-session agent can't capture/inject on the login window; keep the Mac auto-logged-in (needs FileVault off) or screen locked (capture works, unlock typing is possible but verify) [device-test].
3. **Headless Mac mini:** with no monitor attached, macOS may expose no display or a weak GPU framebuffer; an HDMI dummy plug or virtual display is likely needed [knowledge]. Multi-display support depends on this.
4. **Permissions:** Screen Recording + Accessibility (TCC) must be granted once by hand; a changed binary signature can invalidate grants, so sign with a stable Developer ID/cert.
5. **iOS PWA:** backgrounding suspends the page and kills WebRTC; recovery means fast re-signal/ICE restart, not true persistence. No Fullscreen API on iPhone Safari, but standalone mode hides browser UI. Soft keyboard needs a hidden focused input and some keys (modifiers, Esc, arrows) via our own bar. Clipboard API requires user gesture. All [knowledge]; **must be tested on your iPhone.**
6. **Intel 2020 MBP** decodes H.264 in hardware; 4K60 is not a goal. Browser tab overhead is small but nonzero.
7. **Apple developer account:** not needed for the PWA. A signed/notarized host needs an Apple Developer ID ($99/yr) for stable permissions and Gatekeeper.
8. **Cannot test in this container:** it is Linux with no Swift, macOS, or iPhone. Host/capture/encode code must be built and benchmarked on your Mac. Pure-logic parts (perf policy, protocol, web client UI) can be unit-tested here.
9. **Day-one fallback:** macOS built-in Screen Sharing over Tailscale works today and operates at the login window. Enable it as insurance while we build.

## 7. Performance notes
- ScreenCaptureKit delivers IOSurface frames; feed VideoToolbox without CPU copies. Cap capture at the stream fps; skip encoding when frames are unchanged (idle desktop ≈ near-zero CPU/bitrate).
- Low-latency H.264 settings: no B-frames, realtime, short GOP with on-demand keyframes, small VBV.
- Targets (to be measured, not promised): glass-to-glass < 60 ms on LAN, < 120 ms typical WAN; host CPU < 10% at 1440p30 idle-ish content; < 300 MB resident.
- Benchmark method: on-screen millisecond counter filmed alongside the client at 240 fps, plus WebRTC stats logs.
