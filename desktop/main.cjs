const { app, BrowserWindow, protocol, net, session, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { scanDevices } = require('./scanner.cjs');
const { delayEnvironment } = require('./delay.cjs');
const x11 = require('./x11.cjs');
app.on('before-quit',()=>x11.stop());
const { createUpdates } = require('./updates.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'familygear', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Family Gear');
let main, picker, pending, devices = [], closing = false, closeTimer;
let communityRepository = null;
let scanInFlight = null;
let updates, restarting = false, allowClose = false;
const trusted = url => { try { const u = new URL(url); return u.protocol === 'familygear:' && u.host === 'app'; } catch { return false; } };
function finish(id = '') { const callback = pending; pending = null; if (picker && !picker.isDestroyed()) picker.close(); picker = null; callback?.(id); }
app.whenReady().then(async () => {
  ipcMain.handle('x11', (event,op,args) => {if(event.sender!==main?.webContents||!trusted(event.sender.getURL()))throw new Error('Untrusted request.');return x11.request(op,args);});
  ipcMain.handle('delay-environment',event=>{if(event.sender!==main?.webContents||!trusted(event.sender.getURL()))throw new Error('Untrusted request.');return delayEnvironment();});
  ipcMain.handle('open-mouse-settings',event=>{if(event.sender!==main?.webContents||!trusted(event.sender.getURL()))throw new Error('Untrusted request.');return shell.openExternal('ms-settings:mousetouchpad');});
  protocol.handle('familygear', request => {
    const url = new URL(request.url);
    if (!trusted(request.url)) return new Response('Forbidden', { status: 403 });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const base = relative === 'desktop/chooser.html' || relative === 'desktop/chooser.js' ? app.getAppPath() : path.join(app.getAppPath(), 'dist');
    const file = path.resolve(base, relative);
    if (!file.startsWith(base + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => permission === 'hid' && contents === main?.webContents && trusted(origin));
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'hid' && contents === main?.webContents && trusted(contents.getURL())));
  session.defaultSession.on('select-hid-device', (event, details, callback) => {
    event.preventDefault(); finish(); pending = callback; devices = details.deviceList;
    picker = new BrowserWindow({ width: 540, height: 460, parent: main, modal: true, resizable: false, autoHideMenuBar: true, title: 'Add device — Family Gear', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    picker.webContents.on('did-finish-load', () => picker?.webContents.send('devices', devices));
    picker.on('closed', () => { picker = null; finish(); });
    picker.loadURL('familygear://app/desktop/chooser.html');
  });
  session.defaultSession.on('hid-device-added', (_, device) => { if (pending) { devices.push(device); picker?.webContents.send('devices', devices); } });
  session.defaultSession.on('hid-device-removed', (_, device) => { devices = devices.filter(d => d.deviceId !== device.deviceId); picker?.webContents.send('devices', devices); });
  ipcMain.on('choose-device', (event, id) => { if (event.sender === picker?.webContents) finish(devices.some(d => d.deviceId === id) ? id : ''); });
  ipcMain.on('open-source', event => { if (event.sender === main?.webContents) shell.openPath(fs.existsSync(path.join(process.resourcesPath, 'Family-Gear-source.zip')) ? process.resourcesPath : path.dirname(app.getPath('exe'))); });
  ipcMain.handle('scan-devices', event => {
    if (event.sender !== main?.webContents || !trusted(event.sender.getURL())) throw new Error('Untrusted scan request.');
    if (!scanInFlight) scanInFlight = scanDevices().finally(() => { scanInFlight = null; });
    return scanInFlight;
  });
  ipcMain.handle('copy-report', (event, text) => {
    if (event.sender !== main?.webContents || !trusted(event.sender.getURL()) || typeof text !== 'string' || text.length > 32000) throw new Error('Invalid report.');
    clipboard.writeText(text);
  });
  ipcMain.handle('community', event => event.sender === main?.webContents ? communityRepository : null);
  ipcMain.handle('update-state', event => event.sender === main?.webContents ? updates?.state() ?? { phase: 'unconfigured', text: 'Updates need a download address.' } : null);
  ipcMain.on('check-updates', event => { if (event.sender === main?.webContents) void updates?.check(); });
  ipcMain.on('restart-update', event => { if (event.sender === main?.webContents && !closing && updates?.state().phase === 'ready') { restarting = true; main.close(); } });
  ipcMain.on('closed-devices', (event, error) => {
    if (event.sender !== main?.webContents || !closing) return;
    clearTimeout(closeTimer);
    if (restarting) {
      if (error) { closing = restarting = false; dialog.showMessageBox(main, { message: 'Finish device changes and exit live travel or calibration before updating.', detail: String(error) }); return; }
      allowClose = true;
      if (!updates.install()) allowClose = closing = restarting = false;
      return;
    }
    if (error) dialog.showErrorBox('Device cleanup', 'Unplug and reconnect your keyboard before using it again. ' + error);
    main.destroy();
  });
  main = new BrowserWindow({ icon: path.join(app.getAppPath(), 'desktop/icon.png'), width: 1380, height: 920, minWidth: 900, minHeight: 650, backgroundColor: '#101312', autoHideMenuBar: true, title: 'Family Gear', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  main.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); else if (trusted(url)) net.fetch(url).then(r => r.text()).then(text => dialog.showMessageBox(main, { title: 'License', message: 'Family Gear license', detail: text })); return { action: 'deny' }; });
  main.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  main.on('close', event => {
    if (allowClose) return;
    event.preventDefault(); if (closing) return; closing = true; finish();
    main.webContents.send('closing', restarting ? 'update' : 'quit');
    closeTimer = setTimeout(() => {
      if (restarting) { closing = restarting = false; dialog.showMessageBox(main, { message: 'Update postponed. Device cleanup did not finish; restart after your device session ends.' }); return; }
      dialog.showErrorBox('Device cleanup timed out', 'Unplug and reconnect your keyboard if a calibration or live travel session was active.'); main.destroy();
    }, 15000);
  });
  const configPath = path.join(process.resourcesPath, 'family-gear-updates.json');
  if (app.isPackaged && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    communityRepository = require('./community.cjs').repository(config.repository);
    if (config.url) {
      const { autoUpdater } = require('./updater-runtime.cjs');
      updates = createUpdates(autoUpdater, config.url, state => { if (main && !main.isDestroyed()) main.webContents.send('update-state', state); });
    }
  }
  await main.loadURL('familygear://app/');
  if (updates) { setTimeout(() => void updates.check(), 10000).unref(); setInterval(() => void updates.check(), 4 * 60 * 60 * 1000).unref(); }
});
app.on('window-all-closed', () => app.quit());
