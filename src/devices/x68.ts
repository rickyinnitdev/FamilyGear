// Independently implemented from documented X68HE wire fields. No MCHOSE commands.
export const X68_FILTER = { vendorId: 0x3151, productId: 0x502d, usagePage: 0xffff, usage: 2 };
export const X68_RATES = [8000, 4000, 2000, 1000, 500, 250, 125];
export function x68Packet(values: number[], checksum = 7) {
  const bytes = new Uint8Array(64); bytes.set(values);
  bytes[checksum] = 255 - (bytes.slice(0, checksum).reduce((a, b) => a + b, 0) & 255);
  return bytes;
}
export function x68Response(view: DataView, command: number) {
  let bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  if (bytes.length === 65 && bytes[0] === 0) bytes = bytes.slice(1);
  if (bytes.length !== 64 || bytes[0] !== command) throw Error('X68HE response was not recognized. Close other configurators and reconnect.');
  return bytes.slice();
}
export type X68State = { profile: number; light: Uint8Array; rate: Uint8Array; travel: Map<number, Uint8Array>; pollingWritable: boolean; firmware?:number; scale?:number };
export function x68Raw(view:DataView,command:number){let b=new Uint8Array(view.buffer,view.byteOffset,view.byteLength);if(b.length===65&&b[0]===0)b=b.slice(1);if(b.length!==64||b[0]===command)throw Error('Unrecognized raw X68HE page');return b.slice();}
export function x68Distance(state:X68State,param:number,slot:number){const b=state.travel.get(param);if(!b||slot<0||slot>=128||!state.scale)return undefined;const value=state.scale===10?b[slot]:(b[slot*2]|b[slot*2+1]<<8);return state.scale===10?(param===6?39-value:value+1)/10:value/state.scale;}
export type X68Trigger={actuation:number;release:number;press:number;reset:number;bottom:number;rapid:boolean};
export class X68Client {
  private queue: Promise<unknown> = Promise.resolve();
  private verifiedKeys=new Map<string,number>();
  private mappingBaseline:{code:string;profile:number;firmware:number|undefined;bytes:Uint8Array}|null=null;
  constructor(readonly device: HIDDevice,private wait:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms))) {}
  private serial<T>(action: () => Promise<T>): Promise<T> { const task = this.queue.then(action); this.queue = task.catch(() => {}); return task; }
  private async exchange(values: number[], checksum = 7) {
    await this.device.sendFeatureReport(0, x68Packet(values, checksum));
    await this.wait(35);
    return x68Response(await this.device.receiveFeatureReport(0), values[0]);
  }
  private async rawPages(param:number,pages:number){const bytes=new Uint8Array(pages*64);for(let page=0;page<pages;page++){await this.device.sendFeatureReport(0,x68Packet([0xe5,param,1,page]));await this.wait(35);bytes.set(x68Raw(await this.device.receiveFeatureReport(0),0xe5),page*64);}return bytes;}
  static async connect(device: HIDDevice) {
    if (device.vendorId !== X68_FILTER.vendorId || device.productId !== X68_FILTER.productId || !device.collections.some(c => c.usagePage === 0xffff && c.usage === 2 && c.featureReports?.some(r => r.reportId === 0))) throw Error('Select the X68HE vendor configuration interface (3151:502D).');
    if (!device.opened) await device.open();
    const client = new X68Client(device);
    try { return { client, state: await client.read() }; } catch (error) { await device.close(); throw error; }
  }
  private async readUnlocked(): Promise<X68State> {
    // The current official ry5088 HE driver uses GET83/SET03 for polling,
    // GET84 for profile. SET04 switches profiles: never use it as a fallback.
    let pollingWritable = false, rate: Uint8Array, profile: number;
    try { rate = await this.exchange([0x83]); if (rate[2] > 6) throw Error('Unknown rate'); profile = (await this.exchange([0x84]))[1]; pollingWritable = true; }
    catch { profile = (await this.exchange([0x85]))[1]; rate = await this.exchange([0x84, profile]); }
    const light = await this.exchange([0x87]);
    if (profile > 3 || rate[2] > 6 || light[1] > 25 || light[2] > 4 || light[3] > 4) throw Error('Unsupported X68HE settings layout; no settings were written.');
    const travel = new Map<number, Uint8Array>();
    let firmware:number|undefined,scale:number|undefined;
    // The official HE driver returns raw 64-byte E5 pages, not echoed headers.
    // Firmware GET8F bytes 7/8 select its u8/u16 distance representation.
    try{const version=await this.exchange([0x8f]);firmware=version[7]|version[8]<<8;if(!firmware||firmware===65535)throw Error('No firmware identity');scale=firmware<768?10:firmware<1280?100:200;
      for(const param of [0,1,2,3,6,7]){const count=param===7||scale===10?2:4;const bytes=await this.rawPages(param,count),confirm=await this.rawPages(param,count);if(bytes.some((v,i)=>v!==confirm[i]))throw Error('Unstable HE read');travel.set(param,bytes);}
      const temporary={profile,rate,light,travel,pollingWritable,firmware,scale};for(let slot=0;slot<128;slot++){const option=travel.get(7)![slot];if(![0,2,3,4,5,7,8,9,10].includes(option&15))throw Error('Unknown key mode');for(const param of [0,1,2,3,6]){const mm=x68Distance(temporary,param,slot)!;if(!Number.isFinite(mm)||mm<0||mm>4)throw Error('Unknown distance encoding');}}
    }catch{travel.clear();}
    if((await this.exchange([pollingWritable?0x84:0x85]))[1]!==profile)throw Error('Profile changed during settings read');
    return { profile, rate, light, travel, pollingWritable,firmware,scale };
  }
  mappedSlot(code:string){return this.verifiedKeys.get(code);}
  armKey(code:string,snapshot:X68State){return this.serial(async()=>{if(!snapshot.scale||!snapshot.travel.size)throw Error('Read recognized trigger settings first');const bytes=await this.rawPages(254,snapshot.scale===10?2:4);const values=Array.from({length:128},(_,i)=>snapshot.scale===10?bytes[i]/10:(bytes[i*2]|bytes[i*2+1]<<8)/snapshot.scale!);if(values.some(v=>v>.15))throw Error('Release every key before starting verification');this.mappingBaseline={code,profile:snapshot.profile,firmware:snapshot.firmware,bytes};});}
  verifyHeldKey(code:string,snapshot:X68State){return this.serial(async()=>{if(!snapshot.scale||!snapshot.travel.size||this.mappingBaseline?.code!==code)throw Error('Start verification with every key released first');const current=await this.readUnlocked();if(current.profile!==this.mappingBaseline.profile||current.firmware!==this.mappingBaseline.firmware)throw Error('Device changed; load settings again');const a=await this.rawPages(254,snapshot.scale===10?2:4),b=await this.rawPages(254,snapshot.scale===10?2:4);const distance=(v:Uint8Array,i:number)=>snapshot.scale===10?v[i]/10:(v[i*2]|v[i*2+1]<<8)/snapshot.scale!;const hits=Array.from({length:128},(_,i)=>i).filter(i=>distance(a,i)-distance(this.mappingBaseline!.bytes,i)>=.5&&distance(a,i)<=4&&distance(b,i)>=.5&&distance(b,i)<=4);if(hits.length!==1)throw Error('Hold only the selected key at least halfway down, then verify again');if([...this.verifiedKeys].some(([key,slot])=>key!==code&&slot===hits[0]))throw Error('This slot is already associated with another key');this.verifiedKeys.set(code,hits[0]);this.mappingBaseline=null;return hits[0];});}
  applyTrigger(snapshot:X68State,codes:string[],values:X68Trigger){return this.serial(async()=>{
    const slots=[...new Set(codes.map(code=>{const slot=this.verifiedKeys.get(code);if(slot===undefined)throw Error('Verify each selected physical key first');return slot;}))];if(!slots.length||!snapshot.scale||!snapshot.travel.size)throw Error('No verified trigger selection');
    const now=await this.readUnlocked();if(now.profile!==snapshot.profile||now.firmware!==snapshot.firmware||now.travel.size!==snapshot.travel.size||[...snapshot.travel].some(([p,b])=>b.some((v,i)=>v!==now.travel.get(p)?.[i])))throw Error('Trigger settings changed; load current settings');
    const changes: Array<{param:number;slot:number;bytes:number[]}>=[];const expected=new Map([...now.travel].map(([p,b])=>[p,b.slice()]));
    for(const slot of slots){if((now.travel.get(7)![slot]&15)!==0)throw Error('Advanced binding is active; trigger editing preserves it by refusing this key');
      for(const [param,mm] of [[0,values.actuation],[1,values.release],[2,values.press],[3,values.reset],[6,values.bottom]]){if((param===2||param===3)&&!values.rapid)continue;const min=param===6?0:now.scale===10?.1:.01,max=param===6?1:param===0||param===1?3.3:2;if(!Number.isFinite(mm)||mm<min||mm>max)throw Error('Trigger distance outside supported range');const raw=now.scale===10?(param===6?39-Math.round(mm*10):Math.round(mm*10)-1):Math.round(mm*now.scale!);const bytes=now.scale===10?[raw]:[raw&255,raw>>8];const offset=now.scale===10?slot:slot*2;expected.get(param)!.set(bytes,offset);if(bytes.some((v,i)=>v!==now.travel.get(param)![offset+i]))changes.push({param,slot,bytes});}
      const option=(now.travel.get(7)![slot]&127)|(values.rapid?128:0);expected.get(7)![slot]=option;if(option!==now.travel.get(7)![slot])changes.push({param:7,slot,bytes:[option]});
    }
    for(let i=0;i<changes.length;i++){const c=changes[i];await this.device.sendFeatureReport(0,x68Packet([0x65,c.param,0,c.slot,i===changes.length-1?1:0,0,0,0,...c.bytes]));await this.wait(35);}await this.wait(150);const after=await this.readUnlocked();if(after.profile!==now.profile||after.firmware!==now.firmware||after.travel.size!==expected.size||[...expected].some(([p,b])=>b.some((v,i)=>v!==after.travel.get(p)?.[i])))throw Error('Trigger readback did not confirm the complete settings; load current settings');return after;
  });}
  read() { return this.serial(() => this.readUnlocked()); }
  apply(snapshot: X68State, light: Uint8Array, rateCode: number) {
    return this.serial(async () => {
      if (!Number.isInteger(rateCode) || rateCode < 0 || rateCode > 6 || light.length !== 64 || light[1] > 25 || light[2] > 4 || light[3] > 4) throw Error('Invalid X68HE values');
      const now = await this.readUnlocked();
      if (now.pollingWritable !== snapshot.pollingWritable || now.profile !== snapshot.profile || now.light.slice(1, 8).some((v, i) => v !== snapshot.light[i + 1]) || now.rate[2] !== snapshot.rate[2]) throw Error('Device settings changed. Refresh before applying.');
      if (rateCode !== now.rate[2] && !now.pollingWritable) throw Error('Polling protocol is not recognized on this firmware. No changes were written.');
      // SET is send-only in the official driver; a GET of the SET response is
      // not an acknowledgement. Verify only with the actual settings GET.
      if (rateCode !== now.rate[2]) { await this.device.sendFeatureReport(0, x68Packet([0x03, 0, rateCode])); await this.wait(150); }
      if (light.slice(1, 8).some((v, i) => v !== now.light[i + 1])) { await this.device.sendFeatureReport(0, x68Packet([0x07, ...light.slice(1, 8)],8)); await this.wait(150); }
      const result = await this.readUnlocked();
      if (result.profile !== now.profile || result.rate[2] !== rateCode || result.light.slice(1, 8).some((v, i) => v !== light[i + 1])) throw Error('X68HE readback did not confirm the changes. Load current settings to see device values.');
      return result;
    });
  }
  async close() { await this.queue; if (this.device.opened) await this.device.close(); }
}
