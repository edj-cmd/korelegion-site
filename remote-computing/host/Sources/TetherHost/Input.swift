import Foundation
import CoreGraphics

// Injects validated input messages (see core/input.js) as CGEvents. Needs Accessibility permission.
final class InputInjector {
    private var displayBounds: CGRect { CGDisplayBounds(CGMainDisplayID()) }
    private var leftDown = false

    private func point(_ x: Double, _ y: Double) -> CGPoint {
        let b = displayBounds; return CGPoint(x: b.minX + min(1, max(0, x)) * b.width, y: b.minY + min(1, max(0, y)) * b.height)
    }

    func handle(_ m: [String: Any]) {
        guard let t = m["t"] as? String else { return }
        switch t {
        case "mv":
            guard let x = m["x"] as? Double, let y = m["y"] as? Double else { return }
            let type: CGEventType = leftDown ? .leftMouseDragged : .mouseMoved
            CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point(x, y), mouseButton: .left)?.post(tap: .cghidEventTap)
        case "btn":
            guard let b = m["b"] as? String, let d = m["d"] as? Bool, let x = m["x"] as? Double, let y = m["y"] as? Double else { return }
            let (down, up, btn): (CGEventType, CGEventType, CGMouseButton) = b == "right" ? (.rightMouseDown, .rightMouseUp, .right) : b == "middle" ? (.otherMouseDown, .otherMouseUp, .center) : (.leftMouseDown, .leftMouseUp, .left)
            if b == "left" { leftDown = d }
            CGEvent(mouseEventSource: nil, mouseType: d ? down : up, mouseCursorPosition: point(x, y), mouseButton: btn)?.post(tap: .cghidEventTap)
        case "scr":
            guard let dx = m["dx"] as? Double, let dy = m["dy"] as? Double else { return }
            CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: Int32(-dy), wheel2: Int32(-dx), wheel3: 0)?.post(tap: .cghidEventTap)
        case "key":
            guard let c = m["c"] as? String, let d = m["d"] as? Bool, let code = KeyMap.virtualKey(for: c) else { return }
            let ev = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: d)
            var flags: CGEventFlags = []
            for mod in (m["m"] as? [String]) ?? [] { switch mod { case "shift": flags.insert(.maskShift); case "ctrl": flags.insert(.maskControl); case "alt": flags.insert(.maskAlternate); case "meta": flags.insert(.maskCommand); default: break } }
            ev?.flags = flags; ev?.post(tap: .cghidEventTap)
        case "txt":
            guard let s = m["s"] as? String else { return }
            let u = Array(s.utf16)
            for down in [true, false] { let ev = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: down); ev?.keyboardSetUnicodeString(stringLength: u.count, unicodeString: u); ev?.post(tap: .cghidEventTap) }
        default: break
        }
    }
}

/// DOM `KeyboardEvent.code` -> macOS virtual key code (ANSI layout; subset, extend as needed).
enum KeyMap {
    static let table: [String: CGKeyCode] = [
        "KeyA": 0, "KeyS": 1, "KeyD": 2, "KeyF": 3, "KeyH": 4, "KeyG": 5, "KeyZ": 6, "KeyX": 7, "KeyC": 8, "KeyV": 9, "KeyB": 11, "KeyQ": 12, "KeyW": 13, "KeyE": 14, "KeyR": 15,
        "KeyY": 16, "KeyT": 17, "Digit1": 18, "Digit2": 19, "Digit3": 20, "Digit4": 21, "Digit6": 22, "Digit5": 23, "Equal": 24, "Digit9": 25, "Digit7": 26, "Minus": 27, "Digit8": 28,
        "Digit0": 29, "BracketRight": 30, "KeyO": 31, "KeyU": 32, "BracketLeft": 33, "KeyI": 34, "KeyP": 35, "Enter": 36, "KeyL": 37, "KeyJ": 38, "Quote": 39, "KeyK": 40, "Semicolon": 41,
        "Backslash": 42, "Comma": 43, "Slash": 44, "KeyN": 45, "KeyM": 46, "Period": 47, "Tab": 48, "Space": 49, "Backquote": 50, "Backspace": 51, "Escape": 53,
        "ArrowLeft": 123, "ArrowRight": 124, "ArrowDown": 125, "ArrowUp": 126, "Delete": 117, "Home": 115, "End": 119, "PageUp": 116, "PageDown": 121,
        "F1": 122, "F2": 120, "F3": 99, "F4": 118, "F5": 96, "F6": 97, "F7": 98, "F8": 100, "F9": 101, "F10": 109, "F11": 103, "F12": 111,
    ]
    static func virtualKey(for code: String) -> CGKeyCode? { table[code] }
}
