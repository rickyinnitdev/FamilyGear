import { test } from 'node:test';
import assert from 'node:assert/strict';
import { X68Client, x68Packet, x68Response } from '../src/devices/x68';
test('X68 checksum supports RGB blue at byte 7 and header-only HE checksum',()=>{
  const rgb=x68Packet([7,4,2,4,0xa8,12,34,56],8);assert.equal(rgb[7],56);assert.equal(rgb.slice(0,9).reduce((a,b)=>a+b,0)&255,255);
  const page=x68Packet([0x65,0,1,0,1,0,0,0,39]);assert.equal(page[8],39);assert.equal(page.slice(0,8).reduce((a,b)=>a+b,0)&255,255);
});
test('X68 feature read validates exact command and respects DataView offset',()=>{
 const bytes=new Uint8Array(70);bytes[3]=0x87;assert.equal(x68Response(new DataView(bytes.buffer,3,64),0x87)[0],0x87);assert.throws(()=>x68Response(new DataView(bytes.buffer,3,64),0x84));assert.throws(()=>x68Response(new DataView(bytes.buffer,3,63),0x87));
});
test('X68 readback and stale protection preserve lighting option bits',async()=>{
 let command=0;const light=new Uint8Array(64);light.set([0x87,4,2,3,0xa8,11,22,33]);let rate=3;const writes:number[]=[];
 const device={vendorId:0x3151,productId:0x502d,opened:true,collections:[{usagePage:0xffff,usage:2,featureReports:[{reportId:0}]}],async close(){},async sendFeatureReport(_id:number,data:Uint8Array){command=data[0];if(command===4)throw Error('SET04 would switch profiles');if(command===3){assert.equal(data[1],0);rate=data[2];writes.push(command);}if(command===7){light.set(data.slice(1,8),1);writes.push(command);}},async receiveFeatureReport(){const b=new Uint8Array(64);b[0]=command;if(command===3||command===7)throw Error('SET must not be read as an ACK');if(command===0x83)b[2]=rate;if(command===0x84)b[1]=2;if(command===0x87)b.set(light);return new DataView(b.buffer);}} as unknown as HIDDevice;
 const {client,state}=await X68Client.connect(device);assert.equal(state.profile,2);const wanted=state.light.slice();wanted[5]=99;const result=await client.apply(state,wanted,4);assert.equal(result.light[4],0xa8);assert.equal(result.rate[2],4);assert.deepEqual(writes,[3,7]);await assert.rejects(client.apply(state,wanted,4),/changed/);assert.deepEqual(writes,[3,7]);
});
test('X68 ignored polling writes fail readback without changing profiles',async()=>{
 let command=0;const writes:number[]=[];const device={async sendFeatureReport(_id:number,data:Uint8Array){command=data[0];if(command<0x80)writes.push(command);},async receiveFeatureReport(){const b=new Uint8Array(64);b[0]=command;if(command===0x83)b[2]=1;if(command===0x84)b[1]=2;if(command===0x87)b.set([135,1,2,3,168,1,2,3]);return new DataView(b.buffer);}} as unknown as HIDDevice;
 const client=new X68Client(device),state=await client.read();await assert.rejects(client.apply(state,state.light,3),/readback/);assert.deepEqual(writes,[3]);
});
test('X68 unknown polling layout cannot fall back to dangerous SET04',async()=>{
 let command=0;const writes:number[]=[];const device={async sendFeatureReport(_id:number,data:Uint8Array){command=data[0];if(command<0x80)writes.push(command);},async receiveFeatureReport(){const b=new Uint8Array(64);b[0]=command===0x83?0:command;if(command===0x84)b[2]=1;if(command===0x87)b.set([135,1,2,3,168,1,2,3]);return new DataView(b.buffer);}} as unknown as HIDDevice;
 const client=new X68Client(device),state=await client.read();assert.equal(state.pollingWritable,false);await assert.rejects(client.apply(state,state.light,3),/not recognized/);assert.deepEqual(writes,[]);
});
