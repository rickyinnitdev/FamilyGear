const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('familyGear', {
  onClose: handler => ipcRenderer.on('closing', async (_, reason) => {
    try { await handler(reason); ipcRenderer.send('closed-devices'); }
    catch (error) { ipcRenderer.send('closed-devices', String(error)); }
  }),
  onDevices: handler => ipcRenderer.on('devices', (_, devices) => handler(devices)),
  choose: id => ipcRenderer.send('choose-device', id),
  community: () => ipcRenderer.invoke('community'),
  scanDevices: () => ipcRenderer.invoke('scan-devices'),
  copyReport: text => ipcRenderer.invoke('copy-report', text),
  source: () => ipcRenderer.send('open-source'),
  updateState: () => ipcRenderer.invoke('update-state'),
  onUpdate: handler => ipcRenderer.on('update-state', (_, state) => handler(state)),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  restartUpdate: () => ipcRenderer.send('restart-update')
});
