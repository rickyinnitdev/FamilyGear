import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AceClient } from '../src/devices/ace.ts';
import { checksum } from '../src/devices/ace-codec.ts';

class MockKeyboard extends EventTarget {
  vendorId = 0x41e4;
  productId = 0x2101;
  productName = 'MCHOSE';
  opened = false;
  reports: Uint8Array[] = [];
  corruptReadback = false;
  firmware = 0x18;
  base = new Uint8Array([0, 1, 0, 0, 0, 0]);
  settings = new Uint8Array(256);
  proTravel = new Uint8Array(4096);
  physical = new Uint8Array(384);
  mappings = new Uint8Array(8192);
  tgl = new Uint8Array(512);
  mt = new Uint8Array(1024);
  dks = new Uint8Array(3072);
  travel = new Uint8Array(1024);
  collections = [{ outputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }], children: [] }];
  constructor() { super(); for(let i=0;i<512;i++) this.proTravel.set([0xa0,1,149,0,29,0,29,0],i*8); for(let i=0;i<60;i++)this.physical.set([16,0,i+4],i*3); for(let i=0;i<16;i++)this.mappings.set(this.physical,i*512); this.settings.set([0xaa,0xbb],2); this.settings[8]=3; this.settings[9]=4; this.settings[14]=255; this.travel.set([0xa6, 0x11, 49, 0x42, 9, 0x24, 9, 0x66], 24); }
  async open() { this.opened = true; }
  async close() { this.opened = false; }
  async sendReport(_id: number, buffer: ArrayBuffer) {
    const request = new Uint8Array(buffer); this.reports.push(request.slice());
    const reply = request.slice(); reply[0] = 0xaa;
    const offset = request[5] | (request[6] << 8), size = request[4];
    if (request[1] === 3) { reply[8] = this.firmware; reply[9] = 1; }
    if (request[1] === 4) reply.set(this.base, 8);
    if (request[1] === 5) reply.set(this.settings.subarray(offset, offset + size), 8);
    if (request[1] === 6 && !this.corruptReadback) this.settings.set(request.subarray(8, 8 + size), offset);
    if (request[1] === 0xa0) reply.set((this.productId===0x2103?this.proTravel:this.travel).subarray(offset, offset + size), 8);
    if (request[1] === 0xa1 && !this.corruptReadback) (this.productId===0x2103?this.proTravel:this.travel).set(request.subarray(8, 8 + size), offset);
    if(request[1]===7)reply.set(this.physical.subarray(offset,offset+size),8);
    if(request[1]===8)reply.set(this.mappings.subarray(offset,offset+size),8);
    if(request[1]===9&&!this.corruptReadback)this.mappings.set(request.subarray(8,8+size),offset);
    if(request[1]===0xa4)reply.set(this.mt.subarray(offset,offset+size),8);
    if(request[1]===0xa2)reply.set(this.dks.subarray(offset,offset+size),8);
    if(request[1]===0xa5&&!this.corruptReadback)this.mt.set(request.subarray(8,8+size),offset);
    if(request[1]===0xa3&&!this.corruptReadback)this.dks.set(request.subarray(8,8+size),offset);
    if(request[1]===0xa6)reply.set(this.tgl.subarray(offset,offset+size),8);
    if(request[1]===0xa7&&!this.corruptReadback)this.tgl.set(request.subarray(8,8+size),offset);
    reply[3] = checksum(reply);
    queueMicrotask(() => { const event = new Event('inputreport'); Object.assign(event, { data: new DataView(reply.buffer), reportId: 0 }); this.dispatchEvent(event); });
  }
  hid() { return this as unknown as HIDDevice; }
}

