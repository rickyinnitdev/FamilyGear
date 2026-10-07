const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
async function delayEnvironment(run=promisify(execFile)){
  const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $p=Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Mouse'; [PSCustomObject]@{acceleration=([int]$p.MouseSpeed -ne 0);pointerSpeed=[int]$p.MouseSensitivity}|ConvertTo-Json -Compress"],{windowsHide:true,timeout:5000,maxBuffer:4096});
  const value=JSON.parse(stdout.trim());if(typeof value.acceleration!=='boolean'||!Number.isInteger(value.pointerSpeed)||value.pointerSpeed<1||value.pointerSpeed>20)throw new Error('Windows pointer settings are unavailable.');
  return {acceleration:value.acceleration,pointerSpeed:value.pointerSpeed};
}
module.exports={delayEnvironment};
