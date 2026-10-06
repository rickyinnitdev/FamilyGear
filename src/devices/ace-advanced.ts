import { BASIC_KEYS, type ProData } from './ace-pro';
export interface AdvancedData { keys: ProData; mappings: Uint8Array; mt: Uint8Array; dks: Uint8Array; tgl?:Uint8Array }
export interface AdvancedValue { type: 'mt'|'rs'|'socd'|'dks'|'tgl'|'remove'; slot: number; second?: number; tap?: number; hold?: number; delay?: number; priority?: number; actions?: number[] }
export function basicBytes(code:number):number[] {
  if(!BASIC_KEYS.some(k=>k.code===code))throw new Error('Choose a basic key action.');
  return code>=224?[16,1<<(code-224),0]:[16,0,code];
}
export function planAdvanced(data:AdvancedData,value:AdvancedValue):AdvancedData {
  if(!['mt','rs','socd','dks','tgl','remove'].includes(value.type))throw new Error('Unknown advanced binding type.');
  const {keys}=data, layerStart=keys.layer*512;
  if(data.mappings.length!==2048||data.mt.length!==256||data.dks.length!==768)throw new Error('Incomplete advanced configuration.');
  const next:AdvancedData={keys:{...keys,travel:keys.travel.slice()},mappings:data.mappings.slice(),mt:data.mt.slice(),dks:data.dks.slice(),tgl:data.tgl?.slice()};
  const physical=(slot:number)=>{if(!keys.keys.some(k=>k.slot===slot))throw new Error('Select a physical key.');return Array.from(keys.physical.slice(slot*3,slot*3+3));};
  physical(value.slot);
  const binding=(slot:number)=>layerStart+slot*3;
  if(value.type==='remove'){
    const offset=binding(value.slot),type=next.mappings[offset];
    if(![144,145,146,147,148].includes(type))throw new Error('Select an advanced binding to remove.');
    const slots=[value.slot];
    if(type===147||type===148){const partner=next.mappings[offset+2];physical(partner);if(next.mappings[binding(partner)]!==type||next.mappings[binding(partner)+2]!==value.slot)throw new Error('Unknown paired binding.');slots.push(partner);}
    for(const slot of slots){next.mappings.set(physical(slot),binding(slot));if(type===148)next.keys.travel[slot*8+1]&=15;}
    return next;
  }
  const pair=value.type==='rs'||value.type==='socd';
  const slots=pair?[value.slot,value.second!]:[value.slot];
  if(new Set(slots).size!==slots.length)throw new Error('Choose two different keys.');
  for(const slot of slots){physical(slot);if(keys.mappings[slot*3]!==16)throw new Error('Remove the existing advanced binding before creating another.');}
  const family=value.type==='dks'?[144]:value.type==='tgl'?[145]:[146,147,148,149],used=new Set<number>();
  let bindingCount=0;
  for(let layer=0;layer<4;layer++)for(let slot=0;slot<128;slot++){const o=layer*512+slot*3,type=data.mappings[o];if([144,145,146].includes(type)||([147,148,149].includes(type)&&slot<data.mappings[o+2]))bindingCount++;}
  if(bindingCount>=40)throw new Error('The profile already has 40 advanced bindings. Remove one first.');
  for(let layer=0;layer<4;layer++)for(let slot=0;slot<128;slot++){const o=layer*512+slot*3;if(family.includes(data.mappings[o]))used.add(data.mappings[o+1]);}
  const free=Array.from({length:32},(_,i)=>i).filter(i=>!used.has(i)).slice(0,slots.length);
  if(free.length!==slots.length)throw new Error('No free advanced slots in this profile.');
  if(value.type==='tgl'){
    if(next.tgl?.length!==128)throw new Error('Load Toggle action data first.');
    next.tgl.set(basicBytes(value.hold!),free[0]*3);next.mappings.set([145,free[0],0],binding(value.slot));
  }else if(value.type==='mt'){
    if(!Number.isInteger(value.delay)||value.delay!<10||value.delay!>2550||value.delay!%10)throw new Error('Hold delay requires 10–2550 ms in 10 ms steps.');
    next.mt.set([...basicBytes(value.tap!),...basicBytes(value.hold!)],free[0]*6);
    next.mappings.set([146,free[0],value.delay!/10],binding(value.slot));
  }else if(pair){
    if(value.type==='socd'&&![0,1,2,3].includes(value.priority!))throw new Error('Choose a SOCD priority.');
    for(let i=0;i<2;i++){
      next.mt.set([...physical(slots[i]),...physical(slots[1-i])],free[i]*6);
      next.mappings.set([value.type==='rs'?147:148,free[i],slots[1-i]],binding(slots[i]));
      if(value.type==='socd'){const p=i===0?value.priority!:value.priority===1?2:value.priority===2?1:value.priority!;next.keys.travel[slots[i]*8+1]=(keys.travel[slots[i]*8+1]&15)|(p<<4);}
    }
  }else if(value.type==='dks'){
    if(value.actions?.length!==4)throw new Error('Choose four DKS actions.');
    const record=new Uint8Array(24);record.set([10,30,30,10]);
    // Four pulses: shallow press, deep press, deep release, shallow release.
    const events=[9,36,64,512];
    value.actions.forEach((code,i)=>{const o=4+i*5;record.set([...basicBytes(code),events[i]&255,events[i]>>8],o);});
    next.dks.set(record,free[0]*24);next.mappings.set([144,free[0],0],binding(value.slot));
  }
  return next;
}