test('connect and read never issue writes; successful edits require confirmed readback', async () => {
  const device = new MockKeyboard();
  const { client, status } = await AceClient.connect(device.hid());
  assert.equal(status.keys.length, 1); assert.ok(status.canWrite);
  assert.ok(device.reports.every(r => r[1] === 3 || r[1] === 0xa0));
  const result = await client.applyTravel(status.raw!, [3], { actuation: 1.2, press: 0.2, release: 0.2 });
  assert.equal(result[26], 59);
  assert.equal(device.reports.filter(r => r[1] === 0xa1).length, 1);
  await client.close(); assert.equal(device.opened, false);
});
test('stale configuration is rejected before any write', async () => {
  const device = new MockKeyboard(); const { client, status } = await AceClient.connect(device.hid());
  device.travel[26] = 99;
  await assert.rejects(client.applyTravel(status.raw!, [3], { actuation: 1.2, press: 0.2, release: 0.2 }), /settings changed/);
  assert.equal(device.reports.filter(r => r[1] === 0xa1).length, 0); await client.close();
});
test('acknowledged writes without matching readback are failures', async () => {
  const device = new MockKeyboard(); const { client, status } = await AceClient.connect(device.hid()); device.corruptReadback = true;
  await assert.rejects(client.applyTravel(status.raw!, [3], { actuation: 1.2, press: 0.2, release: 0.2 }), /Readback differs/); await client.close();
});
test('Pro detection reads its own profile layout and refuses base-model writes', async () => {
  const device = new MockKeyboard(); device.productId = 0x2103;
  const { client, status } = await AceClient.connect(device.hid());
  assert.equal(status.name, 'MCHOSE Ace 60 Pro'); assert.equal(status.profile, 1); assert.equal(status.canWrite, false);
  assert.deepEqual(device.reports.map(r => r[1]), [3, 4, 5, 5, 5, 5, 5]);
  await assert.rejects(client.applyTravel(device.travel, [3], { actuation: 1.2, press: 0.2, release: 0.2 }), /read-only/);
  assert.ok(device.reports.every(r => r[1] !== 0xa1)); await client.close();
});

test('Pro lighting updates only the main-light range and confirms the whole settings block', async () => {
  const device = new MockKeyboard(); device.productId = 0x2103;
  const { client, status } = await AceClient.connect(device.hid());
  assert.equal(status.canWriteLighting, true);
  const before = device.settings.slice();
  const result = await client.applyLighting(status.lightingSnapshot!, { effect: 4, color: '#123456', rainbow: false });
  assert.equal(result[8], 4); assert.deepEqual(Array.from(result.slice(14,17)), [0x12,0x34,0x56]);
  result.forEach((b,i) => { if (![8,12,14,15,16].includes(i)) assert.equal(b,before[i]); });
  const writes = device.reports.filter(r => r[1] === 6);
  assert.equal(writes.length,1); assert.equal(writes[0][5],8); assert.equal(writes[0][4],9);
  await client.close();
});

test('Pro lighting rejects stale profiles and firmware before writing', async () => {
  const device = new MockKeyboard(); device.productId = 0x2103;
  const { client, status } = await AceClient.connect(device.hid());
  device.base[0]=1;
  await assert.rejects(client.applyLighting(status.lightingSnapshot!, { effect:3,color:'#ff0000',rainbow:false }), /profile changed/);
  assert.equal(device.reports.filter(r => r[1] === 6).length,0);
  device.firmware=0x19;
  await assert.rejects(client.applyLighting(status.lightingSnapshot!, { effect:3,color:'#ff0000',rainbow:false }), /Firmware changed/);
  await client.close();
});

test('Pro lighting never reports success for an ACK without changed settings', async () => {
  const device = new MockKeyboard(); device.productId = 0x2103;
  const { client, status } = await AceClient.connect(device.hid()); device.corruptReadback=true;
  await assert.rejects(client.applyLighting(status.lightingSnapshot!, { effect:3,color:'#00ff00',rainbow:false }), /readback differs/);
  await client.close();
});

test('brightness, animation speed and Win lock preserve unrelated profile bytes', async()=>{
  const device=new MockKeyboard();device.productId=0x2103;device.settings[6]=0xa6;
  const {client,status}=await AceClient.connect(device.hid());
  const lit=await client.applyLighting(status.lightingSnapshot!,{effect:22,color:'#123456',rainbow:true,brightness:2,speed:1});
  assert.equal(lit[9],2);assert.equal(lit[10],3);assert.equal(lit[6],0xa6);
  const locked=await client.setWinLock({...status.lightingSnapshot!,settings:lit},true);
  assert.equal(locked[6],0xa7);locked.forEach((v,i)=>{if(i!==6)assert.equal(v,lit[i]);});
  await client.close();
});

