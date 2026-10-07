const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
const isX11=d=>d.vendorId===0x1d57&&[0xfa55,0xfa60].includes(d.productId);
// Used only to look up the exact Windows PnP instance. Never used as a guessed
// physical identity, and never returned to renderer diagnostics/reports.
function instanceFromPath(path){if(typeof path!=='string')return null;const m=/^\\\\\?\\hid#([^#]+)#([^#]+)#\{[0-9a-f-]{36}\}$/i.exec(path);return m?`HID\\${m[1]}\\${m[2]}`.toUpperCase():null;}
const script=String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$devices = @(Get-PnpDevice -PresentOnly -ErrorAction Stop | Where-Object { $_.InstanceId -match '^HID\\VID_1D57&PID_(FA55|FA60)' })
$rows = @($devices | ForEach-Object {
  $container = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_ContainerId' -ErrorAction SilentlyContinue
  [pscustomobject]@{ instanceId = $_.InstanceId; containerId = [string]$container.Data }
})
ConvertTo-Json -InputObject $rows -Compress
`;
function containerMap(devices,rows){const byInstance=new Map();for(const row of Array.isArray(rows)?rows:[]){if(typeof row.instanceId!=='string'||typeof row.containerId!=='string')continue;const id=row.containerId.toLowerCase();if(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)&&id!=='00000000-0000-0000-0000-000000000000')byInstance.set(row.instanceId.toUpperCase(),id);}return new Map(devices.filter(isX11).flatMap(d=>{const id=byInstance.get(instanceFromPath(d.path));return id?[[d.path,id]]:[];}));}
async function windowsContainers(devices,run=execute){if(process.platform!=='win32'||!devices.some(d=>instanceFromPath(d.path)))return new Map();try{const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,maxBuffer:256*1024,encoding:'utf8'});return containerMap(devices,JSON.parse(stdout.replace(/^\uFEFF/,'').trim()));}catch{return new Map();}}
async function eventCollection(command,devices,resolve=windowsContainers){const candidates=devices.filter(d=>d.vendorId===command.vendorId&&d.productId===command.productId&&d.usagePage===0x0a);
 const paths=await resolve([command,...candidates]),container=paths.get(command.path);
 // Prefer the OS physical-device group; do not associate two identical mice
 // merely because they have the same VID/PID or appear next to each other.
 const grouped=container?candidates.filter(d=>paths.get(d.path)===container):[];
 if(grouped.length===1)return grouped[0];if(grouped.length>1)throw Error('X11 has multiple event interfaces in one device group. Copy X11 connection details for review.');
 const key=p=>typeof p==='string'?p.replace(/&col[0-9a-f]+/ig,'').toLowerCase():'';
 const exact=candidates.filter(d=>(d.interface===2||d.interface===-1||d.interface==null)&&(!container||!paths.get(d.path)||paths.get(d.path)===container)&&key(d.path)&&key(d.path)===key(command.path));if(exact.length===1)return exact[0];
 throw Error('X11 event interface unavailable. Close other mouse drivers, reconnect the receiver, or try wired USB. Use Copy X11 connection details to report its interface layout.');
}
function diagnostics(devices){return {format:'family-gear-x11-connection-v1',interfaces:devices.filter(isX11).slice(0,64).map(d=>({vendorId:d.vendorId,productId:d.productId,interface:Number.isInteger(d.interface)?d.interface:null,usagePage:Number.isInteger(d.usagePage)?d.usagePage:null,usage:Number.isInteger(d.usage)?d.usage:null})),note:'Read-only interface inventory. No paths, serial numbers, device-container IDs or computer identifiers.'};}
module.exports={instanceFromPath,containerMap,windowsContainers,eventCollection,diagnostics};
