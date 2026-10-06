const fs = require('node:fs/promises');
const path = require('node:path');
const { downloadArtifact } = require('@electron/get');
const { execFileSync } = require('node:child_process');
const asar = require('@electron/asar');
const esbuild = require('esbuild');
const { updateAddress } = require('../desktop/updates.cjs');
(async () => {
  if (process.platform !== 'win32') throw new Error('Build this Windows package on Windows.');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, `release/windows-${require('../package.json').version}/win-unpacked`);
  const staging = path.join(root, 'release/updater-app-source');
  const version = require('../package.json').version;
  const repository = require('../desktop/community.cjs').repository(process.env.FAMILY_GEAR_GITHUB_REPO ?? require('../desktop/distribution.cjs').repository);
  const url = updateAddress(process.env.FAMILY_GEAR_UPDATE_URL || (repository ? `https://github.com/${repository}/releases/latest/download/` : ''));
  const archive = await downloadArtifact({ version: require('electron/package.json').version, artifactName: 'electron', platform: 'win32', arch: 'x64' });
  await fs.mkdir(output, { recursive: true });
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(output)} -Force`]);
  await fs.mkdir(staging, { recursive: true });
  for (const file of ['dist','desktop','LICENSE','THIRD_PARTY_NOTICES.md']) await fs.cp(path.join(root,file), path.join(staging,file), { recursive: true, force: true });
  await esbuild.build({ stdin: { contents: "module.exports = require('electron-updater');", resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: path.join(staging,'desktop/updater-runtime.cjs') });
  await fs.writeFile(path.join(staging,'package.json'), JSON.stringify({ name: 'family-gear', productName: 'Family Gear', version, main: 'desktop/main.cjs', license: 'AGPL-3.0-or-later' }));
  await asar.createPackage(staging, path.join(output,'resources/app.asar'));
  await fs.mkdir(path.join(output,'licenses'), { recursive: true });
  await fs.copyFile(path.join(root,'node_modules/lucide/LICENSE'),path.join(output,'licenses/LUCIDE.txt'));
  await fs.copyFile(path.join(root,'LICENSE'),path.join(output,'licenses/FAMILY-GEAR-AGPL.txt'));
  await fs.copyFile(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(output,'licenses/THIRD_PARTY_NOTICES.md'));
  const dependencyFolders = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d','/c','npm ls --omit=dev --all --parseable'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(folder => folder !== root);
  for (const folder of dependencyFolders) {
    const info = JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));
    const licenseFolder = path.join(output,'licenses',info.name.replace(/[@/]/g,'_'));
    await fs.mkdir(licenseFolder,{recursive:true});
    for (const name of await fs.readdir(folder)) if (/^(license|copying|notice)(\.|$)/i.test(name)) {
      const file = path.join(folder,name);
      if ((await fs.stat(file)).isFile()) await fs.copyFile(file,path.join(licenseFolder,name));
    }
  }
  await fs.writeFile(path.join(output,'resources/family-gear-updates.json'), JSON.stringify({ url, repository }, null, 2));
  if (url) await fs.writeFile(path.join(output,'resources/app-update.yml'), `provider: generic\nurl: ${JSON.stringify(url)}\nupdaterCacheDirName: family-gear-updater\n`);
  await fs.copyFile(path.join(output,'electron.exe'), path.join(output,'Family Gear.exe'));
  await fs.unlink(path.join(output,'electron.exe'));
  console.log('Windows app ready: ' + path.join(output,'Family Gear.exe'));
})().catch(error => { console.error(error); process.exitCode = 1; });
