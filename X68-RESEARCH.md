# ATTACK SHARK X68HE

Device supplied in the owner's scan: 3151:502D. Official product page advertises Hall effect switches, rapid trigger, 8 kHz, DKS, MT, TGL and Snap Tap: https://attackshark.com/products/attack-shark-x68-he-rapid-trigger-keyboard-magnetic-switch

Protocol facts investigated using https://github.com/srineshr1/keyboard-driver and the official configurator https://qmk.top. The research repository has no explicit software license; no source code or assets were copied into Family Gear. The adapter is independently written.

Experimental initial support uses usage FFFF:0002, report-ID-zero 64-byte feature reports. GET 85 reads the profile; GET 84 reads polling; GET 87 reads RGB. SET 04 and 07 are followed by fresh GET verification. RGB option byte is preserved, RGB uses byte-8 checksum. Other command headers use byte-7 checksum. The client rejects unrecognized responses and stale snapshots.

HE E5 parameter pages are read only when the returned command, parameter, selector and page headers match. No fallback treating arbitrary bytes as settings. Distances here are the documented 0.1 mm wire encoding, not a claim about sensor precision. Slots are firmware slots, not asserted physical key mappings. Research layout contains 66 positions despite the model name; mapping must be verified on hardware before HE writes or clickable physical assignment.

Calibration, analog streaming, HE editing, advanced bindings, remapping and profile switching are not enabled in this initial adapter. Normal keyboard input is never disabled. RGB and polling require physical verification on the friend's keyboard; mocked tests only check software behavior. No firmware flashing or factory reset.

## Correction, 2026-10-07
Inspected official https://qmk.top/js/index.MMrdkImu.js, independently recording wire facts. The HE ry5088 class overrides polling to GET 83 / SET 03 (rate byte 2, byte 1 zero); profile uses GET 84 / SET 04. The inherited older keyboard class uses a different numbering scheme. Removed SET04 entirely from this adapter, disabled polling writes when GET83 is unrecognized, and changed SET transactions to send-only plus actual GET readback after settling. Unknown HE raw responses remain unavailable rather than decoded as headers/0.1 mm.
