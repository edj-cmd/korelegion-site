#!/usr/bin/env bash
# Tether: Mac mini setup helper. UNTESTED (written without a Mac) — read before running; each step asks first.
# Usage:  tools/setup-mac.sh doctor   # read-only report, changes nothing
#         tools/setup-mac.sh apply    # applies power settings, enables Screen Sharing, installs Tailscale
set -u
say() { printf '\n== %s\n' "$*"; }
ask() { read -r -p "$1 [y/N] " a; [[ "$a" == [yY]* ]]; }
[[ "$(uname)" == "Darwin" ]] || { echo "Run this on the Mac mini."; exit 1; }

doctor() {
  say "FileVault (want: Off, so the Mac boots fully after a power cut)"; fdesetup status
  say "Power (want: sleep 0, womp 1, autorestart 1)"; pmset -g | grep -Ei '^ *(sleep|displaysleep|disksleep|womp|autorestart|powernap) ' || pmset -g
  say "Automatic login (want: a user name)"; defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null || echo "not set (do it in System Settings → Users & Groups)"
  say "Screen Sharing (want: enabled)"; sudo launchctl print-disabled system 2>/dev/null | grep -i screensharing || echo "unknown"
  say "Tailscale (want: installed and connected)"
  if command -v tailscale >/dev/null; then tailscale status | head -5; elif [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then /Applications/Tailscale.app/Contents/MacOS/Tailscale status | head -5; else echo "not installed"; fi
  say "Display (headless Mac minis may need an HDMI dummy plug)"; system_profiler SPDisplaysDataType | grep -E 'Resolution|Display Type|Online' || echo "no display reported"
  say "Developer tools (want: Xcode/Swift)"; (swift --version 2>&1 | head -1) || echo "swift missing: install Xcode from the App Store"
}

apply() {
  say "Power settings: never sleep, wake for network, restart after power failure"
  if ask "Apply?"; then sudo pmset -a sleep 0 disksleep 0 womp 1 autorestart 1 powernap 0 && sudo pmset -a displaysleep 10; fi
  say "Screen Sharing (built-in fallback while Tether is built)"
  if ask "Enable?"; then sudo launchctl enable system/com.apple.screensharing; sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null; fi
  say "Tailscale"
  if ! [[ -d /Applications/Tailscale.app ]] && ask "Install Tailscale with Homebrew (needs brew)?"; then brew install --cask tailscale; fi
  say "Manual steps this script will NOT do (they need your password / the GUI):"
  cat <<'M'
  1. FileVault Off:   System Settings → Privacy & Security → FileVault → Turn Off
  2. Auto-login:      System Settings → Users & Groups → Automatically log in as (needs FileVault off first)
  3. Open Tailscale, sign in with the same account as your MacBook and iPhone
  4. Grant Screen Recording + Accessibility to TetherHost when macOS asks (first run)
M
}
case "${1:-doctor}" in doctor) doctor;; apply) apply; echo; doctor;; *) echo "usage: $0 doctor|apply"; exit 2;; esac
