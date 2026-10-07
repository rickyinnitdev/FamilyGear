import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Sc620Client,sc620Request,sc620DecodeConfig,sc620IsSupported} from '../src/devices/sc620';

function setup(){
  let raw=new Uint8Array(64);raw.set([0xaa,0x0e]);raw[9]=2;raw[10]=4;raw[11]=6;raw[12]=3;
  [800,1200,1600,3200,5000,12000].forEach((dpi,i)=>{raw[13+i*2]=dpi&255;raw[14+i*2]=dpi>>8;});
  raw[28]=97;raw[47]=89;raw[49]=1;raw[50]=53;raw[51]=4;raw[52]=10;raw[55]=0x21;
  let keys=new Uint8Array(45);[[32,1,0,0],[32,2,0,0],[32,4,0,0],[32,8,0,0],[32,16,0,0],[33,85,0,0],[33,56,1,0],[33,56,255,0],[33,170,0,0],[112,7,0,0],[33,98,0,0]].forEach((v,i)=>keys.set(v,1+i*4));
  let ignoreWrites=false,wrongReply=false;const packets:Uint8Array[]=[];const events=new EventTarget();
  const device={vendorId:0xa8a4,productId:0x2255,productName:'AULA SC620',collections:[{usagePage:0xff01,usage:0x10,children:[]}],opened:false,
    open:async()=>{device.opened=true;},close:async()=>{device.opened=false;},
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    sendReport:async(id:number,buffer:ArrayBuffer)=>{
      assert.equal(id,0);const request=new Uint8Array(buffer);packets.push(request.slice());
      let reply=new Uint8Array(64);reply.set([0xaa,request[1]]);
      if(request[1]===0x0f&&!ignoreWrites)raw.set(request.slice(8,58),8);
      if(request[1]===9&&!ignoreWrites)keys=request.slice(8,53);
      if(request[1]===0x0e)reply=raw.slice();
      if(request[1]===8)reply.set(keys,8);
      if(request[1]===0x30){reply[8]=71;reply[9]=1;}
      if(wrongReply)reply[1]=0x55;
      queueMicrotask(()=>{const e=new Event('inputreport');Object.assign(e,{reportId:0,data:new DataView(reply.buffer)});events.dispatchEvent(e);});
    }};
  const client=new Sc620Client(device as unknown as HIDDevice,30,0);
  return {client,device,packets,raw:()=>raw,keys:()=>keys,ignoreWrites:()=>{ignoreWrites=true;},wrongReply:()=>{wrongReply=true;}};
}

test('SC620 identity requires the vendor collection and retail name or explicit selection',()=>{
  const s=setup();assert.ok(sc620IsSupported(s.device as unknown as HIDDevice));
  s.device.productName='Generic mouse';assert.equal(sc620IsSupported(s.device as unknown as HIDDevice),false);assert.ok(sc620IsSupported(s.device as unknown as HIDDevice,true));
  s.device.collections=[];assert.equal(sc620IsSupported(s.device as unknown as HIDDevice,true),false);
});
test('SC620 native read headers and checksum differ from the related OEM driver',()=>{
  assert.deepEqual(Array.from(sc620Request(0x0e).slice(0,9)),[0x55,0x0e,0xa5,0x2e,0x2e,0,0,0,0]);
  assert.deepEqual(Array.from(sc620Request(8).slice(0,9)),[0x55,8,0xa5,0x2c,0x2c,0,0,0,0]);
  assert.equal(sc620Request(9,0,new Uint8Array(45))[2],0xa5);
  assert.equal(sc620Request(0x0f,0,new Uint8Array(50))[2],0xae);
});
test('SC620 reads actual settings without writes or synthetic defaults',async()=>{
  const s=setup(),status=await s.client.readStatus();assert.equal(status.brand,'AULA');assert.equal(status.dpi,1600);assert.equal(status.pollingRateHz,1000);assert.equal(status.batteryPercent,71);assert.equal(status.lighting?.mode,'Neon');assert.equal(status.buttonMappings?.Fire,'Fire key');
  assert.ok(s.packets.every(p=>[0x0e,8,0x30].includes(p[1])));
  const blank=s.raw().slice();blank.fill(0,13,25);assert.throws(()=>sc620DecodeConfig(blank),/malformed/);
  const erased=s.raw().slice();erased.fill(255,13,25);assert.throws(()=>sc620DecodeConfig(erased),/malformed/);
});
test('SC620 writes require opt-in and preserve unknown bytes, DPI colors and other stages',async()=>{
  const s=setup();await s.client.readStatus();await assert.rejects(s.client.setDpi(800),/experimental/);
  assert.equal(s.packets.filter(p=>p[1]===0x0f).length,0);
  s.client.enableExperimentalWrites(true);const before=s.raw().slice();await s.client.setDpi(800);
  for(let i=8;i<58;i++)if(i!==17&&i!==18)assert.equal(s.raw()[i],before[i],`preserve byte ${i}`);
  await s.client.setPollingRate(500);assert.equal(s.raw()[10],3);
  await s.client.setSc620Lighting('Wave');assert.equal(s.raw()[9],1);
  await s.client.setPerformanceMode(true);assert.equal(s.raw()[53],1);
});
test('battery telemetry cannot silently replace the displayed configuration snapshot',async()=>{
  const s=setup();await s.client.readStatus();s.client.enableExperimentalWrites(true);s.raw()[47]=34;
  await s.client.readStatus(true);await assert.rejects(s.client.setDpi(800),/changed/);
  assert.equal(s.packets.filter(p=>p[1]===0x0f).length,0);
});
test('unconfirmed SC620 writes fail and clear the write snapshot',async()=>{
  const s=setup();await s.client.readStatus();s.client.enableExperimentalWrites(true);s.ignoreWrites();
  await assert.rejects(s.client.setDpi(800),/readback/);await assert.rejects(s.client.setPollingRate(500),/Refresh/);
});
test('SC620 fire-button remapping preserves all eleven records and locks left click',async()=>{
  const s=setup();await s.client.readStatus();s.client.enableExperimentalWrites(true);const before=s.keys().slice();
  await assert.rejects(s.client.setButtonMapping('Left','Disabled'),/locked/);
  await s.client.setButtonMapping('Fire','Middle click');
  for(let i=0;i<45;i++)if(i<33||i>36)assert.equal(s.keys()[i],before[i]);
  assert.deepEqual(Array.from(s.keys().slice(33,37)),[32,4,0,0]);
  s.keys()[40]=8;await assert.rejects(s.client.setButtonMapping('Right','Disabled'),/changed/);
});
test('SC620 ignores mismatched replies and has no fallback packets for unverified controls',async()=>{
  const s=setup();s.wrongReply();await assert.rejects(s.client.readStatus(),/did not answer/);
  await assert.rejects(s.client.setMotionSync(true),/not verified/);assert.equal(s.packets.length,1);
});
