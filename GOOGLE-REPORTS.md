# Google Forms report inbox — owner setup once

1. Open https://script.google.com and create a new project named Family Gear reports.
2. Replace Code.gs with the contents of scripts/google-report-inbox.gs. Save.
3. Choose `setup` and Run. Approve this script's Forms permission in your account. It creates one form; running setup again reuses it. The execution log prints your private form edit link.
4. Deploy → New deployment → Web app. Execute as **Me**, access **Anyone** (not “Anyone with Google account”). Some Workspace accounts restrict anonymous deployment; a personal Google account can be used instead.
5. Copy the URL ending `/exec` and give it to the app developer. This is a public upload address, not your private form edit link. No Google credentials go into Family Gear.
6. In the form's Responses tab, review incoming reports. Optionally click Link to Sheets and enable new-response email notifications. Keep the form edit access and response sheet private; do not enable public response summaries.

The endpoint is put in public/report-inbox.json before building an installer. Until configured and tested, reports remain local and the app must not say they were delivered. Users agree once, then connection/repeat-read reports send automatically, at most one per device/version/day for each connection outcome. Physical RGB/button/latency outcomes are marked not tested. The endpoint accepts a small strict whitelist, discards arbitrary extra fields, deduplicates report UUIDs for six hours and caps accepted reports at 100/day. This is not an authentication or abuse-proof endpoint. Apps Script has daily quotas; a quota error leaves the report queued rather than billing a configured cloud project automatically. No Google Cloud billing project is required by this setup.

Docs: https://developers.google.com/apps-script/guides/web ; https://developers.google.com/apps-script/reference/forms/form-response ; https://developers.google.com/apps-script/guides/content
