# Family Gear for Windows

Extract Family-Gear-Windows.zip to a folder. Double-click Family Gear.exe in that folder. Keep the other files alongside the executable. No installation, hosting, GitHub account, or running server is needed.

Click Add device, choose mouse or keyboard, and select your connected device. Close other device configurators first. Keyboard connections use wired USB. Settings are read first; use Apply to write changes. Preview mode uses sample data. Physical hardware verification still requires checking your own device; the RGB preview is a simulation.

Share the entire ZIP with your friends, including Family-Gear-source.zip and the license notices. This is an unsigned personal build, so Windows may show an unknown-publisher notice.

## Build from source

Install Node.js 22.12 or later, extract Family-Gear-source.zip, open a terminal in that source folder, and run:

    npm ci
    npm test
    npm run build:windows
    powershell -File scripts/share.ps1

The packaged app is in release/windows-0.2.3/win-unpacked. The sharing archive is release/Family-Gear-Windows.zip. The source dependency is pinned in package-lock.json to an exact publicly available OpenMouse commit. Sources, changes, packaging scripts and notices are included under AGPL-3.0-or-later.

The desktop conversion preserves current support; it does not add an X11 native bridge or an AULA driver. See README.md for model-specific limitations. Existing product photographs were supplied by the project owner; replace them with your own photos or permitted artwork before wider distribution.

## Updates

Version 0.2.2 and later builds default to the public FamilyGear-Downloads repository. Install the configured Setup .exe once; older unconfigured installers cannot discover this feed. The editable development repository can stay private.

Run npm run build:installer to prepare release assets. Run npm run release:github only when ready and authorized to publish the next stable release. See FREE-UPDATES.md for the complete routine. Updates download automatically and offer Restart to update; no GitHub account is needed for users.

Each installer includes Family-Gear-source.zip under the installed resources folder. About & source opens that folder. Restart is blocked during device writes, live travel or calibration and requires successful device cleanup. Device settings are never sent to the update host.

Version 0.2.3 adds the MK icon and Scan devices. Use Scan connected devices, select your gear, enter the real model name, and Preview report. Share using GitHub (login required), Copy report for group chat, or Save report. Scanning is read-only and does not automatically upload anything.
