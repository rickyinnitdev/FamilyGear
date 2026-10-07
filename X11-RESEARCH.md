# ATTACK SHARK X11 — Windows native settings

## Sources

- [Official X11 product page](https://attackshark.com/products/attack-shark-x11-wireless-gaming-mouse-charging-dock): PAW3311, six DPI stages, up to 22,000 DPI, 125–1,000 Hz polling, USB/2.4 GHz/Bluetooth, charging dock with a physical RGB button.
- [MIT native X11 driver and protocol documentation](https://github.com/HarukaYamamoto0/attack-shark-x11-driver), reviewed commit `e4d68c0a191bbbf5ac6cf3919d5fb9bdf0823a0f`. The DPI conversion files are included under `desktop/vendor/x11` with their license and editable source.
- [Pinned OpenMouse protocol](https://github.com/OpenMouse-Project/mouse-protocol/tree/ddcb173fbac224c74741fa4d3c835de54135fdb3): corroborates the X11-family HID collections and Windows browser restrictions. Its default-filled X11 status is not used as actual device readback.

## Implementation

Windows node-hid accesses configuration interface 2 under the normal HID driver; no driver replacement is required. Only VID 1D57 PID FA55/FA60 and usage pages 0B/0A are considered. Collections must belong to the same physical device. The receiver must emit a model-55 notification; shared VID/PID alone is insufficient. Bluetooth and X11 Pro/SE/Ultra are not covered.

Before each settings GET_REPORT, an A0 permission request is sent and its response checked. Reports 04/05/06/08/0C provide DPI/sensor, lighting/sleep/debounce, polling, buttons and profile selection. Profile/header/checksum checks are mandatory. Each edit compares a fresh row with the displayed snapshot, patches only the intended fields, preserves unknown bytes, then requires complete report readback. Button read/write slot orders differ; unknown/custom bindings in other slots are preserved. Left click remains locked.

Supported UI: current stages and active stage, DPI colors, polling, debounce, motion sync/angle/ripple flags when recognized, LOD, sleep, RGB mode/color/speed/brightness/deep sleep, basic/media button actions and current profile switching. Battery data comes from device notifications; absent values stay unknown. The dock's lighting is controlled physically and is not advertised as software RGB.

## Verification and remaining work

No physical X11 was available. Automated codec and mock transport tests cover valid reads, model mismatch, checksum failures, unknown DPI, row preservation, stale settings, ignored writes, slot reorder and battery/settings separation. The packaged Windows native module must also load and enumerate successfully. These checks do not prove every setting works on a friend's X11.

Macro editing and stage-count changes remain disabled. The reference macro writer has a checksum discrepancy involving the final action byte; capture a known-good vendor write and verify all pages/readback before implementing it. This build therefore does not claim complete vendor-app feature parity. Retain existing macros untouched. A friend should test settings one at a time and check physical behavior, then report the model, connection, requested value and displayed readback.
