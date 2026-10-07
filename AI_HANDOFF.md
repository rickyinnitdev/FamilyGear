# Family Gear — project handoff

## Owner and purpose

Repository: https://github.com/rickyinnitdev/FamilyGear

Family Gear is a device configurator for the owner and their friends. It has a Vite/TypeScript web frontend and an Electron Windows app. Communicate calmly and plainly. The owner wants working features, accurate device readback, easy updates and a friendly UI. Avoid legal guarantees and repeated alarmist disclaimers.

## Run and verify

Use Windows PowerShell and Node.js 22.12+. Run `npm ci`, `npm test`, and `npm run build`. Run `npm run dev` for localhost:5173 or `npm run desktop` for Electron. Tests currently total 52. Hardware writes are experimental; mocked tests do not prove every physical device works.

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

Supported hardware includes known VXE R1 transports, experimental Ace 60 / Ace 60 Pro firmware 1.18, and model-specific ATTACK SHARK GearHub/CompX adapters. X11 needs an unimplemented native bridge. AULA SC620 has a separate experimental independently authored adapter. Other AULA models are unsupported; do not advertise universal support. See tests and README for details.

## Windows packaging

Current version: 0.2.8. Run `npm run build:installer` on Windows. Packaging explicitly prepares Electron + app.asar, then uses electron-builder's `--prepackaged` NSIS flow; ordinary builder packaging previously failed with Windows EPERM rename errors. Preserve this workaround.

Output: `release/windows-0.2.8/win-unpacked/Family Gear.exe` and `release/updates/FamilyGear-Setup-0.2.8.exe`. `scripts/share.ps1` includes corresponding source and notices. `scripts/update-manifest.cjs` creates latest.yml with SHA-512 and the versioned source ZIP. Output, dependencies and research checkouts are gitignored.

When bumping versions, update package.json, lockfile and visible UI version. Packaging paths derive the version automatically. Never overwrite or kill a running user app just to rebuild; use a fresh output folder.

## Updates and suggestions: next steps

Development stays in the owner's private repository. Public downloads and suggestions use https://github.com/rickyinnitdev/FamilyGear-Downloads. Version 0.2.2 is the first installer configured for that public repository. Older 0.2.0/0.2.1 builds have no feed; users must install the configured version once.

The default download repository lives in desktop/distribution.cjs. FAMILY_GEAR_GITHUB_REPO and FAMILY_GEAR_UPDATE_URL can override it at build time. The feed is https://github.com/rickyinnitdev/FamilyGear-Downloads/releases/latest/download/.

Run npm run build:installer to prepare files, then npm run release:github only when explicitly authorized to publish a release. It reads Git Credential Manager only on the owner's build machine, creates a draft, uploads installer/blockmap/source/latest.yml, then publishes as Latest. Never put credentials into app resources. The public repository must remain public for unauthenticated downloads. See FREE-UPDATES.md.

Suggestions are previewed, then opened as a GitHub Issue form for the friend to submit. Review opens the GitHub inbox, where the owner comments/labels/closes. Copy message works without a repository; it does not deliver anything to an online inbox. No in-app authenticated review dashboard exists yet.

## Source, assets and boundaries

OpenMouse protocol is pinned to a specific Git commit in package.json/lockfile. Keep LICENSE and THIRD_PARTY_NOTICES.md and share matching editable source/build scripts with binaries. Product photographs were supplied by the owner; their separate permissions are unverified. Generic mouse SVG is original. Do not claim code licensing automatically covers photography.

Do not publish releases, change visibility, enable paid services, send messages to friends, or write physical device settings unless requested. A source push was authorized; subsequent destructive changes are not implied. Do not commit secrets, node_modules, dist, release binaries or work research checkouts.

## Version 0.2.3 additions

Simple MK icon: public/favicon.svg, build/icon.ico/icon.png, reproducible scripts/make-icon.ps1. scripts/embed-icon.cjs uses resedit to embed all icon sizes and Family Gear metadata into the prepackaged executable. Builder installer/uninstaller icons are also configured.

Scan devices in the Windows sidebar uses desktop/scanner.cjs through narrow IPC. It invokes read-only Get-PnpDevice -PresentOnly, adds USB bus-reported names, and filters hubs/storage/cameras without HID counterparts. Only names, class, VID and PID are returned. No paths, serials or account identifiers leave the scanner. Unsupported USB HID families are included; Bluetooth-only devices are not. Scan and reports never change hardware or enable unsupported controls.

Friends choose rows, supply the actual model name/feature requests and preview. They can copy/save the report or open a public GitHub Issue form prefixed [Device report]. Submitting GitHub reports requires the friend's own login; group chat copying does not. No automatic report delivery or anonymous server inbox exists. User was offered a choice of GitHub reports versus a separate no-login service; default is the existing GitHub inbox with copy fallback unless they request another destination.

## Version 0.2.4 scanner grouping

Scanner now includes only present/OK USB Mouse or Keyboard device families, groups interfaces with Windows ContainerId internally, and prefers the USB bus-reported product name. Container IDs never enter the renderer or reports. Two identical physical devices remain separate when Container IDs are available; missing IDs fall back to VID/PID grouping. HID-only audio/radio/vendor entries and hubs are excluded. This identifies connected working devices; it does not track which mouse is currently moving or keyboard is being typed on.

