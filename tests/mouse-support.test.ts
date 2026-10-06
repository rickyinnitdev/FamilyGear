import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GearHubHidClient } from '@openmouse/protocol/drivers/gearhub/hid';
import { SharkClient, connectMouse, MOUSE_FILTERS } from '../src/devices/mouse';
import type { MouseStatus } from '../src/devices/vxe';

function setup(){
  const driver=new GearHubHidClient({vendorId:0x3151,productId:0x4026} as HIDDevice);
  let status={brand:'Attack Shark',name:'Attack Shark R2',dpi:1600,pollingRateHz:1000,debounceMs:4,batteryPercent:null,batteryState:'Unknown',ui:{settingsReady:true}} as MouseStatus;
  let writes=0;
  driver.readStatus=async()=>({...status});
  driver.setDpi=async dpi=>{writes++;status={...status,dpi};return dpi;};
  return {client:new SharkClient(driver),driver,setStatus:(value:Partial<MouseStatus>)=>{status={...status,...value};},writes:()=>writes};
}
test('ATTACK SHARK uses reported identity and values, not VXE defaults',async()=>{
  const {client,writes}=setup();assert.equal((await client.readStatus()).dpi,1600);assert.equal(writes(),0);
  await client.setDpi(800);assert.equal((await client.readStatus()).dpi,800);assert.equal(writes(),1);
});
test('shared receivers and failed settings reads do not unlock controls',async()=>{
  const s=setup();s.setStatus({brand:'GearHub'});await assert.rejects(s.client.setDpi(800),/identify/);assert.equal(s.writes(),0);
  s.setStatus({brand:'Attack Shark',debounceMs:null});await assert.rejects(s.client.readStatus(),/guessed settings/);
});
test('unsupported setters issue no ATK fallback and unconfirmed writes fail',async()=>{
  const s=setup();await assert.rejects(s.client.setLongRangeMode(true),/not supported/);assert.equal(s.writes(),0);
  s.driver.setDpi=async value=>value;await assert.rejects(s.client.setDpi(800),/readback/);
});
test('X11 cannot be mistaken for a browser-writable mouse on Windows',async()=>{
  assert.ok(MOUSE_FILTERS.some(f=>f.vendorId===0x1d57&&f.productId===0xfa60));
  await assert.rejects(connectMouse({vendorId:0x1d57,productId:0xfa60} as HIDDevice),/bridge/);
});
test('GearHub button edits require supported actions and matching device readback',async()=>{
  const s=setup();s.setStatus({buttonMappings:{Back:'Back',Forward:'Forward'},buttonOptions:['Back','Forward']});
  let writes=0;
  s.driver.setButtonMapping=async(button,action)=>{writes++;s.setStatus({buttonMappings:{Back:button==='Back'?action:'Back',Forward:'Forward'}});};
  await assert.rejects(s.client.setButtonMapping('Back','Unknown'),/supported action/);assert.equal(writes,0);
  await s.client.setButtonMapping('Back','Forward');assert.equal(writes,1);assert.equal((await s.client.readStatus()).buttonMappings?.Forward,'Forward');
  s.driver.setButtonMapping=async()=>{};
  await assert.rejects(s.client.setButtonMapping('Back','Back'),/readback/);
});
