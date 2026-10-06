import { ACE_MODELS, ACE_VENDOR, decodeTravel, isReply, packet, TRAVEL_BYTES, updateTravel, type TravelKey } from './ace-codec';
import { decodeLighting, updateLighting, type AceLighting, type LightingSnapshot } from './ace-lighting';
import { decodeProData, updateProMapping, updateProTrigger, updateProPerformance, type ProData, type ProTriggerValues, type ProPerformance } from './ace-pro';
import { planAdvanced, type AdvancedData, type AdvancedValue } from './ace-advanced';
import { decodeLiveTravel, type LiveTravel } from './ace-live';

export interface AceStatus { name: string; firmware: string; profile: number | null; keys: TravelKey[]; canWrite: boolean; raw: Uint8Array | null; lighting?: AceLighting; lightingSnapshot?: LightingSnapshot; canWriteLighting?: boolean }
export class AceClient {
  private queue: Promise<unknown> = Promise.resolve();
  private pendingCancel: (() => void) | null = null;
  private live: {profile:number; debug:number; listener:(event:HIDInputReportEvent)=>void; calibrating:boolean}|null=null;
  constructor(readonly device: HIDDevice, private reportId: number) {}
  static accepts(device: HIDDevice) { return device.vendorId === ACE_VENDOR && Boolean(ACE_MODELS[device.productId]); }
  static async connect(device: HIDDevice): Promise<{ client: AceClient; status: AceStatus }> {
    if (!AceClient.accepts(device)) throw new Error('This Ace model is not supported by the first version.');
    if (!device.opened) await device.open();
    const ids = new Set<number>();
    const scan = (c: HIDCollectionInfo) => {
      for (const r of c.outputReports ?? []) {
        const length = (r.items ?? []).reduce((sum, item) => sum + (item.reportSize ?? 0) * (item.reportCount ?? 0), 0) / 8;
        if (length === 64 && r.reportId !== undefined) ids.add(r.reportId);
      }
      c.children?.forEach(scan);
    };
    device.collections.forEach(scan);
    for (const id of ids) {
      const client = new AceClient(device, id);
      try { return { client, status: await client.readStatus() }; } catch { /* Try the next documented 64-byte output channel. */ }
    }
    await device.close().catch(() => {});
    throw new Error('The keyboard did not answer a read request. Close M HUB and other keyboard tools, use wired USB, and try again. Your firmware may require a native bridge.');
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  private async exchange(request: Uint8Array): Promise<Uint8Array> {
    if (!this.device.opened) throw new Error('Keyboard disconnected.');
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.device.removeEventListener('inputreport', listener); this.pendingCancel = null; };
      const listener = (event: HIDInputReportEvent) => {
        const reply = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (isReply(request, reply)) { cleanup(); resolve(reply.slice()); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Keyboard response timed out; no settings were assumed.')); }, 1200);
      this.pendingCancel = () => { cleanup(); reject(new Error('Keyboard disconnected.')); };
      this.device.addEventListener('inputreport', listener);
      this.device.sendReport(this.reportId, request.slice().buffer).catch(error => { cleanup(); reject(error); });
    });
  }
  private async readBlock(command: number, length: number, start = 0): Promise<Uint8Array> {
    const result = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 56) {
      const size = Math.min(56, length - offset);
      const reply = await this.exchange(packet(command, start + offset, size));
      result.set(reply.subarray(8, 8 + size), offset);
    }
    return result;
  }
  private async guardPro(snapshot: LightingSnapshot) {
    if(this.live)throw new Error('Exit live travel or calibration before changing settings.');
    if (this.device.productId !== 0x2103 || snapshot.firmware !== '1.18') throw new Error('Pro controls support firmware 1.18 only.');
    const info = await this.exchange(packet(3, 0, 22));
    if (info[8] !== 0x18 || info[9] !== 1) throw new Error('Firmware changed; refresh first.');
    const base = await this.readBlock(4,6),settings=await this.readBlock(5,256);
    if (!this.same(base,snapshot.base)||!this.same(settings,snapshot.settings)||base[2+base[0]]!==snapshot.profile) throw new Error('Keyboard settings or profile changed. Refresh and load keys again.');
  }
  private same(a: Uint8Array,b: Uint8Array) { return a.length===b.length&&a.every((v,i)=>v===b[i]); }
  applyProPerformance(snapshot: LightingSnapshot, value: ProPerformance): Promise<Uint8Array> {
    return this.run(async()=>{
      await this.guardPro(snapshot);
      const next=updateProPerformance(snapshot,value),offset=snapshot.profile*64;
      // Polling last: changing it can cause a USB restart on this firmware.
      for(const field of [1,6,7,4])if(next[offset+field]!==snapshot.settings[offset+field])await this.exchange(packet(6,offset+field,1,next.slice(offset+field,offset+field+1)));
      const confirmed=await this.readBlock(5,256),base=await this.readBlock(4,6);
      if(!this.same(next,confirmed)||!this.same(base,snapshot.base))throw new Error('Performance readback differs; refresh or reconnect to inspect current settings.');
      return confirmed;
    });
  }
  loadProKeys(snapshot: LightingSnapshot, layer = 0): Promise<ProData> {
    return this.run(async()=>{
      await this.guardPro(snapshot);
      if(!Number.isInteger(layer)||layer<0||layer>3)throw new Error('Select a valid keyboard layer.');
      const travel=await this.readBlock(0xa0,1024,snapshot.profile*1024);
      const physical=await this.readBlock(7,384,0);
      const mappings=await this.readBlock(8,384,(snapshot.profile*4+layer)*512);
      const keys=decodeProData(travel,physical);
      await this.guardPro(snapshot);
      return {snapshot,travel,physical,mappings,layer,keys};
    });
  }
  startLiveTravel(data:ProData,onTravel:(value:LiveTravel)=>void,calibrating=false):Promise<void> {
    return this.run(async()=>{
      if(this.live)throw new Error('Stop the current travel session first.');
      await this.guardPro(data.snapshot);
      const offset=data.snapshot.profile*64+7,debug=data.snapshot.settings[offset]&8;
      const listener=(event:HIDInputReportEvent)=>{
        const value=decodeLiveTravel(new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength),data);
        if(value)onTravel(value);
      };
      this.live={profile:data.snapshot.profile,debug,listener,calibrating};
      this.device.addEventListener('inputreport',listener);
      try {
        const next=data.snapshot.settings[offset]|8;
        await this.exchange(packet(6,offset,1,new Uint8Array([next])));
        if((await this.readBlock(5,1,offset))[0]!==next)throw new Error('Live travel mode did not read back.');
        if(calibrating)await this.exchange(packet(0xa8,0,1,new Uint8Array([0])));
      }catch(error){await this.stopLiveInternal();throw error;}
    });
  }
  private async stopLiveInternal() {
    const session=this.live;if(!session)return;
    this.device.removeEventListener('inputreport',session.listener);
    if(!this.device.opened){this.live=null;return;}
    // Exit calibration even when its start ACK was lost; always attempt debug cleanup.
    let failure:unknown;
    try {if(session.calibrating)await this.exchange(packet(0xa9,0,1,new Uint8Array([0])));}catch(error){failure=error;}
    try {
      const offset=session.profile*64+7,current=await this.readBlock(5,1,offset),next=(current[0]&~8)|session.debug;
      await this.exchange(packet(6,offset,1,new Uint8Array([next])));
      if((await this.readBlock(5,1,offset))[0]!==next)throw new Error('Could not restore live travel mode. Reconnect and refresh.');
    }catch(error){failure=error;}
    if(failure)throw failure;
    this.live=null;
  }
  stopLiveTravel():Promise<void> {return this.run(()=>this.stopLiveInternal());}
  applyProTrigger(data: ProData, slots: number[], values: ProTriggerValues): Promise<ProData> {
    return this.run(async()=>{
      await this.guardPro(data.snapshot);
      const start=data.snapshot.profile*1024;
      const current=await this.readBlock(0xa0,1024,start),physical=await this.readBlock(7,384);
      if(!this.same(current,data.travel)||!this.same(physical,data.physical))throw new Error('Trigger data changed. Load keys again.');
      const next=updateProTrigger(data,slots,values);
      for(const slot of slots){const offset=slot*8;if(!this.same(next.slice(offset,offset+8),current.slice(offset,offset+8)))await this.exchange(packet(0xa1,start+offset,8,next.slice(offset,offset+8)));}
      const confirmed=await this.readBlock(0xa0,1024,start);
      if(!this.same(next,confirmed))throw new Error('Trigger readback differs; some changes may have applied. Load keys again.');
      await this.guardPro(data.snapshot);
      return {...data,travel:confirmed,keys:decodeProData(confirmed,physical)};
    });
  }
  applyProMapping(data: ProData, slot: number, code: number): Promise<ProData> {
    return this.run(async()=>{
      await this.guardPro(data.snapshot);
      const start=(data.snapshot.profile*4+data.layer)*512;
      const current=await this.readBlock(8,384,start),physical=await this.readBlock(7,384);
      if(!this.same(current,data.mappings)||!this.same(physical,data.physical))throw new Error('Key bindings changed. Load keys again.');
      const next=updateProMapping(data,slot,code),offset=slot*3;
      if(!this.same(next,current))await this.exchange(packet(9,start+offset,3,next.slice(offset,offset+3)));
      const confirmed=await this.readBlock(8,384,start);
      if(!this.same(next,confirmed))throw new Error('Key-map readback differs; load keys again.');
      await this.guardPro(data.snapshot);
      return {...data,mappings:confirmed};
    });
  }
  loadAdvanced(keys:ProData):Promise<AdvancedData> {
    return this.run(async()=>{
      await this.guardPro(keys.snapshot);
      const profile=keys.snapshot.profile;
      const mappings=await this.readBlock(8,2048,profile*2048),mt=await this.readBlock(0xa4,256,profile*256),dks=await this.readBlock(0xa2,768,profile*768),tgl=await this.readBlock(0xa6,128,profile*128);
      if(!this.same(mappings.slice(keys.layer*512,keys.layer*512+384),keys.mappings))throw new Error('Bindings changed; load keys again.');
      await this.guardPro(keys.snapshot);
      return {keys,mappings,mt,dks,tgl};
    });
  }
  applyAdvanced(data:AdvancedData,value:AdvancedValue):Promise<AdvancedData> {
    return this.run(async()=>{
      await this.guardPro(data.keys.snapshot);
      const profile=data.keys.snapshot.profile;
      const mappings=await this.readBlock(8,2048,profile*2048),mt=await this.readBlock(0xa4,256,profile*256),dks=await this.readBlock(0xa2,768,profile*768),tgl=await this.readBlock(0xa6,128,profile*128),travel=await this.readBlock(0xa0,1024,profile*1024),physical=await this.readBlock(7,384);
      if(!this.same(mappings,data.mappings)||!this.same(mt,data.mt)|| !this.same(dks,data.dks)||!data.tgl||!this.same(tgl,data.tgl)||!this.same(travel,data.keys.travel)||!this.same(physical,data.keys.physical))throw new Error('Advanced configuration changed. Load keys again.');
      const next=planAdvanced(data,value);
      // Store auxiliary actions before activating the corresponding key binding.
      for(const [before,after,readSize,command,start] of [[mt,next.mt,6,0xa5,profile*256],[dks,next.dks,24,0xa3,profile*768],[tgl,next.tgl!,3,0xa7,profile*128],[travel,next.keys.travel,8,0xa1,profile*1024]] as const){
        for(let offset=0;offset<before.length;offset+=readSize){const size=Math.min(readSize,before.length-offset);if(!this.same(before.slice(offset,offset+size),after.slice(offset,offset+size)))await this.exchange(packet(command,start+offset,size,after.slice(offset,offset+size)));}
      }
      for(let layer=0;layer<4;layer++)for(let slot=0;slot<128;slot++){const o=layer*512+slot*3;if(!this.same(mappings.slice(o,o+3),next.mappings.slice(o,o+3)))await this.exchange(packet(9,profile*2048+o,3,next.mappings.slice(o,o+3)));}
      const confirmedMaps=await this.readBlock(8,2048,profile*2048),confirmedMt=await this.readBlock(0xa4,256,profile*256),confirmedDks=await this.readBlock(0xa2,768,profile*768),confirmedTravel=await this.readBlock(0xa0,1024,profile*1024),confirmedTgl=await this.readBlock(0xa6,128,profile*128);
      if(!this.same(confirmedMaps,next.mappings)||!this.same(confirmedMt,next.mt)||!this.same(confirmedDks,next.dks)||!this.same(confirmedTravel,next.keys.travel)||!this.same(confirmedTgl,next.tgl!))throw new Error('Advanced readback differs. Some writes may have applied; reload before continuing.');
      await this.guardPro(data.keys.snapshot);
      return {...next,keys:{...next.keys,mappings:confirmedMaps.slice(data.keys.layer*512,data.keys.layer*512+384),keys:decodeProData(confirmedTravel,physical)}};
    });
  }
  readStatus(): Promise<AceStatus> {
    return this.run(async () => {
      // Pro's reviewed GetInfo response is 22 bytes. Base model requests 32.
      const pro = this.device.productId === 0x2103;
      const info = await this.exchange(packet(0x03, 0, pro ? 22 : 32));
      const firmware = `${info[9].toString(16)}.${info[8].toString(16).padStart(2, '0')}`;
      if (pro) {
        const base = await this.readBlock(0x04, 6);
        if (base[1] < 1 || base[1] > 4 || base[0] >= base[1] || base[2 + base[0]] > 3) throw new Error('Unknown Pro profile layout; connection stopped.');
        const profile = base[2 + base[0]];
        const settings = await this.readBlock(0x05, 256);
        if (settings[profile * 64 + 2] !== 0xaa || settings[profile * 64 + 3] !== 0xbb) throw new Error('Unknown Pro configuration layout.');
        return { name: 'MCHOSE Ace 60 Pro', firmware, profile: profile + 1, keys: [], canWrite: false, raw: null, lighting: decodeLighting(settings, profile), lightingSnapshot: { settings, base, profile, firmware }, canWriteLighting: firmware === '1.18' };
      }
      const raw = await this.readBlock(0xa0, TRAVEL_BYTES);
      return { name: 'MCHOSE Ace 60', firmware, profile: null, keys: decodeTravel(raw), canWrite: true, raw };
    });
  }
  applyLighting(snapshot: LightingSnapshot, value: AceLighting): Promise<Uint8Array> {
    return this.run(async () => {
      if (this.device.productId !== 0x2103 || snapshot.firmware !== '1.18') throw new Error('Lighting writes currently support Ace 60 Pro firmware 1.18 only.');
      const info = await this.exchange(packet(3, 0, 22));
      if (info[8] !== 0x18 || info[9] !== 1) throw new Error('Firmware changed; refresh before applying.');
      const base = await this.readBlock(4, 6), current = await this.readBlock(5, 256);
      const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
      if (!same(base, snapshot.base) || !same(current, snapshot.settings) || base[2 + base[0]] !== snapshot.profile) throw new Error('Keyboard settings or active profile changed. Refresh before applying lighting.');
      const next = updateLighting(current, snapshot.profile, value);
      // Only the main-light range; preserve direction and color index.
      const offset = snapshot.profile * 64 + 8;
      if (!same(current, next)) await this.exchange(packet(6, offset, 9, next.slice(offset, offset + 9)));
      const confirmed = await this.readBlock(5, 256), confirmedBase = await this.readBlock(4, 6);
      if (!same(confirmed, next) || !same(confirmedBase, base)) throw new Error('Lighting readback differs. Refresh to inspect the current state; changes may have applied.');
      return confirmed;
    });
  }
  setWinLock(snapshot: LightingSnapshot, enabled: boolean): Promise<Uint8Array> {
    return this.run(async () => {
      if (this.device.productId !== 0x2103 || snapshot.firmware !== '1.18') throw new Error('Win lock supports Ace 60 Pro firmware 1.18.');
      const info = await this.exchange(packet(3, 0, 22));
      if (info[8] !== 0x18 || info[9] !== 1) throw new Error('Firmware changed; refresh first.');
      const base = await this.readBlock(4, 6), settings = await this.readBlock(5, 256);
      const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
      if (!same(base, snapshot.base) || !same(settings, snapshot.settings)) throw new Error('Keyboard settings changed. Refresh first.');
      decodeLighting(settings, snapshot.profile);
      const offset = snapshot.profile * 64 + 6;
      const next = settings.slice(); next[offset] = (next[offset] & 0xfe) | Number(enabled);
      if (next[offset] !== settings[offset]) await this.exchange(packet(6, offset, 1, next.slice(offset, offset + 1)));
      const confirmed = await this.readBlock(5, 256), confirmedBase = await this.readBlock(4, 6);
      if (!same(next, confirmed) || !same(base, confirmedBase)) throw new Error('Win-lock readback differs; refresh to inspect.');
      return confirmed;
    });
  }
  applyTravel(snapshot: Uint8Array, slots: number[], values: Omit<TravelKey, 'slot'>): Promise<Uint8Array> {
    return this.run(async () => {
      if (this.device.productId !== 0x2101) throw new Error('Pro settings are read-only in this version.');
      const current = await this.readBlock(0xa0, TRAVEL_BYTES);
      if (current.some((b, i) => b !== snapshot[i]) || snapshot.length !== current.length) throw new Error('Keyboard settings changed. Refresh before applying.');
      const next = updateTravel(current, slots, values);
      for (let offset = 0; offset < TRAVEL_BYTES; offset += 56) {
        const size = Math.min(56, TRAVEL_BYTES - offset);
        if (next.subarray(offset, offset + size).every((b, i) => b === current[offset + i])) continue;
        await this.exchange(packet(0xa1, offset, size, next.slice(offset, offset + size)));
      }
      const confirmed = await this.readBlock(0xa0, TRAVEL_BYTES);
      if (confirmed.some((b, i) => b !== next[i])) throw new Error('Readback differs from the requested settings. Refresh to inspect the current state; some changes may have applied.');
      return confirmed;
    });
  }
  async close() { this.pendingCancel?.(); await this.queue; try {await this.stopLiveTravel();} finally {if (this.device.opened) await this.device.close();} }
}
