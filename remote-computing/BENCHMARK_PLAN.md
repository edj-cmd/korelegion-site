# Head-to-head benchmark plan: Tether vs Jump Desktop vs Astropad Workbench

Goal: decide with numbers whether Tether is better. Nothing below has been run yet. Vendor claims are not evidence; only these measurements count.

## Setup (identical for all three)
- Same Mac mini, same monitor/resolution, same Tailscale network, same client devices (MacBook, iPhone).
- Install Jump Desktop (one-time purchase) and Workbench (free 20 min/day is enough per run; split runs across days). Tether = latest build from this repo.
- Close other heavy apps. Record macOS version, resolutions, and app versions.
- Networks to test: (1) home Wi-Fi LAN, (2) iPhone on cellular, (3) a throttled link (macOS Network Link Conditioner on the client: 3 Mbps / 80 ms / 2% loss), (4) a mid-session Wi-Fi drop.

## Tests (repeat 3 times per product per network; record the median)
| # | Test | How to measure |
|---|---|---|
| 1 | **Click-to-pixel latency** | Open a millisecond stopwatch on the Mac mini screen. Film the client screen and the mini's monitor together at 240 fps (iPhone slo-mo). Latency = difference between the two timer readings. Also type a key and film the response |
| 2 | **Smoothness** | Scroll a long web page and drag a window for 30 s. Film at 240 fps; count visibly repeated/dropped frames per second. Note blur/blockiness |
| 3 | **Text sharpness** | Screenshot the client showing small text and a code editor; compare side by side. Rate legibility 1-5 |
| 4 | **Bandwidth used** | Tailscale/macOS network stats for a 60 s fixed task; report Mbit/s |
| 5 | **Degradation behavior** | In the throttled network, does the picture stay responsive (low latency, lower quality) or freeze/stutter? Time to recover after throttling is removed |
| 6 | **Recovery** | Turn Wi-Fi off 10 s, then on. Time until the screen is interactive again, without manual action |
| 7 | **iPhone usability** | Tap accuracy, drag, scroll, typing a sentence, switching apps and returning after 30 s in background. Subjective 1-5 each, plus time to resume |
| 8 | **Host cost** | Activity Monitor on the mini: CPU % and memory of the host app during test 2 |
| 9 | **Time to connect** | Cold start (tap icon) to usable picture |
| 10 | **Cowork coexistence** | Run a Cowork task on the mini while connected; try the "I'm driving" takeover once Tether has it |

## Scoring
Record a table per network. Tether "wins" a row if it is better than both by a clear margin (latency: >15 ms or >20%; subjective scores: at least 1 point). Overall verdict rules:
- Tether wins on latency, recovery and iPhone usability on cellular -> keep building.
- Tether is within margin of Jump but not better -> keep only if you value no-vendor, no-install, or Cowork-aware controls.
- Tether loses clearly on latency or smoothness -> buy Jump Desktop, keep Tether's agent-supervision ideas only.

## Results (fill in)
| Test | Network | Jump | Workbench | Tether | Notes |
|---|---|---|---|---|---|
