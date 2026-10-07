const {Worker}=require('node:worker_threads');
const path=require('node:path');
let worker,sequence=0;const pending=new Map();
const allowed=new Set(['list','diagnostics','connect','close','read','battery','dpi','stage','active','color','polling','motion','angle','ripple','lod','debounce','sleep','lighting','profile','button']);
// Metadata discovery can take 30 seconds; connection still needs model identity
// and all settings afterwards. Its outer deadline must cover the complete work.
const requestTimeout=op=>op==='connect'?60000:30000;
function stop(){worker?.terminate();worker=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('X11 connection stopped.'));}pending.clear();}
function request(op,args=[]){if(!allowed.has(op)||!Array.isArray(args)||args.length>5||args.some(v=>!['string','number','boolean'].includes(typeof v))||JSON.stringify(args).length>300)throw Error('Invalid X11 request.');if(!worker){worker=new Worker(path.join(__dirname,'x11-worker.cjs'));worker.on('message',r=>{const p=pending.get(r.id);if(!p)return;clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.value);});const current=worker;worker.on('error',()=>{if(worker===current)stop();});worker.on('exit',()=>{if(worker===current)stop();});}return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{stop();reject(Error('X11 request timed out. Reconnect and refresh.'));},requestTimeout(op));pending.set(id,{resolve,reject,timer});worker.postMessage({id,op,args});});}
module.exports={request,stop,requestTimeout};


