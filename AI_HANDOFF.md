# Family Gear — project handoff

## Owner and purpose

Repository: https://github.com/rickyinnitdev/FamilyGear

Family Gear is a device configurator for the owner and their friends. It has a Vite/TypeScript web frontend and an Electron Windows app. Communicate calmly and plainly. The owner wants working features, accurate device readback, easy updates and a friendly UI. Avoid legal guarantees and repeated alarmist disclaimers.

## Run and verify

Use Windows PowerShell and Node.js 22.12+. Run `npm ci`, `npm test`, and `npm run build`. Run `npm run dev` for localhost:5173 or `npm run desktop` for Electron. Tests currently total 90. Hardware writes are experimental; mocked tests do not prove every physical device works.

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

Supported hardware includes known VXE R1 transports, experimental Ace 60 / Ace 60 Pro firmware 1.18, and model-specific ATTACK SHARK GearHub/CompX adapters. X11 has an experimental Windows native bridge. AULA SC620 has a separate experimental independently authored adapter. Other AULA models are unsupported; do not advertise universal support. See tests and README for details.

## Windows packaging

Current version: 0.2.16. Run `npm run build:installer` on Windows. Packaging explicitly prepares Electron + app.asar, then uses electron-builder's `--prepackaged` NSIS flow; ordinary builder packaging previously failed with Windows EPERM rename errors. Preserve this workaround.

Output: `release/windows-0.2.12/win-unpacked/Family Gear.exe` and `release/updates/FamilyGear-Setup-0.2.12.exe`. `scripts/share.ps1` includes corresponding source and notices. `scripts/update-manifest.cjs` creates latest.yml with SHA-512 and the versioned source ZIP. Output, dependencies and research checkouts are gitignored.

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

## Version 0.2.10 Windows X11 receiver pairing

A friend using the X11 2.4 GHz receiver reported “X11 event interface unavailable.” The original matcher removed `&colXX` only, which does not account for collection-specific Windows PnP instance suffixes. Native pairing now reads `DEVPKEY_Device_ContainerId` using bounded, hidden, read-only PowerShell, maps exact PnP instances internally, and requires a unique event collection in the command collection’s physical container. It never falls back to VID/PID alone. Missing event interface numbers are accepted only with a verified physical group or exact collection-normalized path. Ambiguous groups fail closed. Paths, serials and container identifiers remain private in the worker. Hardware model checks and settings readback remain mandatory.

Add device → X11 connection details opens a reviewed local report listing only VID/PID/interface/usage page/usage; Copy does not automatically send it. Preload removes the Electron remote-method prefix from X11 errors. Seven new tests cover Windows suffix differences, identical receivers, missing interface numbers, ambiguity, diagnostics privacy and bounded Windows metadata reads. No physical X11 is available here; this fixes a pairing limitation but does not prove the friend’s receiver now connects.

## X68HE initial support
3151:502D configuration collection FFFF:0002; independent feature-report adapter in src/devices/x68.ts and separate dialog in src/x68-panel.ts. RGB/polling with stale checks and actual GET readback. Optional HE pages read-only; physical slot mapping, HE writes, calibration, analog stream and advanced bindings remain unverified and unavailable. See X68-RESEARCH.md. No physical X68HE available locally. Research checkout unlicensed; do not copy its implementation.

## Version 0.2.12 X68HE polling correction and preview
Official qmk.top current bundle corroborates HE polling GET83/SET03 and profile GET84/SET04. The earlier community-derived SET04 path was wrong for this protocol and could switch profile. It is removed: legacy-read fallback cannot write polling. SET commands are send-only then settings GET verifies both polling and unchanged profile; no SET ACK assumptions. X68 UI has a wide keyboard RGB illustration, effects tiles, digital input feedback, Load current settings and Cancel changes. Physical HE mapping/writes are still not enabled. X11 event collections on other interface numbers are allowed only when the OS confirms the same physical container; model-55 check still required. Failed native connects automatically open reviewed connection details for the friend to copy. Friend report is still needed to diagnose a receiver whose event collection is actually absent.

