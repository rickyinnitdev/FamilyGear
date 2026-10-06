import type { LightingSnapshot } from './ace-lighting';
export interface ProKey { slot: number; name: string; code: number; actuation: number; press: number; release: number; mode: number; pressStep: number; releaseStep: number; pressDeadzone: number; releaseDeadzone: number }
export interface ProData { snapshot: LightingSnapshot; travel: Uint8Array; physical: Uint8Array; mappings: Uint8Array; layer: number; keys: ProKey[] }
export interface ProTriggerValues { actuation: number; press: number; release: number; mode: number; pressDeadzone: number; releaseDeadzone: number }
export interface ProPerformance { winLock: boolean; macMode: boolean; debounce: boolean; stability: boolean; autoCalibration: boolean; pollingCode?: number }
export function updateProPerformance(snapshot: LightingSnapshot, value: ProPerformance): Uint8Array {
  const next=snapshot.settings.slice(),offset=snapshot.profile*64;
  if(next.length!==256||next[offset+2]!==0xaa||next[offset+3]!==0xbb)throw new Error('Unknown Pro performance layout.');
  const currentMac=(next[offset+1]&3)>=2;
  if(currentMac!==value.macMode)next[offset+1]=(next[offset+1]&0xf0)|(snapshot.profile*4+(value.macMode?2:0));
  next[offset+6]=(next[offset+6]&0xfe)|Number(value.winLock&&!value.macMode);
  const oldDebounce=next[offset+7]>>5;
  next[offset+7]=(next[offset+7]&0x19)|((value.debounce?Math.max(1,oldDebounce):0)<<5)|(Number(value.stability)<<1)|(Number(value.autoCalibration)<<2);
  if(value.pollingCode!==undefined){
    if(![1,2,3,4].includes(value.pollingCode))throw new Error('Choose a supported Pro polling rate.');
    next[offset+4]=(next[offset+4]&0xf0)|value.pollingCode;
  }
  return next;
}
export const BASIC_KEYS = [
  ...Array.from({length:26},(_,i)=>({code:i+4,name:String.fromCharCode(65+i)})),
  ...Array.from({length:9},(_,i)=>({code:i+30,name:String(i+1)})),{code:39,name:'0'},
  ...[[40,'Enter'],[41,'Escape'],[42,'Backspace'],[43,'Tab'],[44,'Space'],[45,'Minus'],[46,'Equal'],[47,'Left bracket'],[48,'Right bracket'],[49,'Backslash'],[51,'Semicolon'],[52,'Quote'],[53,'Backtick'],[54,'Comma'],[55,'Period'],[56,'Slash'],[57,'Caps Lock'],[73,'Insert'],[74,'Home'],[75,'Page Up'],[76,'Delete'],[77,'End'],[78,'Page Down'],[79,'Right arrow'],[80,'Left arrow'],[81,'Down arrow'],[82,'Up arrow'],[101,'Menu'],[224,'Left Ctrl'],[225,'Left Shift'],[226,'Left Alt'],[227,'Left Win'],[228,'Right Ctrl'],[229,'Right Shift'],[230,'Right Alt'],[231,'Right Win']].map(([code,name])=>({code:Number(code),name:String(name)})),
  ...Array.from({length:12},(_,i)=>({code:58+i,name:`F${i+1}`})),
];
export function keyCode(bytes: Uint8Array, offset: number): number {
  if (bytes[offset] !== 16) return -1;
  const modifier=bytes[offset+1], code=bytes[offset+2];
  if (modifier === 0) return code;
  if (code === 0 && (modifier & (modifier-1)) === 0) return 224+Math.log2(modifier);
  return -1;
}
export const keyName = (code:number) => BASIC_KEYS.find(k=>k.code===code)?.name ?? `Code ${code}`;
export function decodeProData(travel: Uint8Array, physical: Uint8Array): ProKey[] {
  if (travel.length !== 1024 || physical.length !== 384) throw new Error('Incomplete Pro trigger or key matrix.');
  const keys: ProKey[]=[];
  for(let slot=0;slot<128;slot++){
    const code=keyCode(physical,slot*3), offset=slot*8;
    if(code<=0)continue;
    if((travel[offset]&0xf0)!==0xa0)throw new Error(`Unknown trigger record for ${keyName(code)}.`);
    const pressPrecision=(travel[offset+3]>>3)&3,releasePrecision=(travel[offset+3]>>1)&3;
    if(pressPrecision>1||releasePrecision>1)throw new Error('Unknown Pro rapid-trigger precision.');
    const value=(o:number)=>((travel[o]|((travel[o+1]&1)<<8))+1);
    keys.push({slot,name:keyName(code),code,actuation:value(offset+2)/100,press:value(offset+4)/(pressPrecision?200:100),release:value(offset+6)/(releasePrecision?200:100),mode:travel[offset+1]&15,pressStep:pressPrecision ? .005 : .01,releaseStep:releasePrecision ? .005 : .01,pressDeadzone:(travel[offset+5]>>1)/100,releaseDeadzone:(travel[offset+7]>>1)/100});
  }
  if(keys.length<50||keys.length>70)throw new Error('Unrecognized Ace 60 Pro physical key matrix.');
  return keys;
}
export function updateProTrigger(data: ProData, slots: number[], values: ProTriggerValues): Uint8Array {
  const available=decodeProData(data.travel,data.physical),next=data.travel.slice();
  if(!slots.length||new Set(slots).size!==slots.length)throw new Error('Select at least one key.');
  if(![0,1,2].includes(values.mode))throw new Error('Unsupported trigger mode.');
  const encode=(mm:number,step:number,min:number,max:number)=>{
    if(!Number.isFinite(mm)||mm<min||mm>max||Math.abs(mm/step-Math.round(mm/step))>.000001)throw new Error(`Use ${min}–${max} mm in ${step} mm steps.`);
    return Math.round(mm/step)-1;
  };
  for(const slot of slots){
    const key=available.find(k=>k.slot===slot);if(!key)throw new Error('Selected physical key was not read.');
    const offset=slot*8;
    if((next[offset]&15)!==0||key.mode>2)throw new Error('Trigger editing currently supports Default switch keys in Normal/RT modes. Other switch types and advanced modes are preserved.');
    const encoded=[encode(values.actuation,.01,.1,3.3),encode(values.press,key.pressStep,key.pressStep*2,key.pressStep===.005?2.5:3.4),encode(values.release,key.releaseStep,key.releaseStep*2,key.releaseStep===.005?2.5:3.4)];
    next[offset+1]=(next[offset+1]&0xf0)|values.mode;
    for(let i=0;i<3;i++){next[offset+2+i*2]=encoded[i]&255;next[offset+3+i*2]=(next[offset+3+i*2]&0xfe)|(encoded[i]>>8);}
    for(const [index,mm] of [[offset+5,values.pressDeadzone],[offset+7,values.releaseDeadzone]]){
      if(!Number.isFinite(mm)||mm<0||mm>1.27||Math.abs(mm*100-Math.round(mm*100))>.00001)throw new Error('Deadzones require 0–1.27 mm in 0.01 mm steps.');
      next[index]=(next[index]&1)|(Math.round(mm*100)<<1);
    }
  }
  return next;
}
export function updateProMapping(data: ProData, slot: number, code: number): Uint8Array {
  if(!data.keys.some(k=>k.slot===slot)||!BASIC_KEYS.some(k=>k.code===code))throw new Error('Choose a physical key and a basic key action.');
  const next=data.mappings.slice(), offset=slot*3;
  // KeyNormal: type 16, modifier mask, HID keyboard usage. Keep all other bindings.
  next.set(code>=224&&code<=231?[16,1<<(code-224),0]:[16,0,code],offset);
  return next;
}
