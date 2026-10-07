# Family Gear Device Studio

A local TypeScript device studio for VXE R1-family mice, selected ATTACK SHARK mice, AULA SC620 and MCHOSE Ace keyboards. Built with Vite and OpenMouse's device drivers.

## Run

Requires Node.js 20.19+ or 22.12+ and Chrome/Edge on desktop.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. WebHID requires localhost or HTTPS. Select **Connect mouse** or **Connect keyboard** and choose your device in the browser picker. Close OpenMouse, M HUB, and other configurators first. For keyboards use wired USB. Connections read existing settings; changes require the Apply button.

The source dependency is pinned to an exact OpenMouse commit. The lockfile records the complete installation.

## Current support

| Device | Functionality | Limitations |
| --- | --- | --- |
| VXE R1 / R1 SE+ / R1 Pro Max on known R1 transports | Battery, firmware, DPI, polling, debounce, motion sync, angle snapping, ripple control; capability-dependent sleep, LOD, sensor performance, long range, DPI indicator, DPI stages/X-Y and profile switching | Only 373B:1085 and 3554:F58A/F58C/F58E/F58F transport IDs. Unsupported controls are disabled. Stage editing requires a verified upstream transport; an ordinary wireless R1 may need wired USB. Button mappings are inspection-only. |
| MCHOSE Ace 60, 41E4:2101 | Firmware, read travel records, experimental actuation and RT distance writes, JSON backup | Community protocol port; not tested on physical hardware in this session. Hardware slot IDs are not mapped to key labels. Preserves switch types, modes, precision/deadzone bits. Does not enable or disable RT modes. |
| MCHOSE Ace 60 Pro, 41E4:2103, firmware 1.18 | 22 lighting effect tiles, RGB keyboard simulation, RGB/multicolor, 0–100% brightness and speed; per-key actuation, RT modes/distances and deadzones; basic remapping across four layers; Hold/Tap, RS, SOCD and four-action DKS; polling, Windows lock, Mac mode, debounce optimization, stability and adaptive calibration | Experimental independent protocol implementation. Trigger editing supports Default switch keys in Normal/RT modes and preserves existing precision. Advanced writes preserve shared action banks and require full readback. Hardware behavior requires testing on your device. Nordic and other variants are not included. |
| AULA SC620 (experimental) | Profile-1 current settings; six DPI stages, 125–1,000 Hz polling, debounce, LOD, sleep, sensor-performance mode, wheel direction, seven built-in RGB options including Off, basic button actions and battery telemetry | USB/2.4 GHz only, matching configuration interface and explicit model selection required for generic names. Not physically tested. Edits require opt-in and complete readback. Macros, sensor-processing flags, active-profile switching and custom RGB colors/speed remain unavailable. See [SC620-RESEARCH.md](SC620-RESEARCH.md). |
| ATTACK SHARK X11 (experimental Windows native HID) | Current DPI/stages/colors, 125–1000 Hz polling, debounce, sensor flags, LOD, sleep, device lighting, basic/media button assignments and profiles | USB/2.4 GHz only. Model identification and full settings readback required. No physical X11 verification yet. Stage count and macro editing are unavailable; dock RGB uses the dock button. Use **Add ATTACK SHARK X11** in the Windows app. See [X11-RESEARCH.md](X11-RESEARCH.md). |
| Any keyboard with normal browser events | 60% ANSI key tester | Digital presses only; does not measure analog depth. Fn and OS shortcuts may not reach the browser. |

**Preview mode** uses clearly labeled sample data. It never connects to hardware or sends reports. Disconnect hardware before using it.

Not yet implemented: mouse macros, general mouse remapping beyond the model-specific basic action editors, keyboard media/mouse/shortcut actions, custom per-key lighting, custom DKS timing, manual switch calibration, keyboard profile creation/switching, cloud sync, backup restore/import, receiver pairing, reset, firmware flashing, native bridge or gamepad emulation. Device pages link to the official configurators for these functions. A failed multi-key write may have applied some records; reload the device before proceeding. Backups are raw snapshots, not an automatic restore utility.

The brightness bug in the earlier version is corrected: writing 4 meant **4%**, not full brightness. Choose **100%** and Apply lighting to raise it; existing device settings are never silently changed. The RGB keyboard is a visual simulation, not live LED telemetry.

