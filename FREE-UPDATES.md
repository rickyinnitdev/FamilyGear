# Family Gear updates

Development repository: https://github.com/rickyinnitdev/FamilyGear (keep private).
Download repository: https://github.com/rickyinnitdev/FamilyGear-Downloads (public).

The public repository holds Releases and suggestion Issues. Use manual uploads or the explicit local release command. No paid hosting, Actions, Packages or cloud server is needed. GitHub supplies HTTPS.

## Install once

Download the Setup .exe from the latest Release in FamilyGear-Downloads. Version 0.2.2 is the first configured installer. Older 0.2.0/0.2.1 installers need this one manual upgrade. No GitHub account is needed to download or update. Each installer contains its corresponding source ZIP and notices. About & source opens the installed resources folder containing that archive.

## Your routine when adding features

1. Make changes in the private development repository.
2. Bump package.json, package-lock.json and the visible app version. Packaging output paths automatically follow the version.
3. Run npm test and npm run build:installer.
4. With the owner's GitHub account authenticated in Git Credential Manager, run npm run release:github. This publishes only to FamilyGear-Downloads. It creates a draft, uploads the installer, blockmap, matching source ZIP and latest.yml, then publishes as Latest. Do not run it unless ready to publish. Credentials stay on the owner's machine.
5. Friends open Family Gear. It checks after opening and every four hours, downloads a newer stable version, then offers Restart to update. They can also check manually. Ordinary app exit does not install updates.

Alternative: create a stable GitHub Release manually, attach the four matching files from release/updates and set it as Latest. Do not upload old-version files by mistake or overwrite an already published version. Keep historical source archives available.

Default feed: https://github.com/rickyinnitdev/FamilyGear-Downloads/releases/latest/download/latest.yml
The configured repository is in desktop/distribution.cjs. Build-time FAMILY_GEAR_GITHUB_REPO or FAMILY_GEAR_UPDATE_URL overrides remain available.

## Suggestions

Share an idea lets friends compose and preview a message. Copy message works for group chat without login. Open GitHub form opens a public Issue form; submitting there uses their own GitHub account. Review suggestions on GitHub opens the public inbox so the owner can comment, label and close ideas. No USB/device data is attached automatically.

The source repository's privacy does not make release downloads or included source private. This arrangement intentionally provides public downloads without access invitations.

## Device reports (0.2.3)

Open Scan devices in the Windows sidebar, then Scan connected devices. Select your gear, enter the real model name and requested features, and Preview report. Send report on GitHub opens a public form for review/submission; Copy report works for your group chat without login. Save report creates a local text file only when clicked. The scanner includes USB HID device names and VID/PID, not serial numbers, computer names or account details. Scanning does not send anything automatically. Review reports at https://github.com/rickyinnitdev/FamilyGear-Downloads/issues?q=is%3Aissue+%22%5BDevice+report%5D%22
