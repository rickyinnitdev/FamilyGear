const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('familyGear', {
  x11: async (operation,args=[]) => {
    try { return await ipcRenderer.invoke('x11',operation,args); }
    catch(error) { throw new Error(String(error.message).replace(/^Error invoking remote method 'x11': Error:\s*/,'')); }
  },
  onClose: handler => ipcRenderer.on('closing', async (_, reason) => {
    try { await handler(reason); ipcRenderer.send('closed-devices'); }
    catch (error) { ipcRenderer.send('closed-devices', String(error)); }
  }),
  onDevices: handler => ipcRenderer.on('devices', (_, devices) => handler(devices)),
  choose: id => ipcRenderer.send('choose-device', id),
  community: () => ipcRenderer.invoke('community'),
  reportingConfig: () => ipcRenderer.invoke('reporting-config'),
  sendDeviceReport: report => ipcRenderer.invoke('device-report',report),
  scanDevices: () => ipcRenderer.invoke('scan-devices'),
  delayEnvironment: () => ipcRenderer.invoke('delay-environment'),
  openMouseSettings: () => ipcRenderer.invoke('open-mouse-settings'),
  copyReport: text => ipcRenderer.invoke('copy-report', text),
  source: () => ipcRenderer.send('open-source'),
  updateState: () => ipcRenderer.invoke('update-state'),
  onUpdate: handler => ipcRenderer.on('update-state', (_, state) => handler(state)),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  restartUpdate: () => ipcRenderer.send('restart-update')
});
