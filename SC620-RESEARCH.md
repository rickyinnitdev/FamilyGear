# AULA SC620 research and experimental adapter

Researched October 7, 2026. No physical SC620 was available. Mocked packet tests verify software behavior, not hardware compatibility.

## Primary sources

- Product: https://aulagear.com/products/aula-sc620 — PAW3311, six DPI stages up to 12,000 DPI, USB / 2.4 GHz / Bluetooth, programmable buttons, fire button and RGB effects. Advertised polling is 1,000 Hz over USB/2.4 GHz and 125 Hz over Bluetooth.
- Manufacturer listing: https://www.aulastar.com/mouse/598.html
- Official driver page: https://aulagear.com/blogs/software/aula-sc620-driver
- Linked archive: https://cdn.shopify.com/s/files/1/0552/2803/9264/files/AULA_SC620_Driver_V1.2.2.zip
- Archive SHA-256: `D745ABE823DED39BC9CCB6EA21931979A49D635F03BF0FEF6D62FBD2ECC215AB`.

The installer was extracted with innoextract and inspected as data. Neither the installer nor the vendor executable was run. Research files remain in gitignored `work/sc620/`; they are not included in the app or corresponding-source archive. The adapter is independently authored.

## Identity and transport

The driver's config.xml identifies device type 101, USB VID A8A4/PID 2255/MI_02 and receiver VID A8A5/PID 2255/MI_02. The vendor collection FF01:0010 matches the related OEM transport, but must still be confirmed on actual SC620 hardware. IDs are shared; Family Gear requires an SC620 product name or explicit model selection. It does not auto-identify every matching OEM mouse as an SC620. Bluetooth configuration is unsupported.

Native executable virtual addresses below describe this specific archive, not a stable API. WriteFile includes leading report ID zero; WebHID passes report ID separately and sends 64 payload bytes. Payload header is 55, command, marker, checksum, length, 00, 00, profile. Checksum is the low byte of the sum of payload bytes 4–63. Responses are 64 bytes beginning AA and the matching command. No response checksum scheme was established.

| Command | Native address | Marker / length | Observation |
| --- | --- | --- | --- |
| 30 battery | 4291E9 | A5 / 2E | Reply bytes 8 percentage, 9 charging state |
| 08 read buttons | 429291 | A5 / 2C | Reply byte 8 profile, eleven four-byte records at 9–52 |
| 0E read config | 42933A | A5 / 2E | Reply configuration below |
| 0F write config | 42B095 | AE / 2E | Copies 50 bytes to payload offset 8 |
| 09 write buttons | 42A4CB | A5 / 2C | Preserves all eleven records |

Native exchange 43A400 computes request checksums; read wrapper 43CB43 strips a report-ID byte where present.

## Configuration offsets

Offsets count from the AA response byte. Profile byte 8 is zero for profile 1. Family Gear currently reads/writes only profile 1 and does not claim it is the active hardware profile.

| Bytes | Meaning |
| --- | --- |
| 9 | Built-in effect: Off, Wave, Neon, Cycling Flash, YOYO Ball, Single Flash, Breathing Loop |
| 10 | Polling code 1–4: 125 / 250 / 500 / 1,000 Hz |
| 11–12 | Enabled stage count and one-based selected DPI stage |
| 13–24 | Six little-endian 16-bit DPI values |
| 25–42 | Six RGB stage-color triplets; preserved, not edited |
| 43–47 | Unresolved; preserved |
| 48 | Wheel direction |
| 49 | LOD: 1 / 2 mm |
| 50 | Sensor flags; bit-to-feature mapping unresolved, preserved |
| 51 | Button response/debounce time |
| 52 | Sleep timeout in minutes |
| 53 | eSports / sensor-performance switch |
| 54–57 | Additional unresolved fields; preserved |

Known button slots are left, right, middle, back, forward, DPI, wheel up, wheel down, fire, then two opaque records. Family Gear preserves DPI and opaque slots. Left click stays locked. Basic click, wheel, navigation, DPI loop and fire actions use the driver's observed default records. Existing custom/macro records are retained; macro writing is unavailable.

## Write guarantees and remaining work

Connect reads settings without writes. Editing requires explicit experimental opt-in. Config edits compare a fresh read to the displayed snapshot, change only the selected field, preserve the complete 50-byte configuration and require identical full readback. Button edits compare two fresh reads and the displayed map, preserve all eleven records and verify the complete result. Failed writes invalidate snapshots. Periodic battery reads do not replace the displayed settings snapshot. Unknown values are unavailable rather than replaced with defaults.

Still unverified: physical descriptor/report behavior, effect IDs and behavior on retail firmware, charging flag behavior, persistence, macro storage, sensor flags, fixed RGB/speed controls, profile switching and Bluetooth configuration. Native software has additional capabilities; their presence does not prove their commands work on every firmware.

## Physical validation

Use Scan devices to record USB and receiver identities. Close the official driver, choose Add AULA SC620, connect and compare displayed profile-1 values with the official driver's profile 1. Do not enable edits if identities or settings disagree. For an initial edit, record one DPI stage's original value, change only that stage, check readback and physical behavior, then restore it. Disconnect Family Gear before reopening the official driver; verify persistence after reconnecting. Add real packet fixtures only after reviewing them for identifiers. Never substitute simulated input for device measurements.
