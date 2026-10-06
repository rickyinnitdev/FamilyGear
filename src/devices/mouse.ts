import type { AtkHidClient } from '@openmouse/protocol/drivers/atk/hid';
import { GearHubHidClient } from '@openmouse/protocol/drivers/gearhub/hid';
import { LamzuHidClient } from '@openmouse/protocol/drivers/lamzu/hid';
import { GEARHUB_PRODUCTS } from '@openmouse/protocol/gearhub';
import { LAMZU_PRODUCTS } from '@openmouse/protocol/lamzu';
import { connectVxe, VXE_FILTERS, type MouseStatus } from './vxe';

export const MOUSE_FILTERS: HIDDeviceFilter[] = [...VXE_FILTERS,
  ...[...GEARHUB_PRODUCTS.keys()].filter(id=>id!==0x402c).map(productId=>({vendorId:0x3151,productId})),
  ...[...LAMZU_PRODUCTS].filter(([,p])=>p.brand==='Attack Shark').map(([productId])=>({vendorId:0x373e,productId})),
  ...[0xfa55,0xfa60].map(productId=>({vendorId:0x1d57,productId})),
];
type Driver = GearHubHidClient | LamzuHidClient;
type Setter = 'setDpi'|'setPollingRate'|'setDebounceTime'|'setMotionSync'|'setAngleSnapping'|'setRippleControl'|'setSleepTimeout'|'setLiftOffDistance'|'setPerformanceMode'|'setLongRangeMode'|'setDpiLighting'|'setDpiStageCount'|'setDpiStageValue'|'setDpiStageColor'|'setActiveDpiStage'|'setR1ActiveProfile';

// Driver-specific commands only. Missing methods never fall back to ATK packets.
export class SharkClient {
  readonly device: HIDDevice;
  constructor(private driver: Driver) { this.device=driver.device; }
  async readStatus(live=false): Promise<MouseStatus> {
    const status=this.driver instanceof LamzuHidClient?await this.driver.readStatus(live):await this.driver.readStatus();
    if(status.brand!=='Attack Shark')throw new Error('The device did not identify as a supported ATTACK SHARK model. Shared receiver IDs alone do not prove compatibility.');
    // GearHub otherwise supplies a default polling rate after a failed options read.
    if(this.driver instanceof GearHubHidClient&&status.debounceMs==null)throw new Error('Could not read the current ATTACK SHARK performance settings. Move the mouse and Refresh; guessed settings are not shown.');
    return status;
  }
  close(){return this.driver.close();}
  getDpiOptions(){return this.driver.getDpiOptions();}
  getDebounceOptions(){return this.driver instanceof GearHubHidClient?this.driver.getDebounceOptions():Array.from({length:16},(_,i)=>i);}
  getSleepOptions(){return this.driver.getSleepOptions();}
  async setButtonMapping(button:string,action:string){
    if(!(this.driver instanceof GearHubHidClient))throw new Error('Button remapping is unavailable on this driver.');
    const before=await this.readStatus();
    if(!before.buttonMappings||!Object.hasOwn(before.buttonMappings,button)||!before.buttonOptions?.includes(action))throw new Error('Read the current buttons before choosing a supported action.');
    await this.driver.setButtonMapping(button,action);
    if((await this.readStatus()).buttonMappings?.[button]!==action)throw new Error('Button readback did not confirm the new action.');
  }
  private setter<K extends Setter>(name:K):AtkHidClient[K] {
    return (async (...args:unknown[])=>{
      const method=(this.driver as unknown as Record<string,unknown>)[name];
      if(typeof method!=='function')throw new Error('This setting is not supported by this mouse driver.');
      const before=await this.readStatus();
      if(before.ui?.settingsReady===false)throw new Error('Current settings are unavailable. Refresh before applying.');
      const value=await method.apply(this.driver,args);
      const after=await this.readStatus();
      const fields:Partial<Record<Setter,keyof MouseStatus>>={setDpi:'dpi',setPollingRate:'pollingRateHz',setDebounceTime:'debounceMs',setMotionSync:'motionSync',setAngleSnapping:'angleSnapping',setRippleControl:'rippleControl',setSleepTimeout:'sleepTimeout',setLiftOffDistance:'liftOffDistance',setPerformanceMode:'performanceMode',setActiveDpiStage:'activeDpiStage'};
      const field=fields[name];
      const confirmed=field?after[field]===args[0]:name==='setDpiStageValue'?after.dpiStages?.[Number(args[0])]===args[1]:name==='setDpiStageColor'?after.dpiStageColors?.[Number(args[0])]?.toLowerCase()===String(args[1]).toLowerCase():false;
      if(!confirmed||(name==='setDpi'&&args[1]!=null&&after.dpiY!==args[1]))throw new Error('Device readback did not confirm the requested setting. Refresh and check the device.');
      return value;
    }) as AtkHidClient[K];
  }
  setDpi=this.setter('setDpi');
  setPollingRate=this.setter('setPollingRate');
  setDebounceTime=this.setter('setDebounceTime');
  setMotionSync=this.setter('setMotionSync');
  setAngleSnapping=this.setter('setAngleSnapping');
  setRippleControl=this.setter('setRippleControl');
  setSleepTimeout=this.setter('setSleepTimeout');
  setLiftOffDistance=this.setter('setLiftOffDistance');
  setPerformanceMode=this.setter('setPerformanceMode');
  setLongRangeMode=this.setter('setLongRangeMode');
  setDpiLighting=this.setter('setDpiLighting');
  setDpiStageCount=this.setter('setDpiStageCount');
  setDpiStageValue=this.setter('setDpiStageValue');
  setDpiStageColor=this.setter('setDpiStageColor');
  setActiveDpiStage=this.setter('setActiveDpiStage');
  setR1ActiveProfile=this.setter('setR1ActiveProfile');
}
export async function connectMouse(device:HIDDevice){
  if(device.vendorId===0x1d57)throw new Error('ATTACK SHARK X11-family settings need a native bridge on Windows. This web app has no bridge connection yet; no device settings were changed.');
  if(VXE_FILTERS.some(f=>f.vendorId===device.vendorId&&f.productId===device.productId))return connectVxe(device);
  const driver=GearHubHidClient.isSupported(device)?new GearHubHidClient(device):LamzuHidClient.isSupported(device)&&LAMZU_PRODUCTS.get(device.productId)?.brand==='Attack Shark'?new LamzuHidClient(device):null;
  if(!driver)throw new Error('No verified protocol match for this configuration interface. AULA mouse support needs an exact model and driver.');
  const client=new SharkClient(driver);
  try{return {client,status:await client.readStatus()};}catch(error){await client.close().catch(()=>{});throw error;}
}
