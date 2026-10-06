import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChargingEstimate} from '../src/devices/battery.ts';
test('charging estimates require elapsed time and measurable progress, reset after discharging or gaps',()=>{
  const estimate=new ChargingEstimate();estimate.observe(50,true,0);estimate.observe(51,true,60000);assert.equal(estimate.minutes(),null);
  estimate.observe(52,true,120000);estimate.observe(53,true,180000);assert.equal(estimate.minutes(),50);
  estimate.observe(53,false,195000);assert.equal(estimate.minutes(),null);
  estimate.observe(70,true,210000);estimate.observe(73,true,400000);assert.equal(estimate.minutes(),null);
  estimate.observe(100,true,415000);assert.equal(estimate.minutes(),0);
});