The VXE R1 COMPX receiver/wired path (3554:F58E/F58F) now probes the sensor-performance row independently of unsupported lighting data. It enables the experimental high-performance toggle only after a valid read; writes preserve the complete row and require an echo plus full readback. Other interfaces retain their upstream capability limits. Reconnect or Refresh to probe it.

Battery telemetry updates every 15 seconds while the page is visible, without replacing form edits. The charging estimate is based on the observed percentage increase, requires at least three minutes and a 3% rise, and resets on disconnect/discharging or long sampling gaps. It is an estimate: charge rate may slow near full. Wired USB alone is not treated as proof of charging; the device must report Charging.

## Verification

```sh
npm run test
npm run build
```

Tests cover packet integrity, mismatched/stale responses, selected-profile offsets, preserving unrelated settings and keys, rejecting unknown records and invalid distances, and acknowledgment/readback failures. Hardware validation still requires your specific devices. Before keyboard testing, optionally export a backup and start with one key.

For Pro trigger settings, connect in wired USB, open **Trigger**, click **Load keys from keyboard**, select one key or WASD, then Apply. Success requires complete trigger readback; physically test the key afterward. For remapping, load the intended layer in **Key config**, apply one binding, and test the key in **Key tester**. Remap it back to restore its original action. Close M HUB and other configurators during testing. After a polling-rate change, USB may restart: reconnect and Refresh. Compare saved settings in M HUB after disconnecting this app, and unplug/reconnect to check persistence.

Trigger and Advanced keys automatically read data on entering their tabs; Load keys can reread it. Advanced bindings allocate unused records across all four layers of the active profile. Hold/Tap delay uses 10 ms steps. RS and SOCD use original physical key actions; SOCD priority is stored per physical key and therefore applies across layers. DKS currently offers four action events at fixed 1 / 3 / 3 / 1 mm press/release points. Remove binding restores original physical actions (both keys for a pair). No automatic backups are downloaded. Use a manual export when wanted. Physical analog priority and DKS behavior cannot be confirmed by a browser key tester alone; compare behavior with M HUB and test your keys.

## Project layout

Quick Trigger uses saved mode 1. The separate continuous Rapid trigger switch uses mode 2; Normal is mode 0. Select keys to see saved values. Mixed selections show the first selected key, and Apply writes the chosen values to all selected keys.

Live travel reads measured A0 reports identified by physical key actions. Calibration uses A8 to start and A9 to exit; status 255 marks a device-confirmed calibrated key. Live sessions temporarily enable the active profile's debug flag. Exit, navigation, hiding the page and disconnect restore its previous state while preserving other flags. Page closure cleanup is best effort; use Exit before closing. Preview mode does not invent analog depth or calibration success. These hardware paths remain experimental for Ace 60 Pro 1.18.

Advanced keys have a clickable physical keyboard, digital press feedback, action cards and a searchable action palette. Toggle uses the shared A6/A7 action bank and type 145 bindings. All four layers are inspected before allocating a slot, and writes require full readback.

- `src/main.ts`: dashboard, preview, connection lifecycle and UI.
- `src/style.css`: responsive theme.
- `src/devices/vxe.ts`: OpenMouse ATK driver integration.
- `src/devices/ace.ts`: serialized WebHID transport and read/write verification.
- `src/devices/ace-codec.ts`: keyboard packet and travel record encoding.
- `src/devices/ace-lighting.ts`: active-profile lighting encoding.
- `src/devices/ace-pro.ts`: Pro trigger, basic binding and performance encoding.
- `tests/`: protocol regression tests.

## License and sharing

AGPL-3.0-or-later. Keep LICENSE and THIRD_PARTY_NOTICES.md with copies. If sharing a modified/deployed version, offer the complete corresponding source, including build instructions and your changes, to its users under the applicable AGPL terms. A source archive can be hosted alongside the site and linked in the About dialog. No public deployment is included in this local project.

Device traffic is local USB communication; there is no app backend or telemetry. The app uses system font fallbacks offline; it does not request Google Fonts.

## Verify keyboard lighting

