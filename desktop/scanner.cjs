const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Read only device classes and USB IDs. Never return instance paths or serial numbers.
const scanScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$present = @(Get-PnpDevice -PresentOnly -ErrorAction Stop | Where-Object { $_.Status -eq 'OK' })
$inputIds = @{}
foreach ($device in $present) {
  if ($device.Class -in @('Mouse','Keyboard') -and $device.InstanceId -match '^(HID|USB)\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})') { $inputIds[$Matches[2] + ':' + $Matches[3]] = $true }
}
$rows = @($present | ForEach-Object {
  if ($_.Class -in @('Mouse','Keyboard','USB') -and $_.InstanceId -match '^(HID|USB)\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})' -and $inputIds.ContainsKey($Matches[2] + ':' + $Matches[3])) {
    $vendor = [Convert]::ToInt32($Matches[2],16)
    $product = [Convert]::ToInt32($Matches[3],16)
    $name = $_.FriendlyName
    $container = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_ContainerId' -ErrorAction SilentlyContinue
    if ($_.Class -eq 'USB') {
      $description = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue
      if ($description.Data -is [string] -and $description.Data) { $name = $description.Data }
    }
    [pscustomobject]@{ vendorId = $vendor; productId = $product; name = $name; deviceClass = $_.Class; containerId = [string]$container.Data }
  }
})
ConvertTo-Json -InputObject $rows -Compress
`;
function cleanDevices(value) {
  if (!Array.isArray(value)) throw new Error('Windows returned an invalid device list.');
  const groups = new Map();
  for (const item of value) {
    if (!Number.isInteger(item.vendorId) || item.vendorId < 0 || item.vendorId > 65535 || !Number.isInteger(item.productId) || item.productId < 0 || item.productId > 65535) continue;
    if (!['Mouse','Keyboard','USB'].includes(item.deviceClass)) continue;
    const name = typeof item.name === 'string' ? item.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160) : 'Unnamed device';
    const row = { vendorId: item.vendorId, productId: item.productId, name: name || 'Unnamed device', deviceClass: item.deviceClass };
    // Container ID is used only internally to avoid merging two identical physical devices.
    const container = typeof item.containerId === 'string' && /^[0-9a-f-]{36}$/i.test(item.containerId) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(item.containerId) ? item.containerId.toLowerCase() : '';
    const key = `${row.vendorId}:${row.productId}:${container}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].filter(rows => rows.some(row => row.deviceClass === 'Mouse' || row.deviceClass === 'Keyboard')).map(rows => {
    const descriptive = rows.find(row => row.deviceClass === 'USB' && !/^(USB (Composite|Input) Device|Unnamed device)$/i.test(row.name));
    const input = rows.find(row => row.deviceClass === 'Keyboard') || rows.find(row => row.deviceClass === 'Mouse');
    const keyboard = rows.some(row => row.deviceClass === 'Keyboard');
    const mouse = rows.some(row => row.deviceClass === 'Mouse');
    const name = descriptive?.name || input.name;
    const deviceClass = keyboard && mouse ? /\bmouse\b/i.test(name) ? 'Mouse' : 'Mouse / keyboard' : keyboard ? 'Keyboard' : 'Mouse';
    return { vendorId: input.vendorId, productId: input.productId, name, deviceClass };
  }).sort((a,b) => a.name.localeCompare(b.name)).slice(0, 100);
}
async function scanDevices(execute = run) {
  if (process.platform !== 'win32') throw new Error('Device scanning is available in the Windows app.');
  const { stdout } = await execute('powershell.exe', ['-NoProfile','-NonInteractive','-EncodedCommand', Buffer.from(scanScript, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: 512 * 1024, encoding: 'utf8' });
  return cleanDevices(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
}
module.exports = { cleanDevices, scanDevices };
