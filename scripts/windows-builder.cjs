module.exports = {
  appId: 'app.familygear.studio',
  productName: 'Family Gear',
  directories: { output: 'release/updates' },
  win: { icon: 'build/icon.ico', target: 'nsis', signAndEditExecutable: false, artifactName: 'FamilyGear-Setup-${version}.${ext}' },
  nsis: { installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico', oneClick: true, perMachine: false, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
  extraResources: [{ from: 'release/Family-Gear-source.zip', to: 'Family-Gear-source.zip' }]
};
