import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtkHidClient} from '@openmouse/protocol/drivers/atk/hid';
import {atkPackDpiStageForSensor,atkPackVxeR1PollingSetting} from '@openmouse/protocol/atk';
import {WE_REPORT_ID,WE_CMD_WRITE_EEPROM,WE_CMD_READ_EEPROM,weReportChecksum,wePackScalarPair} from '@openmouse/protocol/endgame-gear-we';
import {VxeClient,type MouseStatus} from '../src/devices/vxe';
class Receiver extends EventTarget{
  vendorId=0x3554;productId=0xf58e;opened=true;ignore=false;writes=0;
  rows=new Map<number,Uint8Array>([[0,Uint8Array.from([1,84,...wePackScalarPair(2),...wePackScalarPair(0)])],[12,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',1600,1600)!)],[16,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',800,800)!)],[0x70,Uint8Array.from(atkPackVxeR1PollingSetting(1000)!)],[0xb5,Uint8Array.from([1,84,2,83,...wePackScalarPair(1)])]]);
  async sendReport(id:number,data:ArrayBuffer){assert.equal(id,WE_REPORT_ID);const request=new Uint8Array(data),address=request[2]*256+request[3];if(request[0]===WE_CMD_WRITE_EEPROM){this.writes++;if(!this.ignore)this.rows.set(address,request.slice(5,5+request[4]));return;}
    const reply=request.slice();reply[0]=WE_CMD_READ_EEPROM;reply.set(this.rows.get(address)?.slice(0,request[4])??[],5);reply[15]=weReportChecksum(id,Array.from(reply.slice(0,15)));queueMicrotask(()=>{const event=new Event('inputreport');Object.assign(event,{reportId:id,data:new DataView(reply.buffer)});this.dispatchEvent(event);});}
}
class R1 extends VxeClient{override displayName(){return 'VXE R1';}override getDpiOptions(){return [400,800,1600,3200];}}
test('R1 polling waits for actual readback and DPI edits preserve other stages and reject stale data',async()=>{
 const original=AtkHidClient.prototype.readStatus;AtkHidClient.prototype.readStatus=async()=>({brand:'VXE',name:'VXE R1',pollingRateHz:1000,dpi:1600,dpiStages:[1600,800],activeDpiStage:0,supportedPollingRates:[250,500,1000],performanceMode:true} as MouseStatus);
 try{const device=new Receiver(),client=new R1(device as unknown as HIDDevice);
  const status=await client.readStatus() as MouseStatus;assert.ok(status.ui?.dpiStageEditor);assert.equal(status.pollingReadVerified,true);
  await client.setPollingRate(500);assert.equal((await client.readStatus(true)).pollingRateHz,500);
  const other=device.rows.get(16)!.slice();await client.setDpiStageValue(0,800);assert.deepEqual(device.rows.get(16),other);
  await client.readStatus();device.rows.set(16,Uint8Array.from(atkPackDpiStageForSensor('PAW3395',400,400)!));const count=device.writes;await assert.rejects(client.setDpiStageValue(0,1600),/changed/);assert.equal(device.writes,count);
  device.rows.set(0x70,new Uint8Array(4));assert.equal((await client.readStatus() as MouseStatus).pollingReadVerified,false);
  device.ignore=true;await assert.rejects(client.setPollingRate(1000),/did not confirm/);
 }finally{AtkHidClient.prototype.readStatus=original;}
});