test('Pro trigger edits address the active profile and preserve all unselected records',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;device.base[2]=2;device.settings.set([0xaa,0xbb],130);
  const {client,status}=await AceClient.connect(device.hid());const data=await client.loadProKeys(status.lightingSnapshot!);
  assert.equal(data.keys.length,60);const before=device.proTravel.slice();
  const result=await client.applyProTrigger(data,[8],{actuation:1.2,press:.2,release:.25,mode:2,pressDeadzone:.1,releaseDeadzone:.15});
  assert.equal(result.travel[8*8+2],119);assert.equal(result.travel[8*8+1],2);
  assert.equal(result.travel[8*8+5],20);assert.equal(result.travel[8*8+7],30);
  const writes=device.reports.filter(r=>r[1]===0xa1);assert.equal(writes.length,1);
  assert.equal(writes[0][5]|writes[0][6]<<8,2048+64);assert.equal(writes[0][4],8);
  device.proTravel.forEach((v,i)=>{if(i<2112||i>=2120)assert.equal(v,before[i]);});await client.close();
});

test('Pro remapping writes only one binding in the selected profile and layer',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;device.base[2]=1;device.settings.set([0xaa,0xbb],66);
  const {client,status}=await AceClient.connect(device.hid());const data=await client.loadProKeys(status.lightingSnapshot!,3),before=device.mappings.slice();
  const result=await client.applyProMapping(data,8,225);
  assert.deepEqual(Array.from(result.mappings.slice(24,27)),[16,2,0]);
  const writes=device.reports.filter(r=>r[1]===9);assert.equal(writes.length,1);assert.equal(writes[0][5]|writes[0][6]<<8,7*512+24);
  device.mappings.forEach((v,i)=>{if(i<3608||i>=3611)assert.equal(v,before[i]);});await client.close();
});

test('Pro key writes reject stale data, advanced trigger modes and missing readback',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const data=await client.loadProKeys(status.lightingSnapshot!);
  device.proTravel[0]=0xa1;
  await assert.rejects(client.applyProTrigger(data,[0],{actuation:1,press:.2,release:.2,mode:1,pressDeadzone:0,releaseDeadzone:0}),/data changed/);
  assert.equal(device.reports.filter(r=>r[1]===0xa1).length,0);
  device.proTravel[0]=0xa0;device.corruptReadback=true;
  await assert.rejects(client.applyProMapping(data,8,225),/readback differs/);await client.close();
});

test('Pro performance preserves sampling and unknown bits, and enables the profile Mac layer',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;device.base[2]=1;device.settings.set([0xaa,0xbb],66);device.settings[65]=0xa5;device.settings[68]=0xb3;device.settings[71]=0x19;
  const {client,status}=await AceClient.connect(device.hid());const before=device.settings.slice();
  const confirmed=await client.applyProPerformance(status.lightingSnapshot!,{winLock:true,macMode:true,debounce:true,stability:true,autoCalibration:true,pollingCode:1});
  assert.equal(confirmed[65],0xa6);assert.equal(confirmed[68],0xb1);assert.equal(confirmed[70]&1,0);assert.equal(confirmed[71],0x3f);
  confirmed.forEach((v,i)=>{if(![65,68,70,71].includes(i))assert.equal(v,before[i]);});await client.close();
});

test('full brightness is written as 100 percent rather than 4 percent',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;
  const {client,status}=await AceClient.connect(device.hid());const settings=await client.applyLighting(status.lightingSnapshot!,{effect:3,color:'#ffffff',rainbow:false,brightness:100,speed:4});
  assert.equal(settings[9],100);assert.equal(settings[10],0);await client.close();
});

