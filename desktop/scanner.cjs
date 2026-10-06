const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Read only device classes and USB IDs. Never return instance paths or serial numbers.
const scanScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$rows = @(Get-PnpDevice -PresentOnly -ErrorAction Stop | ForEach-Object {
  if ($_.Class -in @('Mouse','Keyboard','HIDClass','USB') -and $_.InstanceId -match '^(HID|USB)\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})') {
    $vendor = [Convert]::ToInt32($Matches[2],16)
    $product = [Convert]::ToInt32($Matches[3],16)
    $name = $_.FriendlyName
    if ($_.Class -eq 'USB') {
      $description = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue
      if ($description.Data -is [string] -and $description.Data) { $name = $description.Data }
    }
    [pscustomobject]@{ vendorId = $vendor; productId = $product; name = $name; deviceClass = $_.Class }
  }
})
ConvertTo-Json -InputObject $rows -Compress
`;
function cleanDevices(value) {
  if (!Array.isArray(value)) throw new Error('Windows returned an invalid device list.');
  const rows = new Map();
  const inputIds = new Set(value.filter(item => ['Mouse','Keyboard','HIDClass'].includes(item.deviceClass)).map(item => `${item.vendorId}:${item.productId}`));
  for (const item of value) {
    if (!Number.isInteger(item.vendorId) || item.vendorId < 0 || item.vendorId > 65535 || !Number.isInteger(item.productId) || item.productId < 0 || item.productId > 65535) continue;
    if (!['Mouse','Keyboard','HIDClass','USB'].includes(item.deviceClass)) continue;
    if (item.deviceClass === 'USB' && !inputIds.has(`${item.vendorId}:${item.productId}`)) continue;
    const name = typeof item.name === 'string' ? item.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160) : 'Unnamed device';
    const row = { vendorId: item.vendorId, productId: item.productId, name: name || 'Unnamed device', deviceClass: item.deviceClass };
    rows.set(`${row.vendorId}:${row.productId}:${row.deviceClass}:${row.name}`, row);
  }
  return [...rows.values()].sort((a,b) => a.name.localeCompare(b.name)).slice(0, 100);
}
async function scanDevices(execute = run) {
  if (process.platform !== 'win32') throw new Error('Device scanning is available in the Windows app.');
  const { stdout } = await execute('powershell.exe', ['-NoProfile','-NonInteractive','-EncodedCommand', Buffer.from(scanScript, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: 512 * 1024, encoding: 'utf8' });
  return cleanDevices(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
}
module.exports = { cleanDevices, scanDevices };
