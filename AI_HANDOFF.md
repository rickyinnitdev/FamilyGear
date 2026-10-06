# Family Gear — project handoff

## Owner and purpose

Repository: https://github.com/rickyinnitdev/FamilyGear

Family Gear is a device configurator for the owner and their friends. It has a Vite/TypeScript web frontend and an Electron Windows app. Communicate calmly and plainly. The owner wants working features, accurate device readback, easy updates and a friendly UI. Avoid legal guarantees and repeated alarmist disclaimers.

## Run and verify

Use Windows PowerShell and Node.js 22.12+. Run `npm ci`, `npm test`, and `npm run build`. Run `npm run dev` for localhost:5173 or `npm run desktop` for Electron. Tests currently total 36. Hardware writes are experimental; mocked tests do not prove every physical device works.

## Main code

- `src/main.ts`: app state, device connection, settings panels, home, live keyboard/mouse previews, theme switching and UI handlers.
- `src/devices/`: mouse adapters, VXE support, Ace base/Pro codecs, lighting, triggers, advanced bindings, live travel/calibration and charging estimates.
- `src/style.css` and `src/studio-theme.css`: dark and cream light themes.
- `src/suggestions.ts` / `.css`: local draft, preview, copy message, prefilled GitHub Issue submission and review link. No automatic submission or account token.
- `desktop/main.cjs`: secure local protocol, sandboxed renderer, HID chooser, IPC, device cleanup and update lifecycle.
- `desktop/preload.cjs` and `src/desktop.d.ts`: narrow desktop bridge.
- `desktop/updates.cjs`: HTTPS generic update feed, automatic downloads and explicit Restart to update.
- `desktop/community.cjs`: validates the configured GitHub owner/repository.

## Features to preserve

Welcome home, Add device cards using supplied artwork, hover effects, dark/cream mode, RGB keyboard simulation and effect tiles, selectable keyboard layout, mouse input preview, Cancel for advanced bindings, and explicit Apply actions. Never download backups automatically on every change.

Read current hardware settings rather than supplying defaults. Ace Pro Quick Trigger (mode 1) and continuous Rapid Trigger (mode 2) are distinct; preserve the loaded mode. Pro brightness is 0–100, not 0–4. Analog travel must come from measured reports, not fabricated animations. Restore debug/calibration state when ending sessions. Preserve unrelated keys, layers, shared banks and unknown bytes; reject stale state and require device readback after writes.

Supported hardware includes known VXE R1 transports, experimental Ace 60 / Ace 60 Pro firmware 1.18, and model-specific ATTACK SHARK GearHub/CompX adapters. X11 needs an unimplemented native bridge. AULA support awaits an exact model/protocol; do not advertise universal support. See tests and README for details.

## Windows packaging

Current version: 0.2.1. Run `npm run build:installer` on Windows. Packaging explicitly prepares Electron + app.asar, then uses electron-builder's `--prepackaged` NSIS flow; ordinary builder packaging previously failed with Windows EPERM rename errors. Preserve this workaround.

Output: `release/windows-0.2.1/win-unpacked/Family Gear.exe` and `release/updates/FamilyGear-Setup-0.2.1.exe`. `scripts/share.ps1` includes corresponding source and notices. `scripts/update-manifest.cjs` creates latest.yml with SHA-512 and the versioned source ZIP. Output, dependencies and research checkouts are gitignored.

When bumping versions, update package.json, lockfile and visible UI version. Packaging paths currently hardcode windows-0.2.1 in package.json, package-windows.cjs, share.ps1 and update-manifest.cjs; update these together or refactor to derive version safely. Never overwrite or kill a running user app just to rebuild; use a fresh output folder.

## Updates and suggestions: next steps

The initial repository has now been supplied, but no GitHub Release has been published by this task. The already-built 0.2.1 installer has NO configured update address or suggestion repository. Merely pushing source does not connect that installer.

For public Releases, build with `$env:FAMILY_GEAR_GITHUB_REPO = 'rickyinnitdev/FamilyGear'`. This derives `https://github.com/rickyinnitdev/FamilyGear/releases/latest/download/` and configures suggestions. FAMILY_GEAR_UPDATE_URL can override the feed. Upload installer, blockmap, matching source ZIP and latest.yml to a stable Latest release. See FREE-UPDATES.md.

If the repository is private, the current anonymous generic updater cannot download its assets. Browser GitHub login does not authenticate Electron updates. Discuss an authenticated design or a separate public releases repository; never embed the owner's personal access token in distributed apps. Friends with repository access can manually download private Releases and submit Issues while logged in.

Suggestions are previewed, then opened as a GitHub Issue form for the friend to submit. Review opens the GitHub inbox, where the owner comments/labels/closes. Copy message works without a repository; it does not deliver anything to an online inbox. No in-app authenticated review dashboard exists yet.

## Source, assets and boundaries

OpenMouse protocol is pinned to a specific Git commit in package.json/lockfile. Keep LICENSE and THIRD_PARTY_NOTICES.md and share matching editable source/build scripts with binaries. Product photographs were supplied by the owner; their separate permissions are unverified. Generic mouse SVG is original. Do not claim code licensing automatically covers photography.

Do not publish releases, change visibility, enable paid services, send messages to friends, or write physical device settings unless requested. A source push was authorized; subsequent destructive changes are not implied. Do not commit secrets, node_modules, dist, release binaries or work research checkouts.