## Version 0.2.13 automatic reports
Owner deployed the Google Forms inbox in public/report-inbox.json. An anonymous synthetic report (USB IDs 0:0, not-tested) was acknowledged by the real endpoint. GOOGLE-REPORTS.md and scripts/google-report-inbox.gs document owner deployment. src/device-smoke.ts asks explicit one-time upload consent, queues at most eight local reports, retries with backoff, and performs only repeat reads after connections. desktop/reporting.cjs validates metadata and the Google-only redirect/acknowledgment. No serials, paths, raw packets, typed keys or account credentials are uploaded. Device reports allows disabling and clearing the queue. Physical RGB/buttons/latency stay not-tested. X68HE animations are illustrative, including reactive digital key feedback; no HE writes were enabled. All 78 tests pass, including privacy and serialized report delivery; mocked Electron UI verifies polling readback and keyboard feedback.

## X68HE workspace update 0.2.14
X68 opens in the main keyboard workspace with Lighting, Key tester, Trigger, Advanced keys, Performance and Device tabs. RGB is an illustration driven by selected/read settings, while pressed highlights are digital keyboard input. HE E5 reads are raw 64-byte pages; GET8F firmware selects legacy 0.1 mm or modern u16 1/100 or 1/200 representation. Repeat all parameters before accepting them. Physical slots are never assumed: release/hold verification via read-only E5 FE records each selected key. SET65 writes actuation, release, RT and bottom deadzone only for verified normal-mode keys, preserves unrelated bytes, rejects stale state and verifies full readback. Disabled RT preserves its unused sensitivity bytes. DKS/MT/TGL/Snap Tap editing, calibration, remapping and continuous analog streaming remain unavailable. No physical X68 device was available for testing; unit and Electron UI tests are mocked. X11 receiver report 1D57:FA60 still shows failed connection; no X11 fix in this release.

## X11 pairing update 0.2.15
The friend report has both page 0A and 0B collections on interface 2. Native Windows pairing now traverses DEVPKEY_Device_Parent with a bounded cached read-only query, up to eight ancestors, to the exact matching USB VID/PID composite receiver instance. This verified physical ancestor is preferred over collection ContainerIds; USB hubs, interface parents and another PID are rejected. Parent identities and serials stay private. Different identical receivers cannot cross-pair; ambiguous event collections are refused. Failed automatic reports now include whitelisted interfaces and settings-read stage outcomes, so pairing failure can be distinguished from model identity timeout or settings read failure. Existing consent and Google receiver schema are unchanged. 86 mocked tests and build pass. No physical X11 is attached here; the new pairing correction still needs the friend to reconnect/test.

## Version 0.2.16 X11 decoding and keyboard usability
Friend reports on 0.2.15 confirm X11 pairing/model identification passed but settings read failed; X68HE trigger reads passed. X11 DPI codec previously refused every byte-7 multiplier flag. The reference driver initializes paired byte-6/7 flag 0x20 for high DPI; now accept only matching double/legacy paired flags with canonical DPI byte roundtrip and valid checksum. Independent unsupported byte-7 flags still fail. DPI writes update only the selected paired flag and preserve others. Read-only A0/read sequences retry at most three times with timing backoff and preserve strict validation; no default profile initialization or firmware reset. Read errors name profile/DPI/lighting/polling/buttons. The friend has not confirmed physical X11 connectivity after this correction.
X68 Trigger UI has actuation/RT/deadzone slider+number columns, per-key saved values after mapping, pending edit preservation and Cancel. Clicking an unmapped key automatically captures a released baseline; holding it triggers measured mapping automatically, without a second click. Mappings are valid only for this connection and firmware. Main renders defer during X68 hardware operations. Load current settings still performs complete repeated HE reads. Connecting opens the workspace after the initial full read; background smoke repeats only the overview (RGB/polling/profile), while trigger availability comes from the initial repeated parameter reads. RGB/polling apply verifies only the relevant overview, preserving cached trigger state; trigger writes still perform full stale checks and full readback. Key verification checks profile/firmware rather than redundantly rereading all HE pages. No shortened HID delays or parallel hardware transactions. 90 unit tests pass; mocked Electron UI verifies automatic hold unlock, polling, actuation, pending drafts, Cancel and digital feedback.
