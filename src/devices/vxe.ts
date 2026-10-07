import { AtkHidClient } from '@openmouse/protocol/drivers/atk/hid';
import { atkPackDpiStageForSensor, atkUnpackDpiStageForSensor, atkPackVxeR1PollingSetting, atkDecodeVxeR1PollingCode } from '@openmouse/protocol/atk';
import type { MouseStatus as ProtocolMouseStatus } from '@openmouse/protocol/drivers/mouse-types';
import { WE_CMD_READ_EEPROM, WE_CMD_WRITE_EEPROM, WE_REPORT_ID, weBuildCmdPayload, wePackScalarPair, weUnpackScalarPair, weReportChecksum } from '@openmouse/protocol/endgame-gear-we';
export type MouseStatus = Omit<ProtocolMouseStatus,'brand'> & {brand:ProtocolMouseStatus['brand']|'AULA';pollingReadVerified?:boolean};
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
  private r1System:Uint8Array|null=null;
  private r1Stages:Uint8Array[]=[];
  private settingsQueue:Promise<unknown>=Promise.resolve();
  private settingsRun<T>(action:()=>Promise<T>){const next=this.settingsQueue.then(action,action);this.settingsQueue=next.catch(()=>{});return next;}
  private async r1Read(address:number,length:number){
    const reply=await this.requestR1(weBuildCmdPayload(WE_CMD_READ_EEPROM,[0,address>>8,address&255,length]),r=>r[0]===WE_CMD_READ_EEPROM&&r[1]===0&&r[2]===(address>>8)&&r[3]===(address&255)&&r[4]===length);
    return reply.slice(5,5+length);
  }
  private async r1Write(address:number,data:Uint8Array){await this.device.sendReport(WE_REPORT_ID,new Uint8Array(weBuildCmdPayload(WE_CMD_WRITE_EEPROM,[0,address>>8,address&255,data.length,...data])).buffer);await new Promise(r=>setTimeout(r,300));}
  private async r1Layout(){
    const system=await this.r1Read(0,6),count=weUnpackScalarPair(system[2],system[3]),active=weUnpackScalarPair(system[4],system[5]);
    if(count==null||active==null||count<1||count>6||active>=count)throw new Error('R1 stage layout is unavailable. Refresh or try wired USB.');
    const stages:Uint8Array[]=[];
    for(let i=0;i<count;i++){const row=await this.r1Read(12+i*4,4);if(!atkUnpackDpiStageForSensor('PAW3395',row))throw new Error('R1 DPI checksum failed.');stages.push(row);}
    return {system,stages,active};
  }
  override async setPollingRate(rate:number){
    if(!this.receiverPerformancePath())return super.setPollingRate(rate);
    return this.settingsRun(async()=>{
      const packed=atkPackVxeR1PollingSetting(rate);if(!packed)throw new Error('Choose 250, 500 or 1,000 Hz for this R1 receiver.');
      await this.r1Write(0x70,Uint8Array.from(packed));
      for(let i=0;i<3;i++){const row=await this.r1Read(0x70,4);if(row[0]===0x0b&&row[2]===0&&(row[1]+row[3])%256===85&&atkDecodeVxeR1PollingCode(row[1])===rate)return rate;await new Promise(r=>setTimeout(r,150));}
      throw new Error('R1 did not confirm the requested polling rate. No default rate is substituted. Close other configurators, move the mouse and try wired USB.');
    });
  }
  override async setDpi(dpi:number,y=dpi){if(!this.receiverPerformancePath())return super.setDpi(dpi,y);if(y!==dpi)throw new Error('Separate X/Y editing is unavailable on this receiver.');const layout=await this.r1Layout();return this.setDpiStageValue(layout.active,dpi);}
  override async setDpiStageValue(index:number,dpi:number){
    if(!this.receiverPerformancePath())return super.setDpiStageValue(index,dpi);
    return this.settingsRun(async()=>{
      if(!Number.isInteger(dpi)||!this.getDpiOptions().includes(dpi))throw new Error('Choose a supported DPI value.');
      const current=await this.r1Layout();
      if(!this.r1System||!current.system.every((v,i)=>v===this.r1System![i])||!current.stages.every((r,i)=>r.every((v,j)=>v===this.r1Stages[i]?.[j])))throw new Error('R1 settings changed since display. Refresh before applying.');
      if(!Number.isInteger(index)||index<0||index>=current.stages.length)throw new Error('Choose an existing DPI stage.');
      const packed=atkPackDpiStageForSensor('PAW3395',dpi,dpi);if(!packed)throw new Error('Unsupported DPI.');
      this.r1System=null;
      await this.r1Write(12+index*4,Uint8Array.from(packed));
      const after=await this.r1Layout();
      if(!after.system.every((v,i)=>v===current.system[i])||!after.stages.every((r,i)=>r.every((v,j)=>v===(i===index?packed[j]:current.stages[i][j]))))throw new Error('R1 DPI readback did not confirm the complete stage layout. Refresh to inspect what applied.');
      this.r1System=after.system;this.r1Stages=after.stages;return dpi;
    });
  }
  override async setActiveDpiStage(index:number){if(this.receiverPerformancePath())throw new Error('Receiver stage switching is not verified. Use the physical DPI button.');return super.setActiveDpiStage(index);}
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
    if(this.receiverPerformancePath()&&!live){
      this.r1System=null;this.r1Stages=[];
      try{const layout=await this.r1Layout();this.r1System=layout.system;this.r1Stages=layout.stages;status.ui={...status.ui,dpiStageEditor:{maxStages:6,countEditable:false,minDpi:50,maxDpi:26000,stepDpi:50}};}catch{/* Stage writes remain locked without a complete layout. */}
    }
    if(this.receiverPerformancePath()){
      const row=await this.r1Read(0x70,4).catch(()=>null);
      const rate=row&&row[0]===0x0b&&row[2]===0&&(row[1]+row[3])%256===85?atkDecodeVxeR1PollingCode(row[1]):null;
      (status as MouseStatus).pollingReadVerified=rate!=null;
      if(rate!=null)status.pollingRateHz=rate;
    }
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
