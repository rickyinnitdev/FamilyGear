import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtkHidClient} from '@openmouse/protocol/drivers/atk/hid';
import {WE_REPORT_ID,WE_CMD_WRITE_EEPROM,weReportChecksum,wePackScalarPair} from '@openmouse/protocol/endgame-gear-we';
import {VxeClient} from '../src/devices/vxe.ts';
class MockR1 extends EventTarget {
  vendorId=0x3554;productId=0xf58e;opened=true;row=new Uint8Array([12,43,7,48,...wePackScalarPair(0)]);writes=0;corrupt=false;
  async sendReport(id:number,buffer:ArrayBuffer){const request=new Uint8Array(buffer),reply=request.slice();if(request[0]===WE_CMD_WRITE_EEPROM){this.writes++;if(!this.corrupt)this.row.set(request.slice(5,11));}else reply.set(this.row,5);reply[15]=weReportChecksum(WE_REPORT_ID,Array.from(reply.slice(0,15)));queueMicrotask(()=>{const event=new Event('inputreport');Object.assign(event,{reportId:id,data:new DataView(reply.buffer)});this.dispatchEvent(event);});}
}
class IdentifiedR1 extends VxeClient {override displayName(){return 'VXE R1';}}
test('R1 performance extension preserves the entire row and requires changed readback',async()=>{
  const original=AtkHidClient.prototype.readStatus;
  AtkHidClient.prototype.readStatus=async()=>({name:'VXE R1',brand:'VXE'} as Awaited<ReturnType<typeof original>>);
  try{
    const mock=new MockR1(),client=new IdentifiedR1(mock as unknown as HIDDevice);
    assert.equal((await client.readStatus()).performanceMode,false);
    assert.equal(await client.setPerformanceMode(true),true);assert.deepEqual(Array.from(mock.row),[12,43,7,48,...wePackScalarPair(1)]);
    mock.corrupt=true;await assert.rejects(client.setPerformanceMode(false),/readback differs/);assert.equal(mock.writes,2);
    mock.row[5]=0;assert.equal((await client.readStatus()).performanceMode,undefined);
  }finally{AtkHidClient.prototype.readStatus=original;}
});
