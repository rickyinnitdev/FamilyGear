import type { AtkHidClient } from '@openmouse/protocol/drivers/atk/hid';
import type { MouseStatus } from './vxe';

// Independently implemented from SC620 Windows driver 1.2.2 (see SC620-RESEARCH.md).
// Shared USB IDs are not a retail identity: require a matching name or explicit model choice.
export const SC620_FILTERS: HIDDeviceFilter[] = [0xa8a4,0xa8a5].map(vendorId=>({vendorId,productId:0x2255,usagePage:0xff01,usage:0x10}));
export const SC620_EFFECTS = ['Off','Wave','Neon','Cycling Flash','YOYO Ball','Single Flash','Breathing Loop'] as const;
const RATES=[125,250,500,1000];
const BUTTONS:Record<string,number>={Left:0,Right:1,Middle:2,Backward:3,Forward:4,'Scroll up':6,'Scroll down':7,Fire:8};
const ACTIONS = [
  {label:'Left click',bytes:[32,1,0,0]}, {label:'Right click',bytes:[32,2,0,0]},
  {label:'Middle click',bytes:[32,4,0,0]}, {label:'Backward',bytes:[32,8,0,0]},
  {label:'Forward',bytes:[32,16,0,0]}, {label:'DPI loop',bytes:[33,85,0,0]},
  {label:'Scroll up',bytes:[33,56,1,0]}, {label:'Scroll down',bytes:[33,56,255,0]},
  {label:'Fire key',bytes:[33,170,0,0]}, {label:'Disabled',bytes:[32,0,0,0]},
];
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function sc620IsSupported(device:HIDDevice,explicit=false){
  const collection=(list:readonly HIDCollectionInfo[]):boolean=>list.some(c=>(c.usagePage===0xff01&&c.usage===0x10)||collection(c.children??[]));
  return SC620_FILTERS.some(f=>f.vendorId===device.vendorId&&f.productId===device.productId)&&collection(device.collections)&&
    (explicit||/\bSC[\s_-]?620\b/i.test(device.productName));
}
export function sc620Request(command:number,profile=0,payload?:Uint8Array){
  const body=new Uint8Array(64);
  // Native WriteFile includes report ID 0; WebHID supplies it separately.
  body.set([0x55,command,command===0x0f?0xae:0xa5,0,command===8||command===9?0x2c:0x2e,0,0,profile]);
  if(payload)body.set(payload,8);
  body[3]=body.subarray(4).reduce((sum,v)=>sum+v,0)&255;
  return body;
}
export function sc620DecodeConfig(raw:Uint8Array){
  if(raw.length!==64||raw[0]!==0xaa||raw[1]!==0x0e||raw[8]!==0)throw new Error('SC620 did not return a matching profile-1 configuration. No guessed settings are used.');
  const stages=Array.from({length:6},(_,i)=>raw[13+i*2]|raw[14+i*2]<<8);
  if(raw[9]>6||raw[10]<1||raw[10]>4||raw[11]<1||raw[11]>6||raw[12]<1||raw[12]>raw[11]||stages.some(d=>d<50||d>12000))throw new Error('SC620 configuration is blank, unsupported or malformed. Settings remain locked.');
  return {raw:raw.slice(),stages,index:raw[12]-1,count:raw[11],light:SC620_EFFECTS[raw[9]],rate:RATES[raw[10]-1]};
}
function keyLabel(bytes:Uint8Array){return ACTIONS.find(a=>equal(Uint8Array.from(a.bytes),bytes))?.label??`Custom (${Array.from(bytes).join(',')})`;}

