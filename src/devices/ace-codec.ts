// M HUB framing documented by ace60-re and HallJoy. See THIRD_PARTY_NOTICES.md.
export const ACE_VENDOR = 0x41e4;
export const ACE_MODELS: Record<number, string> = { 0x2101: 'Ace 60', 0x2103: 'Ace 60 Pro' };
export const TRAVEL_BYTES = 1024;
export interface TravelKey { slot: number; actuation: number; press: number; release: number }

export function packet(command: number, offset: number, size: number, data?: Uint8Array): Uint8Array {
  if (!Number.isInteger(offset) || offset < 0 || offset > 65535 || size < 1 || size > 56 || (data && data.length !== size)) throw new Error('Invalid keyboard packet.');
  const bytes = new Uint8Array(64);
  bytes.set([0x55, command, 0, 0, size, offset & 255, offset >> 8, 0]);
  if (data) bytes.set(data, 8);
  bytes[3] = checksum(bytes);
  return bytes;
}

export function checksum(bytes: Uint8Array): number {
  let sum = bytes[4];
  for (let i = 5; i < 8 + bytes[4]; i++) sum += bytes[i];
  return sum & 255;
}

export function isReply(request: Uint8Array, reply: Uint8Array): boolean {
  return reply.length >= 8 + request[4] && reply[0] === 0xaa && reply[1] === request[1] && reply[2] === 0 && reply[4] === request[4]
    && reply[5] === request[5] && reply[6] === request[6] && reply[7] === request[7] && reply[3] === checksum(reply);
}

export function decodeTravel(raw: Uint8Array): TravelKey[] {
  if (raw.length !== TRAVEL_BYTES) throw new Error('Incomplete keyboard configuration.');
  const keys: TravelKey[] = [];
  for (let slot = 0; slot < 128; slot++) {
    const c = raw.subarray(slot * 8, slot * 8 + 8);
    if (!c.some(Boolean)) continue;
    if ((c[0] & 0xf0) !== 0xa0) throw new Error(`Unknown travel record at slot ${slot}; settings remain read-only.`);
    const value = (lo: number, hi: number) => (((hi & 1) << 8) + lo + 1) * 0.02;
    keys.push({ slot, actuation: value(c[2], c[3]), press: value(c[4], c[5]), release: value(c[6], c[7]) });
  }
  if (!keys.length) throw new Error('No valid travel records were returned.');
  return keys;
}

export function updateTravel(raw: Uint8Array, slots: number[], values: Omit<TravelKey, 'slot'>): Uint8Array {
  const available = new Set(decodeTravel(raw).map(k => k.slot));
  if (!slots.length || slots.some(slot => !available.has(slot))) throw new Error('Select valid keyboard slots.');
  const encode = (mm: number) => {
    if (!Number.isFinite(mm) || mm < 0.1 || mm > 4 || Math.abs(mm / 0.02 - Math.round(mm / 0.02)) > 0.00001) throw new Error('Use a distance from 0.10 to 4.00 mm in 0.02 mm steps.');
    return Math.round(mm / 0.02) - 1;
  };
  const valuesEncoded = [encode(values.actuation), encode(values.press), encode(values.release)];
  const result = raw.slice();
  for (const slot of slots) {
    for (let j = 0; j < 3; j++) {
      const i = slot * 8 + 2 + j * 2;
      result[i] = valuesEncoded[j] & 255;
      // Preserve switch type, key mode, precision bits, and deadzones.
      result[i + 1] = (result[i + 1] & 0xfe) | (valuesEncoded[j] >> 8);
    }
  }
  return result;
}