## Version 0.2.5 SC620 support

Official SC620 driver archive inspected statically; vendor executable was not run or bundled. Read SC620-RESEARCH.md for IDs, packet offsets and unresolved capabilities. src/devices/sc620.ts uses the SC620-specific 0x2E config length and 0x2C eleven-slot key map; preserve all unknown fields. Shared OEM IDs require a matching SC620 product name or explicit Add AULA SC620 selection. Only profile 1 is implemented; active-profile identity is unknown. Battery-only periodic reads never replace the displayed config snapshot. Every edit requires user opt-in, stale-state rejection and full readback. Left click remains locked. Physical SC620 verification is outstanding. No release publication is implied by a build.

## Version 0.2.6 mouse fixes and reporting

R1 3554:F58E/F58F identified specifically as VXE R1: polling selector 0B at 0070 requires valid checksum and actual readback after a settling delay. pollingReadVerified=false means unknown; UI must never display the upstream 1000 Hz fallback. DPI editing is available after complete checksum-valid system and stage reads, stale-state comparison and full readback. Stage switching/count are unavailable on this receiver; use physical DPI button. These paths need physical validation; strict reads may remain unavailable on firmware that responds with write-command IDs.

Check delay & optimize reads Windows pointer settings through bounded read-only IPC; it previews supported mouse polling (at most1000 Hz), debounce (2–4 ms) and motion-sync changes, with restore. It does not promise zero latency, measure end-to-end latency, automatically modify Windows or identify the cause of a game lag.

SC620 local reporting uses explicit v1 agreement, a settings whitelist and at most100 entries in localStorage. Baseline/connection/Apply outcomes are recorded only after consent; physical results are not inferred from readback. Reports are reviewed then copied or opened in a public GitHub issue form. Owner selected local copy/send, not an automatic online endpoint. No account tokens or automatic uploads. Delete stops recording and removes local results.

Owner explicitly requested publishing this update to automatic updates. Use matching source archive and all four release assets.

## Version 0.2.7 verified CompX correction

The previous 0070 polling selector was incorrect for the owner's 3554:F58E R1. Actual hardware reads show system row 0000 [01 54 04 51 00 55]; 0070 contains unrelated [01 10 00 44]. Use only the first system scalar pair for CompX polling, preserving stage count/index. This differs from the 373B Beken live selector. Reads accept checksum-valid read or write IDs with bounded payloads, and retry reads only. Hardware test of the updated adapter AND the built app's full Apply form confirmed 800 DPI/500 Hz, then restored 1600 DPI/1000 Hz. Mock tests cover row preservation, firmware reply variants, stale stage state, and ignored writes. Do not generalize these physical results to other mice.

Mouse performance selections survive rendering and failed Apply. The inline result appears beside Apply, and Cancel changes restores displayed device values. Disconnect, new device and preview changes clear drafts.

## Version 0.2.8 CompX debounce

CompX VXE R1 debounce also incorrectly inherited the Beken 0070 live selector. It now writes only the debounce scalar pair at 00A9, after comparing the entire ten-byte advanced row against the displayed snapshot, then requires full-row readback with unknown bytes preserved. Full status reads validate the pair; unavailable reads disable debounce. Built-app hardware Apply test on the connected 3554:F58E confirmed 4 ms to 2 ms, then restored 4 ms. Regression tests reject stale advanced rows and ignored writes. All 52 tests passed. This does not verify every R1 setting or other models.
# Version 0.2.9 native X11 and SC620 artwork

Owner supplied `public/images/aula-sc620.png`, now used for the SC620 card and mouse preview. ATTACK SHARK X11 has an explicit native Add device action on Windows. VID 1D57 FA55/FA60 configuration interface 2, usage pages 0B/0A are paired by physical HID path inside the worker. A model-55 event is required before reading. Paths and serials never reach the renderer. No X11 was attached to the development PC; physical verification remains outstanding.

`desktop/x11-engine.cjs` uses async node-hid in a worker; the IPC bridge exposes whitelisted high-level operations, not arbitrary reports or HID paths. Reads use the A0 permission handshake and validate headers/profile/checksums. Writes compare current rows against displayed snapshots, preserve unrelated bytes, and require complete readback. Failed writes invalidate snapshots. Battery-only telemetry never refreshes settings snapshots. `src/devices/x11.ts` adapts to existing panels, overriding every exposed setter so no ATK packets are sent to this model. Supports DPI/stage/color/active stage, 125–1000 Hz polling, 4–50 ms debounce, sensor flags, LOD, sleep, lighting/deep sleep, basic/media button assignments and reported profiles. Left click is locked. Stage count and macros are deliberately unavailable pending further protocol verification; dock RGB uses its physical button. Not full feature parity with every vendor configurator.

MIT DPI source/provenance is in `desktop/vendor/x11`. node-hid and pkg-prebuilds are copied into staging and native `.node` files are ASAR-unpacked. Keep these dependencies and their licenses in installer packaging and corresponding source instructions. npm install reconstructs them. Regression tests include stale/ignored writes, unknown-byte preservation, model rejection and telemetry separation.
