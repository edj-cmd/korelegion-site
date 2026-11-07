import Foundation

// Port of core/perf.js. Keep behaviour identical; the test vectors in Tests mirror core/perf.test.js.
struct Tier: Equatable { let scale: Double; let fps: Int; let bitrate: Double }

enum Profile: String { case performance, balanced, quality, lowbandwidth
    var start: Int { self == .lowbandwidth ? 0 : 1 }
    var tiers: [Tier] {
        let M = 1_000_000.0
        switch self {
        case .performance: return [Tier(scale: 1, fps: 60, bitrate: 12*M), Tier(scale: 0.75, fps: 60, bitrate: 7*M), Tier(scale: 0.75, fps: 45, bitrate: 4*M), Tier(scale: 0.5, fps: 30, bitrate: 2*M), Tier(scale: 0.5, fps: 24, bitrate: 1*M)]
        case .balanced: return [Tier(scale: 1, fps: 60, bitrate: 14*M), Tier(scale: 1, fps: 45, bitrate: 9*M), Tier(scale: 0.75, fps: 30, bitrate: 5*M), Tier(scale: 0.5, fps: 30, bitrate: 2.5*M), Tier(scale: 0.5, fps: 20, bitrate: 1.2*M)]
        case .quality: return [Tier(scale: 1, fps: 60, bitrate: 25*M), Tier(scale: 1, fps: 30, bitrate: 15*M), Tier(scale: 1, fps: 24, bitrate: 8*M), Tier(scale: 0.75, fps: 24, bitrate: 4*M), Tier(scale: 0.5, fps: 15, bitrate: 1.5*M)]
        case .lowbandwidth: return [Tier(scale: 0.5, fps: 30, bitrate: 1.5*M), Tier(scale: 0.5, fps: 20, bitrate: 0.8*M), Tier(scale: 0.375, fps: 15, bitrate: 0.4*M)]
        }
    }
}

struct NetStats { var rttMs: Double; var lossPct: Double; var jitterMs: Double; var availBps: Double; var encodeMsAvg: Double? = nil; var fpsOut: Double? = nil }

struct PerfState {
    var profile: Profile; var tier: Int; var goodTicks = 0; var baseRtt = Double.infinity
    init(_ p: Profile) { profile = p; tier = p.start }
}

enum PerfPolicy {
    static let goodTicksToRecover = 8
    static let recoverHeadroom = 1.3

    static func step(_ state: PerfState, _ s: NetStats) -> (state: PerfState, target: Tier, changed: Bool, reason: String) {
        let tiers = state.profile.tiers
        var st = state
        if s.rttMs > 0 { st.baseRtt = min(st.baseRtt, s.rttMs) }
        let cur = tiers[st.tier]
        let rttBad = st.baseRtt.isFinite && s.rttMs > st.baseRtt * 2 + 40
        let bwBad = s.availBps > 0 && s.availBps < cur.bitrate * 0.8
        var encBad = false
        if let e = s.encodeMsAvg, s.fpsOut != nil { encBad = e > 1000.0 / Double(cur.fps) }
        if rttBad || s.lossPct > 2 || bwBad || s.jitterMs > 30 || encBad {
            st.goodTicks = 0
            var next = st.tier
            if next < tiers.count - 1 { next += 1 }
            while next < tiers.count - 1 && s.availBps > 0 && tiers[next].bitrate > s.availBps * 0.85 { next += 1 }
            let changed = next != state.tier; st.tier = next
            return (st, tiers[next], changed, changed ? "degrade" : "at-floor")
        }
        st.goodTicks = state.goodTicks + 1
        if st.tier > 0 && st.goodTicks >= goodTicksToRecover {
            let up = tiers[st.tier - 1]
            if s.availBps == 0 || s.availBps >= up.bitrate * recoverHeadroom {
                st.tier -= 1; st.goodTicks = 0
                return (st, up, true, "recover")
            }
        }
        return (st, cur, false, "hold")
    }
}
