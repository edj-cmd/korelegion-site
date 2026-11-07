import XCTest
@testable import TetherHost

// Mirrors core/perf.test.js
final class PerfTests: XCTestCase {
    let good = NetStats(rttMs: 20, lossPct: 0, jitterMs: 3, availBps: 50e6)
    func testDegradesOnLoss() {
        var s = PerfState(.balanced); s.tier = 0
        var bad = good; bad.lossPct = 5
        XCTAssertEqual(PerfPolicy.step(s, bad).reason, "degrade")
    }
    func testRecoversOnlyAfterSustainedGoodTicks() {
        var s = PerfState(.balanced); s.tier = 2
        for _ in 0..<(PerfPolicy.goodTicksToRecover - 1) { let r = PerfPolicy.step(s, good); XCTAssertFalse(r.changed); s = r.state }
        let r = PerfPolicy.step(s, good); XCTAssertEqual(r.reason, "recover"); XCTAssertEqual(r.state.tier, 1)
    }
    func testNoRecoveryWithoutHeadroom() {
        var s = PerfState(.balanced); s.tier = 2
        var tight = good; tight.availBps = Profile.balanced.tiers[1].bitrate * 1.05
        for _ in 0..<20 { s = PerfPolicy.step(s, tight).state }
        XCTAssertEqual(s.tier, 2)
    }
}
final class AuthTests: XCTestCase {
    func testPairingSingleUseAndLockout() {
        let p = PairingSession(); XCTAssertEqual(p.redeem(p.code), "ok"); XCTAssertEqual(p.redeem(p.code), "used")
        let q = PairingSession(); let wrong = q.code == "00000000" ? "11111111" : "00000000"
        for _ in 0..<5 { XCTAssertEqual(q.redeem(wrong), "bad-code") }
        XCTAssertEqual(q.redeem(q.code), "locked")
    }
}
