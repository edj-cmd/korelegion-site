# Existing products: Astropad Workbench and Jump Desktop

Evidence: almost all of this is **vendor marketing** (Astropad's own comparison page) plus a MacRumors forum thread. No protocol specs or independent benchmarks were found. Treat latency and quality claims as unverified; prices may have changed.
Sources: [Astropad: Workbench vs Jump Desktop](https://astropad.com/blog/workbench-vs-jump-desktop/) · [MacRumors thread on Workbench](https://forums.macrumors.com/threads/astropad-workbench-lets-you-remotely-control-your-mac-and-ai-agents-from-iphone-and-ipad.2480651/) · [Jump Desktop App Store listing](https://apps.apple.com/us/app/jump-desktop-rdp-vnc-fluid/id364876095)

| | Astropad Workbench | Jump Desktop |
|---|---|---|
| Protocol | "LIQUID", proprietary, claims perceptually lossless Retina streaming | "Fluid" (2.0), proprietary; listing says DTLS-secured, adaptive; claims 60 fps at ~1/10 the bandwidth of traditional protocols. Also RDP and VNC |
| Connection | Account + vendor infrastructure; one forum user calls it "a polished VNC + Tailscale subscription" (opinion, unverified) | Separate Mac "connector" and viewer apps; automatic setup without router config; SSH tunnel option |
| Clients | Mac, iPhone, iPad only | Mac, Windows, iOS/iPadOS, Android |
| Headless Mac mini | "Unified Display": virtual screen matching the client's resolution, no dummy plug (claimed) | Supported; multiple displays cycled one at a time |
| AI-workstation features | Built-in terminal with sessions that persist after disconnect; voice dictation | None; use a separate SSH app |
| Price (vendor-stated) | Free 20 min/day; $14.99/mo or $79.99/yr | Mac one-time $34.99; Teams plans $7.99–15.99/mo |
| Criticism | Subscription for connecting your own machines; some see it as just a remote view | Two-app setup; pen support limited to top tier |
| Latency numbers | None published | None published |

## What this changes
1. **Buy-vs-build is a real question.** Both products already target "Mac mini from iPhone". Jump's one-time price is far below the time this project will cost. Building Tether is justified by control, privacy (no vendor in the path), a PWA with no app install, a custom performance engine, and the learning, not by the existence of a gap. **Recommendation: on day one, trial Jump Desktop and Workbench's free tier over Tailscale/cellular and record their latency and feel as the bar Tether must beat.** If one already satisfies you, we can narrow Tether to the AI-workstation layer.
2. **Ideas worth taking:**
   - *Virtual display matching the client's resolution* — solves the headless/dummy-plug problem and makes the iPhone view sharp. macOS has no public API for creating virtual displays (a private `CGVirtualDisplay` is used by tools; fragile across OS updates) [knowledge]. Added to the roadmap as an investigation, with the dummy plug as the safe fallback.
   - *Persistent terminal sessions* — implement with `tmux` on the host plus a web terminal channel (Phase 6), rather than reinventing session persistence.
   - *Fewer moving parts than Jump's two-app model* — keep Tether to one host app + one web client.
3. **What we won't copy:** proprietary codecs. Using H.264 over WebRTC keeps hardware decode in every browser at some cost in efficiency versus a tuned custom codec.
