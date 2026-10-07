# Third-party sources

## OpenMouse mouse-protocol

https://github.com/OpenMouse-Project/mouse-protocol

Commit: ddcb173fbac224c74741fa4d3c835de54135fdb3

License: AGPL-3.0-or-later, as declared by the package. Copyright remains with the OpenMouse contributors. This app imports the original ATK driver rather than rewriting its device commands. The upstream license is preserved in LICENSE and public/LICENSE.txt.

## ace60-re

https://github.com/backaround/ace60-re

Commit: e1782814b064f9cdaa51664f5c1ab8b686c03d5d

The repository README states MIT. Packet framing, base Ace 60 identity and travel-record definitions informed our independently authored TypeScript port. The repository did not include a separate copyright-bearing LICENSE file at the reviewed commit. No Python script is redistributed in the app. Modified behavior: fail closed on missing/unknown records, preserve original switch type and flags, constrain distances to 0.10–4.00 mm, confirm responses and readback, and preserve unrelated slots.

## HallJoy

https://github.com/PashOK7/HallJoy

License: AGPL-3.0. Copyright remains with its contributors. Pro identity, GetInfo length, profile validation and reply checks were informed by src/HallJoyProject/HallJoy/mchose_jet75_protocol.h and mchose_mix87_protocol.h. This app does not enable HallJoy's analog service flag, calibration, or gamepad support.

## MCHOSE Pro protocol observations

Pro controls are independently implemented from protocol facts observed in MCHOSE's official M HUB assets on 2026-10-07:
https://www.mchose.com.cn/cizhou/CZ_SHARED_DATA/main.51a87bccd7c58d7775eb.js
https://www.mchose.com.cn/cizhou/CZ_SHARED_DATA/layout-ace60.bb29f679b61b21be5e1a.js
https://www.mchose.com.cn/cizhou/CZ_SHARED_DATA/layout-ace60_pro.ec316b4f4e52c66a98f0.js

The Pro layout references the Ace 60 effect list: Static=3, Breathing=4, Rainbow cycle=1. Profile blocks are 64 bytes; main effect=8, brightness=9, inverted speed=10, direction=11, rainbow flag=12, color index=13, RGB=14–16. GetFuncConfig=05; SetFuncConfig=06 with byte offsets. Writes are restricted to Pro 41E4:2103 firmware 1.18. No vendor source code or firmware is included in the application or redistributed build. User-supplied device artwork is noted below. Research downloads remain in the ignored work directory.

Additional official Cizhou application assets informed trigger precision/ranges, physical key mapping, four-layer basic bindings and performance flags:
https://www.mchose.com.cn/cizhou/_next/static/chunks/1288-d74b464bce618e3b.js
https://www.mchose.com.cn/cizhou/_next/static/chunks/2233-930d2ce0a506cdf3.js
https://www.mchose.com.cn/cizhou/_next/static/chunks/1833-6562fe1f092107cf.js

Travel uses A0/A1 with 1024 bytes per profile and 8-byte key records. Physical defaults use 07; user bindings use 08/09 with 3-byte records and 512-byte layer offsets. Actuation uses 0.01 mm units; RT precision can use 0.01 or 0.005 mm units. Pro polling codes 4/3/2/1 represent 1/2/4/8 kHz. Controls validate snapshots before writes, retain unrelated bytes, and require readback. Vendor assets were read as research data and are not executed by this application.

Brightness byte 9 is a literal 0–100 percentage. The earlier 0–4 UI interpretation was incorrect and has been corrected. Advanced legacy binding types 144/146/147/148 represent DKS/MT/RS/SOCD. MT, RS and SOCD share 32 six-byte action records at A4/A5 (256-byte profile area); DKS uses 32 24-byte records at A2/A3 (768-byte profile area). SOCD priority is the high nibble of trigger byte 1. Official English priority descriptions were checked at https://www.mchose.com.cn/cizhou/locales/en/common.json?v=1 . The implementation preserves unrelated records and all four layer maps, allocates free action slots, and verifies complete readback.

## Lucide

https://lucide.dev — ISC license. Copyright (c) Lucide Contributors. Icons used via the lucide package. See node_modules/lucide/LICENSE for the full upstream license.

## AMouse changes

New dashboard, device integration and keyboard TypeScript port created October 7, 2026. Released under AGPL-3.0-or-later. Hardware compatibility is not represented as verified by creation of this app.
# Additional protocol observations

Independently implemented from the official M HUB SDK/UI: Quick Trigger modes 1/2; active-profile debug flag; A8/A9 calibration lifecycle; unsolicited A0 physical-key/travel/status reports; A6/A7 Toggle action banks and type 145 bindings. Vendor source is reviewed as text and is not executed or bundled by AMouse.

## Device illustrations

The VXE and MCHOSE PNGs in public/images were supplied by the user. Their original image license/permission has not been established; the software AGPL license does not grant rights to third-party product photography. Obtain permission or replace them with original artwork before public hosting. generic-mouse.svg is original application artwork.

ATTACK SHARK integrations use GearHub and Lamzu/CompX drivers from the same pinned AGPL-3.0-or-later OpenMouse protocol dependency. Upstream copyright notices and license remain applicable.
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## AULA SC620 protocol research

The SC620 adapter is independently authored from static observations of the official AULA SC620 Windows driver archive linked at https://aulagear.com/blogs/software/aula-sc620-driver. Vendor executables, extracted resources and product artwork are not distributed with this adapter. See SC620-RESEARCH.md for provenance and limitations. Existing OpenMouse notices remain applicable to the other drivers.
# Native X11 support

The X11 DPI conversion code in `desktop/vendor/x11` is from [HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver), licensed under MIT. Its original license is included beside the editable source. The native HID transport uses node-hid and its packaged HIDAPI/native components; dependency license files are included in the Windows distribution. Family Gear's native settings integration is experimental and independent of ATTACK SHARK.
