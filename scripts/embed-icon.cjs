const fs = require('node:fs/promises');
const ResEdit = require('resedit');
async function embedIcon(input, output, icon, version) {
  const executable = ResEdit.NtExecutable.from(await fs.readFile(input), { ignoreCert: true });
  const resources = ResEdit.NtExecutableResource.from(executable);
  const file = ResEdit.Data.IconFile.from(await fs.readFile(icon));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  for (const group of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, file.icons.map(item => item.data));
  if (!groups.length) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, file.icons.map(item => item.data));
  for (const info of ResEdit.Resource.VersionInfo.fromEntries(resources.entries)) {
    info.setFileVersion(version); info.setProductVersion(version);
    for (const language of info.getAllLanguagesForStringValues()) info.setStringValues(language, { FileDescription: 'Family Gear', ProductName: 'Family Gear', CompanyName: 'Family Gear contributors', OriginalFilename: 'Family Gear.exe' });
    info.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(executable);
  await fs.writeFile(output, Buffer.from(executable.generate()));
}
module.exports = { embedIcon };
