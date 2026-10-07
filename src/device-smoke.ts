export type SmokeCheck={name:string;result:'passed'|'failed'|'unavailable'|'not-tested'};
export type SmokeReport={id:string;format:'family-gear-smoke-v1';version:string;type:'mouse'|'keyboard';vendorId:number;productId:number;checks:SmokeCheck[];interfaces?:unknown[]};
const VERSION='0.2.18',KEY='family-gear-automatic-reports-v1';
let consent=localStorage.getItem(KEY)==='yes',preference:Promise<boolean>|null=null;
let queue:SmokeReport[]=[];try{const saved=JSON.parse(localStorage.getItem(KEY+'-pending')??'[]');if(Array.isArray(saved))queue=saved.slice(-8);}catch{}
function save(){localStorage.setItem(KEY+'-pending',JSON.stringify(queue));}
async function allow(){
 if(consent)return true;if(localStorage.getItem(KEY)==='no')return false;if(preference)return preference;
 preference=new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Automatic device reports</h2><p>Help improve Family Gear. After adding a device, the app can automatically send read-only test results to the developer’s Google Forms inbox. No GitHub account is needed.</p><p>Reports include app version, device USB IDs, interface numbers and which settings reads passed or failed. They exclude serials, USB paths, computer/user names, typed keys, raw packets and browsing data. Google Forms receives normal network metadata. These checks do not change device settings or verify physical buttons, RGB or delay.</p><p>You can turn reporting off and delete queued reports from Device reports.</p><button class="primary" data-yes>Agree & enable reports</button><button class="secondary" data-no>Use app without reporting</button>';document.body.append(dialog);const finish=(ok:boolean)=>{consent=ok;localStorage.setItem(KEY,ok?'yes':'no');resolve(ok);dialog.close();};dialog.querySelector('[data-yes]')!.addEventListener('click',()=>finish(true));dialog.querySelector('[data-no]')!.addEventListener('click',()=>finish(false));dialog.addEventListener('cancel',()=>finish(false));dialog.addEventListener('close',()=>{dialog.remove();preference=null;},{once:true});dialog.showModal();});return preference;
}
let sending=false,retry:ReturnType<typeof setTimeout>|undefined,failures=0;
export async function sendPending(){
 if(sending||!consent||!window.familyGear||!queue.length)return;
 sending=true;let configured=false;
 try{const config=await window.familyGear.reportingConfig();configured=config.configured;if(!configured)return;
  while(consent&&queue.length){const report=queue[0];const result=await window.familyGear.sendDeviceReport(report);if(!result.sent){failures++;break;}const index=queue.indexOf(report);if(index>=0)queue.splice(index,1);save();failures=0;}
 }catch{failures++;}finally{sending=false;if(configured&&consent&&queue.length&&!retry){retry=setTimeout(()=>{retry=undefined;void sendPending();},Math.min(300000,15000*2**Math.min(failures,4)));}}
}
export async function smokeDevice(type:'mouse'|'keyboard',device:{vendorId:number;productId:number},first:unknown,read:()=>Promise<unknown>){
 const checks:SmokeCheck[]=[{name:'connection',result:'passed'},{name:'settings-read',result:'passed'}];
 let repeat:unknown;try{repeat=await read();checks.push({name:'repeat-read',result:'passed'});}catch{checks.push({name:'repeat-read',result:'failed'});}
 const status={...(first??{}),...(repeat??{})} as Record<string,unknown>;const check=(name:string,available:boolean)=>checks.push({name,result:available?'passed':'unavailable'});
 if(type==='mouse'){check('dpi-read',typeof status.dpi==='number');check('polling-read',typeof status.pollingRateHz==='number'&&status.pollingReadVerified!==false);check('battery-read',typeof status.batteryPercent==='number');check('lighting-read',Boolean(status.lighting));}
 else {check('polling-read',status.pollingWritable===true);check('lighting-read',Boolean(status.light||status.lighting));check('trigger-read',Array.isArray(status.keys)&&status.keys.length>0||status.travel instanceof Map&&status.travel.size>0);}
 checks.push({name:'physical-behavior',result:'not-tested'});await collect({id:crypto.randomUUID(),format:'family-gear-smoke-v1',version:VERSION,type,vendorId:device.vendorId,productId:device.productId,checks});
}
export async function failedConnection(type:'mouse'|'keyboard',device:{vendorId:number;productId:number},interfaces?:unknown[],diagnostics?:SmokeCheck[]){const extra=(Array.isArray(diagnostics)?diagnostics:[]).filter(c=>['interfaces','settings-read'].includes(c.name)&&['passed','failed','not-tested'].includes(c.result)).slice(0,2);await collect({id:crypto.randomUUID(),format:'family-gear-smoke-v1',version:VERSION,type,vendorId:device.vendorId,productId:device.productId,checks:[{name:'connection',result:'failed'},...extra,{name:'physical-behavior',result:'not-tested'}],interfaces});}
async function collect(report:SmokeReport){try{
 if(!await allow())return;
 const stamp=KEY+`-${report.version}-${report.vendorId}-${report.productId}-${report.checks[0].result}-${new Date().toISOString().slice(0,10)}`;
 if(localStorage.getItem(stamp)){void sendPending().catch(()=>{});return;}localStorage.setItem(stamp,'queued');queue.push(report);queue=queue.slice(-8);save();void sendPending().catch(()=>{});
}catch{/* Diagnostics must never turn a hardware connection into a failure. */}}
export async function openDeviceReports(){const config=await window.familyGear?.reportingConfig();const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Device reports</h2><p data-status></p><label><input type="checkbox" data-enabled/> Automatically send read-only reports</label><p>Friends never need a GitHub login. You can disable reporting and delete queued reports here.</p><button class="secondary" data-delete>Delete queued reports</button><button class="secondary" data-close>Close</button>';document.body.append(dialog);const status=dialog.querySelector('[data-status]')!,enabled=dialog.querySelector<HTMLInputElement>('[data-enabled]')!;const update=()=>{status.textContent=`${config?.configured?'Inbox configured.':'Inbox not configured yet; reports stay on this computer.'} ${queue.length} queued report(s).`;enabled.checked=consent;};update();enabled.onchange=()=>{if(enabled.checked){localStorage.removeItem(KEY);void allow().then(update);}else{consent=false;localStorage.setItem(KEY,'no');update();}};dialog.querySelector('[data-delete]')!.addEventListener('click',()=>{queue=[];save();update();});dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();}
