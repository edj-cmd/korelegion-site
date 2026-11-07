// swift-tools-version:5.9
// UNTESTED: written on Linux without a Swift toolchain. First task on the Mac: `swift build`, fix compile errors.
import PackageDescription
let package = Package(
    name: "TetherHost",
    platforms: [.macOS(.v13)],
    dependencies: [
        // libwebrtc prebuilt (BSD-3). VERIFY the package URL, version and license on the Mac before relying on it (see DEPENDENCIES.md).
        .package(url: "https://github.com/stasel/WebRTC.git", from: "125.0.0"),
    ],
    targets: [
        .executableTarget(name: "TetherHost", dependencies: [.product(name: "WebRTC", package: "WebRTC")], path: "Sources/TetherHost"),
        .testTarget(name: "TetherHostTests", dependencies: ["TetherHost"], path: "Tests/TetherHostTests"),
    ]
)
