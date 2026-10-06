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

The packaged app is in release/windows-0.2.1/win-unpacked. The sharing archive is release/Family-Gear-Windows.zip. The source dependency is pinned in package-lock.json to an exact publicly available OpenMouse commit. Sources, changes, packaging scripts and notices are included under AGPL-3.0-or-later.

The desktop conversion preserves current support; it does not add an X11 native bridge or an AULA driver. See README.md for model-specific limitations. Existing product photographs were supplied by the project owner; replace them with your own photos or permitted artwork before wider distribution.

## Updates (version 0.2.1)

Run npm run build:installer to create release/updates/FamilyGear-Setup-0.2.1.exe. Friends install this once. The old portable ZIP cannot update itself into an installed app: install the new installer once to switch to this update system.

Updates need an HTTPS folder to hold the new installer, its blockmap, latest.yml, and the matching source ZIP. This is file storage, not hosting the running app or uploading device settings. GitHub Releases is not required.

The current prepared installer has no update address. Updates stay disabled until the initial installer is built with your actual address. In PowerShell, before building:

    $env:FAMILY_GEAR_UPDATE_URL = 'https://your-domain.example/family-gear-updates/'
    npm run build:installer

Replace that example with your real address; it is not a working update service. Give friends the configured installer. Upload everything in release/updates to that HTTPS folder, keeping latest.yml until last. Source archives must remain available for each shared version. Keep the same folder URL and app ID for later builds, bump package.json's version, rebuild, and upload the next release files. Test updates on an installed copy before distributing to the group.

When configured, the app checks after opening and every four hours, downloads newer stable releases automatically, shows download progress, and offers Restart to update. It does not install on ordinary exit. Restart is blocked during device writes, live travel or calibration, and requires successful device cleanup. Offline checks can be retried. Device settings are never sent to the update host.

For GitHub Releases and suggestions setup, see FREE-UPDATES.md. The repository is https://github.com/rickyinnitdev/FamilyGear. Private repositories require additional updater authentication; the current generic feed uses anonymous HTTPS.
