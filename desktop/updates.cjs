function updateAddress(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use a plain HTTPS folder address.');
  return url.href.replace(/\/?$/, '/');
}
function createUpdates(updater, address, publish) {
  let state = { phase: 'unconfigured', text: 'Updates need a download address.' };
  let checking = false;
  const set = patch => { state = { ...patch }; publish(state); };
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.on('checking-for-update', () => set({ phase: 'checking', text: 'Checking for updates…' }));
  updater.on('update-not-available', () => set({ phase: 'current', text: 'You’re up to date.' }));
  updater.on('update-available', info => set({ phase: 'downloading', version: info.version, text: 'Downloading update…' }));
  updater.on('download-progress', progress => set({ phase: 'downloading', percent: Math.round(progress.percent), text: `Downloading update · ${Math.round(progress.percent)}%` }));
  updater.on('update-downloaded', info => set({ phase: 'ready', version: info.version, text: 'Restart to update' }));
  updater.on('error', () => set({ phase: 'error', text: 'Couldn’t get updates. Try again later.' }));
  const url = updateAddress(address);
  if (url) { updater.setFeedURL({ provider: 'generic', url }); set({ phase: 'idle', text: 'Check for updates' }); }
  return {
    state: () => ({ ...state }),
    async check() {
      if (!url || checking || ['downloading', 'ready'].includes(state.phase)) return;
      checking = true;
      try { await updater.checkForUpdates(); }
      catch { set({ phase: 'error', text: 'Couldn’t get updates. Try again later.' }); }
      finally { checking = false; }
    },
    install() { if (state.phase !== 'ready') return false; updater.quitAndInstall(true, true); return true; }
  };
}
module.exports = { updateAddress, createUpdates };