export class Sc620Client {
  private queue:Promise<unknown>=Promise.resolve();
  private snapshot:Uint8Array|null=null;
  private keySnapshot:Uint8Array|null=null;
  private writeEnabled=false;
  private status:MouseStatus|null=null;
  constructor(readonly device:HIDDevice,private timeout=1200,private settle=250){}
  close(){this.snapshot=null;this.keySnapshot=null;this.status=null;this.writeEnabled=false;return this.device.opened?this.device.close():Promise.resolve();}
  enableExperimentalWrites(value:boolean){this.writeEnabled=value;}
  private requireWrites(){if(!this.writeEnabled)throw new Error('Enable experimental SC620 edits before applying.');}
  getDpiOptions(){const stages=this.snapshot?Array.from({length:6},(_,i)=>this.snapshot![13+i*2]|this.snapshot![14+i*2]<<8):[];return [...new Set([...Array.from({length:240},(_,i)=>(i+1)*50),...stages])].sort((a,b)=>a-b);}
  getDebounceOptions(){return Array.from({length:21},(_,i)=>i);}
  getSleepOptions(){return [...new Set([60,180,300,600,1200,1800,3600,...(this.snapshot?.[52]?[this.snapshot[52]*60]:[])])].sort((a,b)=>a-b);}
  private run<T>(task:()=>Promise<T>):Promise<T>{const next=this.queue.then(task,task);this.queue=next.catch(()=>{});return next;}
  private async exchange(body:Uint8Array){
    if(!this.device.opened)await this.device.open();
    return new Promise<Uint8Array>((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.device.removeEventListener('inputreport',listener);};
      const listener=(event:HIDInputReportEvent)=>{
        if(event.reportId!==0)return;
        const raw=new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength).slice();
        if(raw.length!==64||raw[0]!==0xaa||raw[1]!==body[1])return;
        cleanup();resolve(raw);
      };
      const timer=setTimeout(()=>{cleanup();reject(new Error('SC620 did not answer. Move the mouse, close its official driver, then Refresh.'));},this.timeout);
      this.device.addEventListener('inputreport',listener);
      this.device.sendReport(0,body.slice().buffer).catch(error=>{cleanup();reject(error);});
    });
  }
  private async config(){return sc620DecodeConfig(await this.exchange(sc620Request(0x0e)));}
  private async keys(){
    const raw=await this.exchange(sc620Request(8));
    if(raw[8]!==0||![16,32,33,48,112,240].includes(raw[9]))throw new Error('SC620 button records are unavailable.');
    return raw.slice(8,53); // Profile byte + eleven four-byte records, including opaque slots.
  }
  readStatus(live=false):Promise<MouseStatus>{return this.run(async()=>{
    if(live&&this.status){
      const battery=await this.exchange(sc620Request(0x30));
      this.status={...this.status,batteryPercent:battery[8]<=100?battery[8]:null,batteryState:battery[8]<=100?(battery[9]===1?'Charging':battery[9]===0?'Discharging':'Unknown'):'Unknown'};
      return this.status;
    }
    this.snapshot=null;
    const config=await this.config();
    const keys=await this.keys().catch(()=>null);
    const battery=await this.exchange(sc620Request(0x30)).catch(()=>null);
    this.snapshot=config.raw;
    this.keySnapshot=keys;
    this.status={brand:'AULA',name:'AULA SC620',dpi:config.stages[config.index],dpiStages:config.stages,activeDpiStage:config.index,
      pollingRateHz:config.rate,supportedPollingRates:RATES.slice(),activeProfile:null,
      batteryPercent:battery&&battery[8]<=100?battery[8]:null,batteryState:battery&&battery[8]<=100?(battery[9]===1?'Charging':battery[9]===0?'Discharging':'Unknown'):'Unknown',
      connectionType:this.device.vendorId===0xa8a4?'Wired':'Wireless',connectionDetail:this.device.vendorId===0xa8a4?'Wired USB':'2.4 GHz receiver',
      debounceMs:config.raw[51]<=20?config.raw[51]:null,
      liftOffDistance:config.raw[49]===1?'Low':config.raw[49]===2?'High':null,supportedLiftOffDistances:['Low','High'],
      sleepTimeout:config.raw[52]>0?config.raw[52]*60:null,performanceMode:config.raw[53]===0?false:config.raw[53]===1?true:null,
      scrollDirection:config.raw[48]===0?'Forward':config.raw[48]===1?'Reverse':null,
      lighting:{zone:'Mouse',modes:[...SC620_EFFECTS],mode:config.light,color:null,color2:null,colorModes:[],dualColorModes:[],reactiveModes:[],speeds:[],speed:null},
      buttonMappings:keys?Object.fromEntries(Object.entries(BUTTONS).map(([name,slot])=>[name,keyLabel(keys.slice(1+slot*4,5+slot*4))])):undefined,
      buttonOptions:ACTIONS.map(a=>a.label),
      ui:{family:'aula-sc620',settingsReady:true,valuesVerified:true,statusNote:'Experimental SC620 support · profile 1. Physical hardware verification is still needed.',
        dpiStageEditor:{maxStages:6,countEditable:false,minDpi:50,maxDpi:12000,stepDpi:1}},firmware:[],
    };
    return this.status;
  });}
  private edit(mutate:(raw:Uint8Array)=>void){return this.run(async()=>{
    this.requireWrites();
    if(!this.snapshot)throw new Error('Refresh SC620 settings before applying.');
    const current=await this.config();
    if(!equal(current.raw.subarray(8,58),this.snapshot.subarray(8,58))){this.snapshot=null;throw new Error('SC620 settings changed since they were displayed. Refresh before applying.');}
    const desired=current.raw.slice();mutate(desired);
    this.snapshot=null;
    await this.exchange(sc620Request(0x0f,0,desired.slice(8,58)));
    await new Promise(r=>setTimeout(r,this.settle));
    this.snapshot=null;
    const after=await this.config();
    if(!equal(after.raw.subarray(8,58),desired.subarray(8,58)))throw new Error('SC620 readback did not confirm the complete configuration. Refresh to see what applied.');
    this.snapshot=after.raw;
  });}
  async setDpi(dpi:number,y?:number){if(y!=null&&y!==dpi)throw new Error('Separate SC620 X/Y DPI is not verified.');return this.setDpiStageValue((await this.readCurrentIndex()),dpi);}
  private readCurrentIndex(){return this.run(async()=>{if(!this.snapshot)throw new Error('Refresh SC620 settings first.');return this.snapshot[12]-1;});}
  async setDpiStageValue(stage:number,dpi:number){
    if(!Number.isInteger(stage)||stage<0||stage>5||!Number.isInteger(dpi)||dpi<50||dpi>12000)throw new Error('Choose an SC620 stage and supported DPI from 50–12,000.');
    await this.edit(raw=>{raw[13+stage*2]=dpi&255;raw[14+stage*2]=dpi>>8;});return dpi;
  }
  async setActiveDpiStage(stage:number){await this.edit(raw=>{if(!Number.isInteger(stage)||stage<0||stage>=raw[11])throw new Error('That DPI stage is not enabled.');raw[12]=stage+1;});return stage;}
  private async byte(offset:number,value:number,allowed:readonly number[]){if(!allowed.includes(value))throw new Error('Unsupported SC620 setting value.');await this.edit(raw=>{raw[offset]=value;});return value;}
  async setPollingRate(rate:number){await this.byte(10,RATES.indexOf(rate)+1,[1,2,3,4]);return rate;}
  setDebounceTime(value:number){return this.byte(51,value,this.getDebounceOptions());}
  async setSleepTimeout(seconds:number){await this.byte(52,seconds/60,this.getSleepOptions().map(s=>s/60));return seconds;}
  async setLiftOffDistance(value:'Low'|'Medium'|'High'){await this.byte(49,value==='Low'?1:value==='High'?2:-1,[1,2]);return value;}
  async setPerformanceMode(value:boolean){await this.byte(53,value?1:0,[0,1]);return value;}
  async setScrollDirection(value:'Forward'|'Reverse'){await this.byte(48,value==='Forward'?0:value==='Reverse'?1:-1,[0,1]);return value;}
  async setSc620Lighting(effect:string){await this.byte(9,SC620_EFFECTS.indexOf(effect as typeof SC620_EFFECTS[number]),[0,1,2,3,4,5,6]);}
  async setButtonMapping(button:string,label:string){return this.run(async()=>{
    this.requireWrites();
    const slot=BUTTONS[button],action=ACTIONS.find(a=>a.label===label);
    if(slot==null||slot===0||!action)throw new Error('Choose a supported SC620 action. Left click stays locked.');
    if(!this.snapshot)throw new Error('Refresh SC620 settings first.');
    const before=await this.keys(),confirmation=await this.keys();
    if(!this.keySnapshot||!equal(before,this.keySnapshot)||!equal(before,confirmation))throw new Error('SC620 button settings changed or reads disagree. Refresh before applying.');
    const next=before.slice();next.set(action.bytes,1+slot*4);
    this.keySnapshot=null;
    await this.exchange(sc620Request(9,0,next));
    await new Promise(r=>setTimeout(r,this.settle));
    if(!equal(await this.keys(),next))throw new Error('SC620 button readback did not confirm the complete map.');
    this.keySnapshot=next;
  });}
  // Keep the common interface without ever issuing a different brand's command.
  private unsupported<K extends keyof AtkHidClient>():AtkHidClient[K]{return (async()=>{throw new Error('This SC620 command is not verified. No settings were changed.');}) as unknown as AtkHidClient[K];}
  setMotionSync=this.unsupported<'setMotionSync'>();setAngleSnapping=this.unsupported<'setAngleSnapping'>();setRippleControl=this.unsupported<'setRippleControl'>();
  setLongRangeMode=this.unsupported<'setLongRangeMode'>();setDpiLighting=this.unsupported<'setDpiLighting'>();
  setDpiStageCount=this.unsupported<'setDpiStageCount'>();setDpiStageColor=this.unsupported<'setDpiStageColor'>();setR1ActiveProfile=this.unsupported<'setR1ActiveProfile'>();
}
