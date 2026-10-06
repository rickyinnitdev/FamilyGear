import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { cleanDevices, scanDevices } = createRequire(import.meta.url)('../desktop/scanner.cjs');
test('scanner exposes only device names/classes/USB IDs, deduplicates, and drops invalid rows', () => {
  const row = { vendorId: 0x41e4, productId: 0x2103, name: 'Ace 60 Pro', deviceClass: 'Keyboard', serialNumber: 'secret', instanceId: 'USB\\private', username: 'private' };
  assert.deepEqual(cleanDevices([row, row, { ...row, vendorId: -1 }, { ...row, deviceClass: 'DiskDrive' }]), [{ vendorId: 0x41e4, productId: 0x2103, name: 'Ace 60 Pro', deviceClass: 'Keyboard' }]);
  assert.throws(() => cleanDevices({}));
});
test('scanner runs only a bounded, hidden, read-only Windows enumeration and propagates failure', async () => {
  if (process.platform !== 'win32') return;
  const rows = await scanDevices(async (command: string, args: string[], options: { timeout: number; windowsHide: boolean }) => {
    assert.equal(command, 'powershell.exe'); assert.equal(options.windowsHide, true); assert.equal(options.timeout, 20000);
    const script = Buffer.from(args[args.length - 1], 'base64').toString('utf16le');
    assert.match(script, /Get-PnpDevice -PresentOnly/); assert.doesNotMatch(script, /Set-|Disable-|Enable-|sendReport|serialNumber/);
    return { stdout: '[]' };
  });
  assert.deepEqual(rows, []);
  await assert.rejects(scanDevices(async () => { throw new Error('timeout'); }));
});
