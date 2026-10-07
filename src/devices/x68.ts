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
export type X68State = { profile: number; light: Uint8Array; rate: Uint8Array; travel: Map<number, Uint8Array> };
export class X68Client {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly device: HIDDevice) {}
  private serial<T>(action: () => Promise<T>): Promise<T> { const task = this.queue.then(action); this.queue = task.catch(() => {}); return task; }
  private async exchange(values: number[], checksum = 7) {
    await this.device.sendFeatureReport(0, x68Packet(values, checksum));
    await new Promise(resolve => setTimeout(resolve, 35));
    return x68Response(await this.device.receiveFeatureReport(0), values[0]);
  }
  static async connect(device: HIDDevice) {
    if (device.vendorId !== X68_FILTER.vendorId || device.productId !== X68_FILTER.productId || !device.collections.some(c => c.usagePage === 0xffff && c.usage === 2 && c.featureReports?.some(r => r.reportId === 0))) throw Error('Select the X68HE vendor configuration interface (3151:502D).');
    if (!device.opened) await device.open();
    const client = new X68Client(device);
    try { return { client, state: await client.read() }; } catch (error) { await device.close(); throw error; }
  }
  private async readUnlocked(): Promise<X68State> {
    const profile = (await this.exchange([0x85]))[1];
    const rate = await this.exchange([0x84, profile]);
    const light = await this.exchange([0x87]);
    if (profile > 3 || rate[1] !== profile || rate[2] > 6 || light[1] > 25 || light[2] > 4 || light[3] > 4) throw Error('Unsupported X68HE settings layout; no settings were written.');
    const travel = new Map<number, Uint8Array>();
    // HE pages are optional. A firmware with a different header remains read-only for HE.
    for (const param of [0, 1, 2, 3, 6, 7]) {
      try { const pages: Uint8Array[] = []; for (let page = 0; page < 2; page++) { const r = await this.exchange([0xe5, param, 1, page]); if (r[1] !== param || r[2] !== 1 || r[3] !== page) throw Error('Unsupported HE page'); pages.push(r.slice(8)); } const all = new Uint8Array(112); all.set(pages[0]); all.set(pages[1], 56); travel.set(param, all); } catch { travel.clear(); break; }
    }
    return { profile, rate, light, travel };
  }
  read() { return this.serial(() => this.readUnlocked()); }
  apply(snapshot: X68State, light: Uint8Array, rateCode: number) {
    return this.serial(async () => {
      if (!Number.isInteger(rateCode) || rateCode < 0 || rateCode > 6 || light.length !== 64 || light[1] > 25 || light[2] > 4 || light[3] > 4) throw Error('Invalid X68HE values');
      const now = await this.readUnlocked();
      if (now.profile !== snapshot.profile || now.light.slice(1, 8).some((v, i) => v !== snapshot.light[i + 1]) || now.rate[2] !== snapshot.rate[2]) throw Error('Device settings changed. Refresh before applying.');
      if (rateCode !== now.rate[2]) await this.exchange([0x04, now.profile, rateCode]);
      if (light.slice(1, 8).some((v, i) => v !== now.light[i + 1])) await this.exchange([0x07, ...light.slice(1, 8)], 8);
      const result = await this.readUnlocked();
      if (result.rate[2] !== rateCode || result.light.slice(1, 8).some((v, i) => v !== light[i + 1])) throw Error('X68HE readback did not confirm the changes. Refresh to see device values.');
      return result;
    });
  }
  async close() { await this.queue; if (this.device.opened) await this.device.close(); }
}
