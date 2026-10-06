export interface BatterySample { time: number; percent: number }
export class ChargingEstimate {
  samples: BatterySample[] = [];
  observe(percent: number | null, charging: boolean, time = Date.now()) {
    if (!charging || percent === null) { this.samples = []; return; }
    if (this.samples.length && (percent < this.samples.at(-1)!.percent || time - this.samples.at(-1)!.time > 90000)) this.samples = [];
    this.samples.push({ time, percent });
    this.samples = this.samples.filter(s => time - s.time <= 30 * 60000);
  }
  minutes(): number | null {
    const first=this.samples[0],last=this.samples.at(-1);
    if(!first||!last)return null;
    if(last.percent>=100)return 0;
    const elapsed=last.time-first.time,gain=last.percent-first.percent;
    if(elapsed<180000||gain<3)return null;
    const value=(100-last.percent)*elapsed/gain/60000;
    return value>0&&value<720?Math.ceil(value/5)*5:null;
  }
}