test('advanced Hold/Tap uses a free shared bank across layers and the selected profile',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;device.base[2]=1;device.settings.set([0xaa,0xbb],66);
  // Slot zero in a different layer already references shared MT record zero.
  device.mappings.set([146,0,15],4*512);device.mt.set([16,0,8,16,0,9],256);
  const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!,3),data=await client.loadAdvanced(keys),before=device.mappings.slice(),mtBefore=device.mt.slice();
  const result=await client.applyAdvanced(data,{type:'mt',slot:8,tap:41,hold:225,delay:150});
  assert.deepEqual(Array.from(result.mappings.slice(3*512+24,3*512+27)),[146,1,15]);
  assert.deepEqual(Array.from(result.mt.slice(6,12)),[16,0,41,16,2,0]);
  device.mt.forEach((v,i)=>{if(i<262||i>=268)assert.equal(v,mtBefore[i]);});
  device.mappings.forEach((v,i)=>{if(i<3608||i>=3611)assert.equal(v,before[i]);});await client.close();
});

test('SOCD sets reciprocal bindings and priorities, removal restores both keys',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!,1),data=await client.loadAdvanced(keys);
  const result=await client.applyAdvanced(data,{type:'socd',slot:0,second:1,priority:1});
  assert.deepEqual(Array.from(result.mappings.slice(512,518)),[148,0,1,148,1,0]);
  assert.equal(result.keys.travel[1],0x11);assert.equal(result.keys.travel[9],0x21);
  const restored=await client.applyAdvanced(result,{type:'remove',slot:0});
  assert.deepEqual(Array.from(restored.mappings.slice(512,518)),[16,0,4,16,0,5]);assert.equal(restored.keys.travel[1],1);assert.equal(restored.keys.travel[9],1);await client.close();
});

test('advanced writers reject stale banks before writes and fail on missing readback',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!),data=await client.loadAdvanced(keys);
  device.mt[200]=1;await assert.rejects(client.applyAdvanced(data,{type:'mt',slot:8,tap:41,hold:225,delay:150}),/configuration changed/);assert.equal(device.reports.filter(r=>[9,0xa3,0xa5].includes(r[1])).length,0);
  device.mt[200]=0;device.corruptReadback=true;await assert.rejects(client.applyAdvanced(data,{type:'dks',slot:8,actions:[4,5,6,7]}),/readback differs/);await client.close();
});

test('DKS and RS preserve unselected keys and unrelated action banks',async()=>{
  const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!),data=await client.loadAdvanced(keys);
  const dks=await client.applyAdvanced(data,{type:'dks',slot:8,actions:[4,5,6,7]});assert.deepEqual(Array.from(dks.dks.slice(0,4)),[10,30,30,10]);assert.deepEqual(Array.from(dks.mappings.slice(24,27)),[144,0,0]);
  const rs=await client.applyAdvanced(dks,{type:'rs',slot:9,second:10});assert.deepEqual(Array.from(rs.mappings.slice(27,33)),[147,0,10,147,1,9]);assert.deepEqual(rs.dks,dks.dks);assert.deepEqual(rs.keys.travel,data.keys.travel);await client.close();
});

 test('live travel uses measured reports and restores debug without changing other bits',async()=>{
 const device=new MockKeyboard();device.productId=0x2103;device.settings[7]=0x66;
 const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);const values:any[]=[];
 await client.startLiveTravel(keys,value=>values.push(value),true);assert.equal(device.settings[7],0x6e);assert.ok(device.reports.some(r=>r[1]===0xa8));
 const bytes=new Uint8Array(64);bytes.set([0xa0,16,0,4]);bytes[6]=1;bytes[7]=44;bytes[10]=255;
 const event=new Event('inputreport');Object.assign(event,{reportId:0,data:new DataView(bytes.buffer)});device.dispatchEvent(event);
 assert.deepEqual(values,[{slot:0,mm:3,calibration:255}]);
 device.settings[7]|=1;await client.stopLiveTravel();assert.equal(device.settings[7],0x67);assert.ok(device.reports.some(r=>r[1]===0xa9));
 device.dispatchEvent(event);assert.equal(values.length,1);await client.close();
 });
 test('Toggle bindings use a free shared TGL bank and verify full readback',async()=>{
 const device=new MockKeyboard();device.productId=0x2103;device.mappings.set([145,0,0],512);device.tgl.set([16,0,9]);
 const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!),data=await client.loadAdvanced(keys);
 const next=await client.applyAdvanced(data,{type:'tgl',slot:1,hold:225});assert.deepEqual(Array.from(next.mappings.slice(3,6)),[145,1,0]);assert.deepEqual(Array.from(device.tgl.slice(3,6)),[16,2,0]);assert.deepEqual(Array.from(device.tgl.slice(0,3)),[16,0,9]);
 await client.close();
 });
 test('live travel refuses unconfirmed debug mode and restores it on failure',async()=>{
 const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);device.corruptReadback=true;
 await assert.rejects(client.startLiveTravel(keys,()=>{},true),/did not read back/);assert.equal(device.reports.filter(r=>r[1]===0xa8).length,0);assert.equal(device.settings[7]&8,0);await client.close();
 });

 test('Quick Trigger mode 1 remains distinct from continuous Rapid trigger mode 2',async()=>{
 const device=new MockKeyboard();device.productId=0x2103;const {client,status}=await AceClient.connect(device.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);assert.equal(keys.keys[0].mode,1);
 const next=await client.applyProTrigger(keys,[0],{actuation:1.5,press:.3,release:.3,mode:2,pressDeadzone:0,releaseDeadzone:0});assert.equal(next.keys[0].mode,2);assert.equal(next.keys[1].mode,1);await client.close();
 });

