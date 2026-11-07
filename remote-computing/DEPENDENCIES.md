# Dependency & License Inventory

Rule: no GPL/AGPL code linked into or copied into the product. Licenses below marked [verified] were read from the project README this session; others are [knowledge] and **must be re-verified from the LICENSE file at the pinned version before adoption**.

| Component | Role | License | Status |
|---|---|---|---|
| Tailscale client | Network / NAT traversal | BSD-3-Clause (client) [knowledge]; service is a commercial SaaS (ToS applies) | Planned (used as external app, not linked) |
| Google libwebrtc (prebuilt Swift pkg) | WebRTC stack on host | BSD-3-Clause + patent grant [knowledge]; the SPM wrapper's license unverified | Planned, spike pending |
| str0m | Alt. Rust WebRTC | MIT/Apache-2.0 [knowledge] | Fallback candidate |
| Apple ScreenCaptureKit / VideoToolbox / CGEvent | Capture/encode/input | Apple SDK (system frameworks) | Planned |
| coturn | Optional TURN fallback | BSD-3-Clause [knowledge] | Later |
| WireGuard | Underlies Tailscale | GPLv2 kernel; userspace impls MIT/Apache [knowledge] | Not directly used |
| MeshCentral | Reference only | Apache-2.0 [verified] | Not used |
| Apache Guacamole | Reference only | Apache-2.0 [verified] | Not used |
| RustDesk | Reference only | **AGPL-3.0 [verified]** | **Do not copy code** |
| TypeScript toolchain (esbuild) | Build web client | MIT [knowledge] | Planned |

Web client: zero runtime dependencies planned.
