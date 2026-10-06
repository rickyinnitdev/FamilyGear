const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
(async () => {
  const version = require('../package.json').version;
  const dir = path.resolve(__dirname, '../release/updates');
  const file = `FamilyGear-Setup-${version}.exe`;
  const bytes = await fs.readFile(path.join(dir, file));
  const sha512 = crypto.createHash('sha512').update(bytes).digest('base64');
  await fs.copyFile(path.resolve(__dirname, '../release/Family-Gear-source.zip'), path.join(dir, `Family-Gear-source-${version}.zip`));
  await fs.writeFile(path.join(dir, 'latest.yml'), `version: ${version}\nfiles:\n  - url: ${file}\n    sha512: ${sha512}\n    size: ${bytes.length}\npath: ${file}\nsha512: ${sha512}\nreleaseDate: '${new Date().toISOString()}'\n`);
  const config = JSON.parse(await fs.readFile(path.resolve(__dirname,`../release/windows-${version}/win-unpacked/resources/family-gear-updates.json`),'utf8'));
  await fs.writeFile(path.join(dir,'README.txt'), `Family Gear ${version}\nUpdate address: ${config.url || 'NOT CONFIGURED'}\nUpload the installer, its blockmap and matching source ZIP to your HTTPS update folder. Upload latest.yml last. Build the initial installer with FAMILY_GEAR_UPDATE_URL set to that folder address.\n`);
  console.log('Update files ready: ' + dir);
})().catch(error => { console.error(error); process.exitCode = 1; });
