import type {MouseStatus} from '@openmouse/protocol/drivers/mouse-types';
export interface X11Settings {profile:number;profileCount:number;productId:number;dpi:number;dpiStages:number[];activeDpiStage:number;dpiStageColors:string[];pollingRateHz:number|null;debounceMs:number|null;motionSync:boolean|null;angleSnapping:boolean|null;rippleControl:boolean|null;liftOffDistance:'Low'|'Medium'|'High'|null;sleepTimeout:number|null;batteryPercent?:number;batteryState?:MouseStatus['batteryState'];buttonMappings:Record<string,string>;lighting:{mode:number;speed:number;brightness:number;color:string;deepSleep:number}}
export class X11Client {
  readonly device:HIDDevice;
  native!:X11Settings;
  constructor(s:X11Settings){this.device={vendorId:0x1d57,productId:s.productId,productName:'ATTACK SHARK X11',opened:true,collections:[]} as unknown as HIDDevice;this.native=s;}
  private async change(op:string,...args:Array<string|number|boolean>){this.native=await window.familyGear!.x11(op,args) as X11Settings;return this.native;}
  async readStatus(live=false):Promise<MouseStatus>{if(live){const battery=await window.familyGear!.x11('battery');this.native={...this.native,...battery};}else await this.change('read');return this.status();}
  status():MouseStatus & {pollingReadVerified:boolean}{const s=this.native;return {brand:'Attack Shark',name:'ATTACK SHARK X11',firmware:[],dpi:s.dpi,dpiStages:s.dpiStages,dpiStageColors:s.dpiStageColors,activeDpiStage:s.activeDpiStage,activeProfile:s.profile,atkProfileCount:s.profileCount,pollingRateHz:s.pollingRateHz??0,supportedPollingRates:[125,250,500,1000],pollingReadVerified:s.pollingRateHz!=null,batteryPercent:s.batteryPercent??null,batteryState:s.batteryState??'Unknown',connectionType:s.productId===0xfa55?'Wired':'Wireless',connectionDetail:s.productId===0xfa55?'Native USB HID':'Native 2.4 GHz HID',debounceMs:s.debounceMs,motionSync:s.motionSync,angleSnapping:s.angleSnapping,rippleControl:s.rippleControl,liftOffDistance:s.liftOffDistance,supportedLiftOffDistances:['Low','Medium','High'],sleepTimeout:s.sleepTimeout,buttonMappings:s.buttonMappings,buttonOptions:['Disabled','Right click','Middle click','Back','Forward','Double click','Scroll up','Scroll down','DPI cycle','DPI up','DPI down','Play / pause','Mute','Volume up','Volume down','Polling cycle'],ui:{family:'attackshark-x11-native',settingsReady:true,valuesVerified:true,dpiStageEditor:{maxStages:6,countEditable:false,minDpi:50,maxDpi:22000,stepDpi:50},statusNote:'Experimental native X11 support. Every change requires device readback.'}};}
  async close(){await window.familyGear?.x11('close');}
  getDpiOptions(){return Array.from({length:440},(_,i)=>(i+1)*50);}
  getDebounceOptions(){return Array.from({length:24},(_,i)=>4+i*2);}
  getSleepOptions(){return Array.from({length:60},(_,i)=>(i+1)*30);}
  async setDpi(n:number,y=n){if(y!==n)throw Error('Separate axes are unavailable on X11.');await this.change('dpi',n);return n;}
  async setDpiStageValue(i:number,n:number){await this.change('stage',i,n);return n;}
  async setDpiStageColor(i:number,c:string){await this.change('color',i,c);return c;}
  async setActiveDpiStage(i:number){await this.change('active',i);return i;}
  async setPollingRate(n:number){await this.change('polling',n);return n;}
  async setDebounceTime(n:number){await this.change('debounce',n);return n;}
  async setMotionSync(v:boolean){await this.change('motion',v);return v;}
  async setAngleSnapping(v:boolean){await this.change('angle',v);return v;}
  async setRippleControl(v:boolean){await this.change('ripple',v);return v;}
  async setLiftOffDistance(v:'Low'|'Medium'|'High'){await this.change('lod',v);return v;}
  async setSleepTimeout(n:number){await this.change('sleep',n);return n;}
  async setR1ActiveProfile(n:number){await this.change('profile',n);return n;}
  async setButtonMapping(button:string,action:string){await this.change('button',button,action);}
  async setLighting(mode:number,speed:number,brightness:number,color:string,deepSleep:number){await this.change('lighting',mode,speed,brightness,color,deepSleep);}
  async setPerformanceMode(_v:boolean):Promise<boolean>{throw Error('X11 performance mode is not verified.');}
  async setLongRangeMode(_v:boolean):Promise<boolean>{throw Error('X11 range mode is not verified.');}
  async setDpiStageCount(_n:number):Promise<number>{throw Error('X11 stage count editing is not verified.');}
  async setDpiLighting(..._args:number[]):Promise<void>{throw Error('Use the X11 lighting panel.');}
}



