import type { ProData } from './ace-pro';
export interface LiveTravel { slot:number; mm:number; calibration:number }
// M HUB legacy unsolicited A0 report: physical action, BE travel, status.
export function decodeLiveTravel(bytes:Uint8Array,data:ProData):LiveTravel|null {
  if(bytes.length<11||bytes[0]!==0xa0)return null;
  const key=data.keys.find(k=>data.physical[k.slot*3]===bytes[1]&&data.physical[k.slot*3+1]===bytes[2]&&data.physical[k.slot*3+2]===bytes[3]);
  const travel=(bytes[6]<<8)|bytes[7];
  if(!key||travel>400)return null;
  return {slot:key.slot,mm:travel/100,calibration:bytes[10]};
}
