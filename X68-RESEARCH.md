# ATTACK SHARK X68HE — 0.2.16

The owner's device is 3151:502D. The [official product page](https://attackshark.com/products/attack-shark-x68-he-rapid-trigger-keyboard-magnetic-switch) advertises rapid trigger, 8 kHz, DKS, MT, TGL and Snap Tap. These features require model-specific protocols; Hall effect switches do not imply compatibility with MCHOSE commands.

Wire facts were investigated from the official configurator https://qmk.top and its bundle https://qmk.top/js/index.MMrdkImu.js. The adapter is independently written. An unlicensed research repository was consulted for protocol facts; no implementation or artwork was copied.

## Implemented protocol

Usage FFFF:0002, report-ID-zero 64-byte feature reports. Current HE polling is GET83/SET03, rate byte 2; GET84 reads profile. SET04 switches profiles and is never used for polling. An older GET85/GET84 fallback remains read-only. GET87/SET07 handles lighting, preserving its option byte and using byte-8 checksum. Other headers use byte-7 checksum. SET responses are not acknowledgements: actual GET readback is required.

GET8F firmware bytes 7/8 select distance encoding: before 768, legacy u8 (value+1)/10 with inverted bottom deadzone (39-value)/10; before 1280, LE u16 /100; later, LE u16 /200. E5 parameter responses are raw 64-byte pages, not echoed command headers. Parameters 0/1/2/3/6/7 provide actuation, release, RT press/release, bottom deadzone and mode flags. Each complete parameter is read twice and checked for stable, recognized values. Unknown firmware/layout leaves trigger controls unavailable.

Physical positions are not assumed from a borrowed matrix. A release baseline and two held-switch E5 FE reads verify each browser key against exactly one hardware slot before editing. SET65 changes only verified normal-mode keys, preserves other keys and flags, rejects stale snapshots and verifies every complete parameter after writing. Disabled rapid trigger preserves unused sensitivity bytes. Advanced modes are refused by trigger editing.

## UI and limits

The main keyboard workspace provides Lighting, Key tester, Trigger, Advanced keys, Performance and Device tabs, selectable keys, current settings, Cancel and explicit Apply. RGB previews illustrate selected effects; key highlights use digital input. They are not measurements of the physical LEDs or analog depth.

DKS, MT, TGL, Snap Tap editing, remapping, calibration, switch replacement and continuous analog streaming remain unavailable. Their binding banks and session state need separate verification. No firmware flashing or factory reset is performed.

90 unit tests and an Electron UI harness exercise mocked devices. The owner has supplied successful physical RGB/polling reads, but this new HE path has not been tested with a physical X68HE. Keep support experimental and do not claim complete parity with Ace 60 Pro. X11 receiver 1D57:FA60 still has a failed connection report; this release does not fix it.

### Usability and read scheduling, 0.2.16
Click a key then hold it when prompted: released-baseline/held-switch mapping is automatic and still requires measured depth. The UI shows saved per-key values for mapped keys, slider and number controls, retained drafts and Cancel. Full settings load keeps repeated raw HE validation. Read-only automatic reports repeat the overview instead of a second complete HE transfer; trigger availability reflects the initial repeated HE reads. RGB/polling writes verify fresh overview blocks and preserve cached trigger values. HE Apply still reads and compares the complete settings before and after writing. Firmware changes invalidate measured mappings.
