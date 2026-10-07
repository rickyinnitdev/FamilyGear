import test from 'node:test';
import assert from 'node:assert/strict';
test('connection smoke checks repeat reads, serialize delivery and exclude private hardware fields',async()=>{
 const store=new Map<string,string>([['family-gear-automatic-reports-v1','yes']]);
 Object.assign(globalThis,{localStorage:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)},window:{familyGear:{reportingConfig:async()=>({configured:true}),sendDeviceReport:async(report:unknown)=>{sent.push(report);await new Promise(r=>setTimeout(r,5));return {sent:true};}}}});
 const sent:unknown[]=[];const smoke=await import('../src/device-smoke');let reads=0;
 await smoke.smokeDevice('mouse',{vendorId:123,productId:456,serialNumber:'private'} as any,{dpi:1600,pollingRateHz:1000},async()=>{reads++;return {dpi:1600,pollingRateHz:1000,serialNumber:'private'};});
 await Promise.all([smoke.sendPending(),smoke.sendPending()]);await new Promise(r=>setTimeout(r,30));
 assert.equal(reads,1);assert.equal(sent.length,1);assert.equal(JSON.stringify(sent).includes('private'),false);
 assert.ok((sent[0] as any).checks.some((c:any)=>c.name==='physical-behavior'&&c.result==='not-tested'));
 assert.deepEqual(JSON.parse(store.get('family-gear-automatic-reports-v1-pending')!),[]);
});
