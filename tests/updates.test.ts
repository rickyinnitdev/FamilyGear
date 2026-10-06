import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { createUpdates, updateAddress } = createRequire(import.meta.url)('../desktop/updates.cjs');
class FakeUpdater extends EventEmitter {
  checks = 0; installs = 0; feed: unknown;
  autoDownload = false; autoInstallOnAppQuit = true; allowDowngrade = true; allowPrerelease = true;
  setFeedURL(feed: unknown) { this.feed = feed; }
  async checkForUpdates() { this.checks++; this.emit('checking-for-update'); this.emit('update-not-available'); }
  quitAndInstall(silent: boolean, restart: boolean) { assert.equal(silent, true); assert.equal(restart, true); this.installs++; }
}
test('updates require a configured HTTPS folder and never silently use a placeholder', async () => {
  assert.equal(updateAddress(''), null);
  assert.equal(updateAddress('https://example.com/gear'), 'https://example.com/gear/');
  for (const url of ['http://example.com/', 'file:///C:/app', 'https://user:password@example.com/', 'https://example.com/?token=x']) assert.throws(() => updateAddress(url));
  const updater = new FakeUpdater();
  const manager = createUpdates(updater, null, () => {});
  await manager.check(); assert.equal(updater.checks, 0); assert.equal(manager.state().phase, 'unconfigured');
});
test('automatic downloads do not install on ordinary app exit; installation requires a downloaded update', async () => {
  const updater = new FakeUpdater(); const events: string[] = [];
  const manager = createUpdates(updater, 'https://example.com/gear/', (state: { phase: string }) => events.push(state.phase));
  assert.equal(updater.autoDownload, true); assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false); assert.equal(updater.allowPrerelease, false);
  assert.equal(manager.install(), false); assert.equal(updater.installs, 0);
  await manager.check(); assert.equal(manager.state().phase, 'current');
  updater.emit('update-available', { version: '0.3.0' });
  updater.emit('download-progress', { percent: 40.4 }); assert.equal(manager.state().percent, 40);
  await manager.check(); assert.equal(updater.checks, 1);
  updater.emit('update-downloaded', { version: '0.3.0' }); assert.equal(manager.state().phase, 'ready');
  await manager.check(); assert.equal(updater.checks, 1);
  assert.equal(manager.install(), true); assert.equal(updater.installs, 1);
  assert.ok(events.includes('downloading'));
});
test('failed checks are recoverable and concurrent checks are suppressed', async () => {
  const updater = new FakeUpdater(); let finish: () => void = () => {};
  updater.checkForUpdates = () => { updater.checks++; return new Promise<void>(resolve => { finish = resolve; }); };
  const manager = createUpdates(updater, 'https://example.com/gear/', () => {});
  const checking = manager.check(); await manager.check(); assert.equal(updater.checks, 1); finish(); await checking;
  updater.emit('error', new Error('Network unavailable')); assert.equal(manager.state().phase, 'error');
  updater.checkForUpdates = async () => { updater.checks++; updater.emit('update-not-available'); };
  await manager.check(); assert.equal(manager.state().phase, 'current');
});