test('undo mapping restores Q without changing triggers and records a readable change',async()=>{
 const d=new MockKeyboard();d.productId=0x2103;const {client,status}=await AceClient.connect(d.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);const q=keys.keys.find(k=>k.code===20)!;const before=d.proTravel.slice();await client.applyProMapping(keys,q.slot,4);assert.equal(client.changes()[0].label,'Key mapping: Q → A (layer 1)');assert.equal(d.mappings[q.slot*3+2],4);await client.undoLast();assert.equal(d.mappings[q.slot*3+2],20);assert.deepEqual(d.proTravel,before);assert.equal(client.changes().length,0);
});
test('undo rejects changed mappings or profile before writing',async()=>{
 const d=new MockKeyboard();d.productId=0x2103;const {client,status}=await AceClient.connect(d.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);await client.applyProMapping(keys,0,5);d.mappings[2]=6;let n=d.reports.length;await assert.rejects(()=>client.undoLast(),/changed since/);assert.ok(d.reports.slice(n).every(r=>r[1]!==9));d.mappings[2]=5;d.base[2]=1;n=d.reports.length;await assert.rejects(()=>client.undoLast(),/profile changed/);assert.ok(d.reports.slice(n).every(r=>r[1]!==9));
});
test('undo trigger restores the selected record while keeping later unrelated records',async()=>{
 const d=new MockKeyboard();d.productId=0x2103;const {client,status}=await AceClient.connect(d.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);const before=d.proTravel.slice(0,8);await client.applyProTrigger(keys,[0],{actuation:1,press:.3,release:.3,mode:1,pressDeadzone:0,releaseDeadzone:0});d.proTravel[8+2]=79;await client.undoLast();assert.deepEqual(d.proTravel.slice(0,8),before);assert.equal(d.proTravel[10],79);
});
test('undo refuses ignored restores and retains its recovery record',async()=>{
 const d=new MockKeyboard();d.productId=0x2103;const {client,status}=await AceClient.connect(d.hid());const keys=await client.loadProKeys(status.lightingSnapshot!);await client.applyProMapping(keys,0,5);d.corruptReadback=true;await assert.rejects(()=>client.undoLast(),/Undo readback failed/);assert.equal(client.changes().length,1);
});
test('advanced binding undo restores mappings, shared actions and trigger bytes',async()=>{
 const d=new MockKeyboard();d.productId=0x2103;const {client,status}=await AceClient.connect(d.hid());const keys=await client.loadProKeys(status.lightingSnapshot!),data=await client.loadAdvanced(keys);const maps=d.mappings.slice(),travel=d.proTravel.slice(),mt=d.mt.slice();await client.applyAdvanced(data,{type:'mt',slot:0,tap:4,hold:5,delay:150});await client.undoLast();assert.deepEqual(d.mappings,maps);assert.deepEqual(d.proTravel,travel);assert.deepEqual(d.mt,mt);
});
