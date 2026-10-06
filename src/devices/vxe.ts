import { AtkHidClient } from '@openmouse/protocol/drivers/atk/hid';
import type { MouseStatus } from '@openmouse/protocol/drivers/mouse-types';
import { WE_CMD_READ_EEPROM, WE_CMD_WRITE_EEPROM, WE_REPORT_ID, weBuildCmdPayload, wePackScalarPair, weUnpackScalarPair, weReportChecksum } from '@openmouse/protocol/endgame-gear-we';
export { type MouseStatus };
export const VXE_FILTERS: HIDDeviceFilter[] = [
  { vendorId: 0x373b, productId: 0x1085 },
  ...[0xf58a, 0xf58c, 0xf58e, 0xf58f].map(productId => ({ vendorId: 0x3554, productId })),
];
export async function connectVxe(device: HIDDevice): Promise<{ client: AtkHidClient; status: MouseStatus }> {
  if (!AtkHidClient.isSupported(device)) throw new Error('Choose the mouse configuration interface, or connect its receiver.');
  const client = new VxeClient(device);
  try {
    const status = await client.readStatus();
    if (status.brand !== 'VXE') throw new Error('This device was not identified as a supported VXE mouse.');
    return { client, status };
  } catch (error) { await client.close().catch(() => {}); throw error; }
}
// Additional R1 receiver path. Require an identified R1, a valid scalar pair,
// an echoed write, and a full unchanged-row readback before reporting success.
export class VxeClient extends AtkHidClient {
  private r1Performance:Uint8Array|null=null;
  private receiverPerformancePath(){return this.device.vendorId===0x3554&&[0xf58e,0xf58f].includes(this.device.productId)&&this.displayName()==='VXE R1';}
  private requestR1(frame:Uint8Array,match:(reply:Uint8Array)=>boolean):Promise<Uint8Array>{
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.device.removeEventListener('inputreport',listener);};
      const listener=(event:HIDInputReportEvent)=>{const bytes=new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength);if(event.reportId!==WE_REPORT_ID||bytes.length<16||bytes[15]!==weReportChecksum(WE_REPORT_ID,Array.from(bytes.slice(0,15)))||!match(bytes))return;cleanup();resolve(bytes.slice());};
      const timer=setTimeout(()=>{cleanup();reject(new Error('R1 receiver did not confirm the performance command. Refresh to inspect its state.'));},1600);
      this.device.addEventListener('inputreport',listener);this.device.sendReport(WE_REPORT_ID,new Uint8Array(frame).buffer).catch(error=>{cleanup();reject(error);});
    });
  }
  private async readPerformanceR1(){
    const bytes=await this.requestR1(weBuildCmdPayload(WE_CMD_READ_EEPROM,[0,0,0xb5,6]),r=>(r[0]===WE_CMD_READ_EEPROM||r[0]===WE_CMD_WRITE_EEPROM)&&r[1]===0&&r[2]===0&&r[3]===0xb5&&r[4]===6);
    const block=bytes.slice(5,11),mode=weUnpackScalarPair(block[4],block[5]);
    if(mode!==0&&mode!==1)throw new Error('Unknown R1 sensor-performance row.');
    return block;
  }
  override async readStatus(live=false){
    const status=await super.readStatus(live);
    if(!live&&status.performanceMode==null&&this.receiverPerformancePath()){
      this.r1Performance=null;
      try{this.r1Performance=await this.readPerformanceR1();status.performanceMode=this.r1Performance[4]===1;}catch{/* Unreadable settings remain disabled. */}
    }else if(live&&this.r1Performance)status.performanceMode=this.r1Performance[4]===1;
    return status;
  }
  override async setPerformanceMode(enabled:boolean){
    if(!this.receiverPerformancePath()||!this.r1Performance)return super.setPerformanceMode(enabled);
    const current=await this.readPerformanceR1();
    if(!current.every((v,i)=>v===this.r1Performance![i]))throw new Error('Sensor mode changed. Refresh before applying.');
    const next=current.slice();next.set(wePackScalarPair(enabled?1:0),4);
    if(!next.every((v,i)=>v===current[i]))await this.requestR1(weBuildCmdPayload(WE_CMD_WRITE_EEPROM,[0,0,0xb5,6,...next]),r=>r[0]===WE_CMD_WRITE_EEPROM&&r[1]===0&&r[2]===0&&r[3]===0xb5&&r[4]===6&&next.every((v,i)=>v===r[5+i]));
    const confirmed=await this.readPerformanceR1();if(!confirmed.every((v,i)=>v===next[i]))throw new Error('R1 performance readback differs. Refresh before continuing.');
    this.r1Performance=confirmed;return enabled;
  }
}
