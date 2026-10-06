# Free updates and suggestions

Use a GitHub Free public repository, manual Releases uploads, and Issues. This setup needs no paid hosting or payment card. Do not enable paid services for this workflow.

## First setup

1. Create a free GitHub account and a public repository named `Family-Gear`. Keep Issues enabled in repository Settings.
2. Upload the editable project source, LICENSE, notices and build instructions. Keep installers out of Git: upload them as Release assets instead.
3. Send your repository URL to the person building the app. Configure it in PowerShell before building:

   ```powershell
   $env:FAMILY_GEAR_GITHUB_REPO = 'YOUR-USERNAME/Family-Gear'
   npm run build:installer
   ```

4. Create a stable release tagged `v0.2.1` on GitHub. Upload `FamilyGear-Setup-0.2.1.exe`, its `.blockmap`, `Family-Gear-source-0.2.1.zip` and `latest.yml` from `release/updates`. Publish after all files finish uploading. Mark this stable release as Latest.
5. Share the configured installer once with your friends. They do not need GitHub accounts to download updates.

The app checks `https://github.com/YOUR-USERNAME/Family-Gear/releases/latest/download/latest.yml`. GitHub supplies HTTPS; you do not need a domain or web server.

## When adding features

1. Make the changes and update the version in package.json/package-lock.json and the displayed app version. Use a fresh output folder if the previous portable app is running; packaging paths currently target `windows-0.2.1`.
2. Keep the same FAMILY_GEAR_GITHUB_REPO, run tests and `npm run build:installer`.
3. Upload the changed source and create the new version's stable GitHub release. Attach the new installer, blockmap, matching source archive and latest.yml. Set the release as Latest.
4. Friends open Family Gear. It downloads the new version and offers Restart to update. They can also click Check for updates.

Keep each release's source archive available alongside its installer.

## Suggestions

Friends click Share an idea, write their message and preview it. Open GitHub form opens a public Issue form for them to review and submit with their own GitHub account. Nothing is submitted automatically. Suggestions contain only the text they enter.

Review suggestions on GitHub opens your repository's suggestion inbox. As repository owner, you can comment, label and close suggestions there. Copy message is available for group chat without GitHub login; copied messages do not automatically reach the GitHub inbox.

Without a configured repository, Copy message works, but online updates and the suggestion inbox are not connected.
