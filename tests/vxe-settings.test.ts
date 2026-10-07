import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtkHidClient} from '@openmouse/protocol/drivers/atk/hid';
import {atkPackDpiStageForSensor,atkPackVxeR1PollingSetting} from '@openmouse/protocol/atk';
import {WE_REPORT_ID,WE_CMD_WRITE_EEPROM,WE_CMD_READ_EEPROM,weReportChecksum,wePackScalarPair} from '@openmouse/protocol/endgame-gear-we';
import {VxeClient,type MouseStatus} from '../src/devices/vxe';
class Receiver extends EventTarget{
  vendorId=0x3554;productId=0xf58e;opened=true;ignore=false;writes=0;writeReply=false;extended=false;
  rows=new Map<number,Uint8Array>([[0,Uint8Array.from([1,84,...wePackScalarPair(2),...wePackScalarPair(0)])],[12,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',1600,1600)!)],[16,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',800,800)!)],[0x70,Uint8Array.from(atkPackVxeR1PollingSetting(1000)!)],[0xb5,Uint8Array.from([1,84,2,83,...wePackScalarPair(1)])]]);
  async sendReport(id:number,data:ArrayBuffer){assert.equal(id,WE_REPORT_ID);const request=new Uint8Array(data),address=request[2]*256+request[3];if(request[0]===WE_CMD_WRITE_EEPROM){this.writes++;assert.notEqual(address,0x70,'CompX must never write Beken live selectors');if(!this.ignore){const row=this.rows.get(address)?.slice()??new Uint8Array(request[4]);row.set(request.slice(5,5+request[4]));this.rows.set(address,row);}return;}
    const reply=request.slice();reply[0]=this.writeReply?WE_CMD_WRITE_EEPROM:WE_CMD_READ_EEPROM;reply[4]=this.extended?Math.max(8,request[4]):request[4];reply.set(this.rows.get(address)?.slice(0,reply[4])??[],5);reply[15]=weReportChecksum(id,Array.from(reply.slice(0,15)));queueMicrotask(()=>{const event=new Event('inputreport');Object.assign(event,{reportId:id,data:new DataView(reply.buffer)});this.dispatchEvent(event);});}
}
class R1 extends VxeClient{override displayName(){return 'VXE R1';}override getDpiOptions(){return [400,800,1600,3200];}}
test('R1 polling waits for actual readback and DPI edits preserve other stages and reject stale data',async()=>{
 const original=AtkHidClient.prototype.readStatus;AtkHidClient.prototype.readStatus=async()=>({brand:'VXE',name:'VXE R1',pollingRateHz:1000,dpi:1600,dpiStages:[1600,800],activeDpiStage:0,supportedPollingRates:[250,500,1000],performanceMode:true} as MouseStatus);
 try{const device=new Receiver(),client=new R1(device as unknown as HIDDevice);
  device.rows.set(0xa9,Uint8Array.from([4,81,1,84,6,79,21,64,0,85]));
  const status=await client.readStatus() as MouseStatus;assert.ok(status.ui?.dpiStageEditor);assert.equal(status.pollingReadVerified,true);
  const advanced=device.rows.get(0xa9)!.slice();assert.equal(status.debounceMs,4);
  await client.setDebounceTime(2);assert.deepEqual(device.rows.get(0xa9)!.slice(2),advanced.slice(2));assert.equal((await client.readStatus()).debounceMs,2);
  device.rows.get(0xa9)![6]=22;const writes=device.writes;await assert.rejects(client.setDebounceTime(4),/changed/);assert.equal(device.writes,writes);
  await client.readStatus();device.ignore=true;await assert.rejects(client.setDebounceTime(4),/did not confirm/);device.ignore=false;
  const system=device.rows.get(0)!.slice();
  await client.setPollingRate(500);assert.equal((await client.readStatus(true)).pollingRateHz,500);assert.deepEqual(device.rows.get(0)!.slice(2),system.slice(2));
  const other=device.rows.get(16)!.slice();await client.setDpiStageValue(0,800);assert.deepEqual(device.rows.get(16),other);
  await client.readStatus();device.rows.set(16,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',400,400)!));const count=device.writes;await assert.rejects(client.setDpiStageValue(0,1600),/changed/);assert.equal(device.writes,count);
  device.writeReply=true;device.extended=true;assert.equal((await client.readStatus() as MouseStatus).pollingReadVerified,true);
  device.rows.set(0,Uint8Array.from([0,0,...system.slice(2)]));assert.equal((await client.readStatus() as MouseStatus).pollingReadVerified,false);
  device.rows.set(0,system);
  device.ignore=true;await assert.rejects(client.setPollingRate(500),/did not confirm/);
 }finally{AtkHidClient.prototype.readStatus=original;}
});
