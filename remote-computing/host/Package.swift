// swift-tools-version:5.9
// UNTESTED: written on Linux without a Swift toolchain. First task on the Mac: `swift build`, fix compile errors.
import PackageDescription
let package = Package(
    name: "TetherHost",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "TetherHost", path: "Sources/TetherHost"),
        .testTarget(name: "TetherHostTests", dependencies: ["TetherHost"], path: "Tests/TetherHostTests"),
    ]
)
