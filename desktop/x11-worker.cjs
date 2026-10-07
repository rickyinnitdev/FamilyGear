const {parentPort}=require('node:worker_threads');
const engine=require('./x11-engine.cjs').createEngine(require('node-hid'));
let queue=Promise.resolve();parentPort.on('message',({id,op,args})=>{queue=queue.then(async()=>{try{parentPort.postMessage({id,value:await engine.run(op,args)});}catch(error){
  // Native transport errors can contain HID paths and serial identifiers.
  const message=String(error.message),safe=/^(X11|The receiver|Connect an|Read current|Settings changed|Profile changed|Choose |Unsupported |Invalid RGB|Invalid toggle|Scan and|Unrecognized )/.test(message)&&!message.includes('\\\\');
  parentPort.postMessage({id,error:safe?message:'Could not access the X11 HID interface. Close other configurators and reconnect.'});
}});});
