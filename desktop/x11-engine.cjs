const codec=require('./x11-codec.cjs');
const collections=require('./x11-collections.cjs');
function createEngine(HID,wait=ms=>new Promise(r=>setTimeout(r,ms)),resolveContainers=collections.windowsContainers){
let candidates=[],command,events,model=false,rows={},battery={},productId,connectionPhase=null;

async function close(){if(events&&events!==command)await events.close().catch(()=>{});if(command)await command.close().catch(()=>{});command=events=null;rows={};model=false;battery={};}
async function read(id,profile){let failure;for(let attempt=0;attempt<3;attempt++){try{await command.sendFeatureReport(Buffer.from([160,id,codec.lengths[id],0,profile,0,0,0]));await wait(300+attempt*200);const permission=await command.getFeatureReport(160,8);if(permission.length!==8||permission[0]!==160||permission[1]!==1)throw Error('Read permission was not granted. Wake the mouse and close other configurators.');return codec.check(Buffer.from(await command.getFeatureReport(id,codec.lengths[id])),id,profile);}catch(error){failure=error;}}throw Error('X11 '+({12:'profile',4:'DPI',5:'lighting',6:'polling',8:'buttons'}[id]??'settings')+' read failed: '+failure.message);}
async function snapshot(){if(!command||!model)throw Error('Connect an identified X11 first.');const next={12:await read(12,0)},p=next[12][2];for(const id of [4,5,6,8])next[id]=await read(id,p);const confirm=await read(12,0);if(!confirm.equals(next[12]))throw Error('X11 profile changed during the read. Refresh.');rows=next;return {...codec.status(rows),...battery,productId};}
async function run(op,args){
 if(op==='diagnostics')return {...collections.diagnostics(await HID.devicesAsync()),checks:connectionPhase?[{name:'interfaces',result:connectionPhase==='interfaces'?'failed':'passed'},{name:'settings-read',result:connectionPhase==='settings-read'?'failed':'not-tested'}]:[]};
 if(op==='list'){const all=await HID.devicesAsync();candidates=all.filter(d=>d.vendorId===0x1d57&&[0xfa55,0xfa60].includes(d.productId)&&d.interface===2&&d.usagePage===11);return candidates.map((d,i)=>({id:String(i),name:'X11-family '+(d.productId===0xfa55?'USB':'2.4 GHz')+' candidate',productId:d.productId}));}
 if(op==='close'){await close();return null;}
 if(op==='connect'){const d=candidates[Number(args[0])];if(!d||String(Number(args[0]))!==args[0])throw Error('Scan and choose a connected X11.');await close();connectionPhase='interfaces';const all=await HID.devicesAsync(),ev=await collections.eventCollection(d,all,resolveContainers);try{command=await HID.HIDAsync.open(d.path);events=ev.path===d.path?command:await HID.HIDAsync.open(ev.path);connectionPhase='model';productId=d.productId;events.on('error',()=>{model=false;});command.on('error',()=>{model=false;});events.on('data',b=>{if(b.length!==5||b[0]!==3)return;if(b[1]!==0x55){model=false;return;}model=true;if([64,65].includes(b[2])&&[1,2,3].includes(b[3])&&b[4]<=100)battery={batteryPercent:b[4],batteryState:({1:'Discharging',2:'Full',3:'Charging'})[b[3]]};});for(let i=0;i<40&&!model;i++)await wait(100);if(!model)throw Error('The receiver has not identified an X11. Move or wake the mouse, then retry.');connectionPhase='settings-read';const result=await snapshot();connectionPhase=null;return result;}catch(error){await close();throw error;}}
 if(op==='battery'){if(!model||!command)throw Error('X11 is disconnected.');return battery;}
 if(op==='read')return snapshot();
 if(!model||!command||!rows[12])throw Error('Read current X11 settings before editing.');
 const before=rows,profile=await read(12,0);if(!profile.equals(before[12]))throw Error('Profile changed. Refresh before applying.');const plan=codec.patch(before,op,args),current=await read(plan.id,plan.id===12?0:before[12][2]);if(!current.equals(before[plan.id]))throw Error('Settings changed since display. Refresh before applying.');rows={};await command.sendFeatureReport(plan.write);await wait(1000);const after=await read(plan.id,plan.id===12?0:before[12][2]);if(!after.equals(plan.expected))throw Error('X11 readback did not confirm the complete settings report. Refresh to inspect what applied.');return snapshot();
}
return {run,close};
}
module.exports={createEngine};
