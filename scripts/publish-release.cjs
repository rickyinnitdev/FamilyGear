// Explicit publication command; credentials remain in memory and are never included in builds.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { repository } = require('../desktop/distribution.cjs');
const version = require('../package.json').version;
const tag = `v${version}`;
const base = `https://api.github.com/repos/${repository}`;
(async () => {
  const credential = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const token = credential.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!token) throw new Error('Sign into GitHub through Git Credential Manager first.');
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'FamilyGear-release', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`GitHub ${method} failed (${response.status}).`);
    return response.json();
  }
  const info = await api(base);
  if (info.private) throw new Error('The download repository must be public for anonymous app updates.');
  const directory = path.resolve(__dirname, '../release/updates');
  const names = [`FamilyGear-Setup-${version}.exe`, `FamilyGear-Setup-${version}.exe.blockmap`, `Family-Gear-source-${version}.zip`, 'latest.yml'];
  for (const name of names) await fs.access(path.join(directory, name));
  const releases = await api(`${base}/releases?per_page=100`);
  if (releases.some(release => release.tag_name === tag)) throw new Error(`${tag} already exists. Do not overwrite published versions.`);
  const release = await api(`${base}/releases`, 'POST', { tag_name: tag, name: `Family Gear ${version}`, draft: true, prerelease: false, body: 'Windows app for your mouse and keyboard.\n\nDownload the Setup .exe below and install it once. Future versions download inside the app and offer Restart to update. No GitHub account is needed for downloads or updates.\n\nThe installer includes the matching source ZIP and license notices; a separate source download is also provided. Close other device configurators before connecting a device. This personal build is unsigned.\n\nVersion 0.2.22 adds a five-second mouse polling-rate test. Move continuously inside the test area to measure delivered movement events and timing intervals. This is not an exact USB polling or latency measurement and does not change settings.' });
  const upload = new URL(release.upload_url.split('{')[0]);
  if (upload.protocol !== 'https:' || upload.hostname !== 'uploads.github.com') throw new Error('Unexpected GitHub upload host.');
  for (const name of names) {
    upload.search = new URLSearchParams({ name }).toString();
    const bytes = await fs.readFile(path.join(directory, name));
    const response = await fetch(upload, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: bytes });
    if (!response.ok) throw new Error(`Upload failed for ${name} (${response.status}); the release remains a draft.`);
    console.log(`Uploaded ${name}`);
  }
  const published = await api(`${base}/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'true' });
  console.log(`Published ${published.html_url}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
