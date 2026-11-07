# Tether protocol v1

Transport: WebSocket `wss://<host>.<tailnet>.ts.net/ws` (TLS terminated by `tailscale serve` → host on 127.0.0.1:8787) for signaling; then WebRTC (host is the offerer).
All signaling messages are JSON `{type, ...}`.

## Pairing (once per device)
1. Host app shows an 8-digit code (5 min, single use, 5 attempts) — `PairingSession`.
2. Client → `{type:"pair", code, name, pub}` (`pub` = base64 SPKI P-256).
3. Host → `{type:"paired", id}` or `{type:"error", reason}`. Client stores `id` and its non-extractable private key (IndexedDB).

## Connect (every session)
1. Client → `{type:"hello", id}`
2. Host → `{type:"challenge", challenge}` (32 random bytes, b64)
3. Client → `{type:"auth", sig}` = ECDSA-SHA256 over `tether/v1/connect/<challenge>`
4. Host → `{type:"ready"}` or `{type:"error", reason:"unauthorized"}`; then host sends `{type:"offer", sdp}`.
5. Client → `{type:"answer", sdp}`; both exchange `{type:"ice", candidate}`.
Reconnect = repeat from 1 (fresh challenge, new peer connection; ICE restart not relied upon on iOS).

## Data channels (created by host)
- `ptr`: unordered, `maxRetransmits: 0` — `mv` only.
- `ctl`: ordered reliable — `btn scr key txt clip` plus control JSON below.
Input messages are specified and validated in `core/input.js`; coordinates are normalised 0..1.

## Control messages on `ctl`
- Client → host `{t:"profile", name}` (performance|balanced|quality|lowbandwidth)
- Client → host `{t:"stats", rttMs, lossPct, jitterMs, availBps?}` ~1 Hz (host may also use its own sender stats; whichever is available)
- Host → client `{t:"tier", scale, fps, bitrate, reason}` informational, for the status UI
- Host → client `{t:"clip", s}` clipboard push

## Not yet specified (later phases)
File transfer, multi-display selection, terminal.