Refresh the page, disable Preview mode, connect Ace 60 Pro by wired USB, and open Lighting. Firmware 1.18 (41E4:2103) is supported. Select Static, turn Multicolor off, choose red (#FF0000), set brightness to 100%, and Apply lighting. No backup downloads automatically. Success is displayed only after all 256 settings bytes and the active-profile base block match readback. Confirm that the physical LEDs turn red; then Refresh and reconnect after unplugging to check persistence. An acknowledgment or preview alone does not prove a physical change. Reactive effects require a key press to become visible.

Lighting writes touch only active-profile bytes 8–16 via opcode 06, preserving direction, color index and unrelated bytes. Brightness and speed remain unchanged unless explicitly chosen. Stale settings/profile or unsupported firmware stop before writing. Close other configurators while using this app.

## Additional mouse support

ATTACK SHARK R2/R3 use the upstream GearHub driver (shared transport IDs 3151:4026/402D, model read required). R5 Ultra/R6/R8 use the CompX/Lamzu driver and exact catalog PIDs under VID 373E. These integrations are experimental and have mock tests; they have not been physically tested in this session. Load current settings first. DPI, supported polling rates, debounce, processing flags, sleep and lift-off unlock only when reported; GearHub also exposes DPI stages/colors and button assignments. Fixed stage counts cannot be changed. Writes require device readback; missing methods never fall back to VXE packets. Models may expose different features.

X11-family 1D57 devices need a native bridge on Windows; this app currently explains the limitation and does not write them. No AULA mouse driver exists in the pinned source; an exact model and protocol evidence are needed before adding it. References: https://openmouse.app/supported and https://github.com/OpenMouse-Project/mouse-protocol.

The Advanced keys Cancel button discards the unsaved editor selection/actions without writing the keyboard. All automatic setting/calibration backup downloads are removed. Back up settings, profile exports and diagnostics remain explicit manual actions.

## Windows app

See WINDOWS.md. Run npm run build:windows and npm run package:share to produce the Windows sharing ZIP with matching source.

## Continuing development

Read [AI_HANDOFF.md](AI_HANDOFF.md) for architecture, current work and update setup. [FREE-UPDATES.md](FREE-UPDATES.md) explains Releases and suggestion submission. Repository: https://github.com/rickyinnitdev/FamilyGear.

## Windows device scanner

Version 0.2.3 adds a read-only USB input-device scanner and simple MK app icon. Scan devices lets friends select and preview device names/IDs before opening a GitHub report form or copying/saving for group chat. Unsupported devices can be reported without opening or configuring them. Reports are not sent automatically. GitHub submission needs login; copying a report does not.

## Mouse troubleshooting and SC620 reports

Version 0.2.7 corrects polling for the CompX VXE R1 (3554:F58E/F58F): it uses the system polling pair rather than the Beken live-settings selector. The connected F58E receiver passed the built app's Apply test at 800 DPI and 500 Hz, then its original 1600 DPI and 1000 Hz were restored. Each write requires device readback and preserves unrelated settings. Pending selections remain visible if Apply fails, with an inline error and Cancel changes. Use the physical DPI button to switch stages on this receiver. Other hardware still requires its own verification.

Check delay & optimize previews a supported mouse preset, verifies each change and offers restoration. Windows pointer acceleration/speed are read only; opening Windows settings is optional. It does not claim zero delay or measure end-to-end input latency. See Microsoft’s input-latency guidance: https://learn.microsoft.com/en-us/windows/uwp/gaming/optimize-performance-for-windows-store-direct3d-11-apps-with-coredispatcher and pointer settings: https://support.microsoft.com/en-us/windows/hardware/input-devices/change-mouse-settings .

SC620 users can agree to local test reporting. Connections and Apply results are recorded without raw packets, serials, paths, keystrokes or account information. Device readback and physical behavior are distinguished. Test report & agreement lets users review, copy, open a public GitHub form or delete/stop recording. Nothing is uploaded automatically.

Version 0.2.8 fixes CompX R1 debounce through its advanced settings pair, preserving the complete sensor row. The built app confirmed 2 ms on the connected F58E receiver and restored its original 4 ms. Failed or stale writes still produce an error.

### ATTACK SHARK X68HE (experimental)
Add device → ATTACK SHARK X68HE, via wired USB. RGB and polling load from device and require write readback. Optional Hall effect slot values are read-only. Calibration, HE editing, analog depth and advanced bindings need further verification; use the official configurator for these. See X68-RESEARCH.md.

Version 0.2.12 corrects X68HE polling/profile command separation, adds RGB keyboard illustration and effect tiles, digital key feedback, Load current settings and Cancel changes. X11 connection failures now open the reviewed local interface report automatically. Hardware confirmation is still needed.
