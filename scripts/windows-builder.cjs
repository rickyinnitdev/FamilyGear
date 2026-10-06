module.exports = {
  appId: 'app.familygear.studio',
  productName: 'Family Gear',
  directories: { output: 'release/updates' },
  win: { target: 'nsis', signAndEditExecutable: false, artifactName: 'FamilyGear-Setup-${version}.${ext}' },
  nsis: { oneClick: true, perMachine: false, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
  extraResources: [{ from: 'release/Family-Gear-source.zip', to: 'Family-Gear-source.zip' }]
};
