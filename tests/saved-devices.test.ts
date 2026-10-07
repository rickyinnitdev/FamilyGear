import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {savedDevices,rememberDevice,matchSaved,forgetDevices} from '../src/saved-devices';
const require=createRequire(import.meta.url);
test('saved devices preserve identity only and select the same control collection after restart',()=>{
 const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
 const device={vendorId:1,productId:2,productName:'Mouse',collections:[{usagePage:65535,usage:2}],dpi:1600} as unknown as HIDDevice;
 rememberDevice('mouse',device);const row=savedDevices()[0];assert.equal(row.name,'Mouse');assert.equal('dpi' in row,false);
 const input={...device,collections:[{usagePage:1,usage:2}]} as HIDDevice;assert.deepEqual(matchSaved(row,[input,device]),[device]);assert.equal(matchSaved(row,[device,{...device}]).length,2);
 rememberDevice('x11',{vendorId:7511,productId:64096,productName:'X11'});assert.equal(savedDevices().length,1);forgetDevices();assert.deepEqual(savedDevices(),[]);
 data.set('family-gear-saved-devices-v1','invalid');assert.deepEqual(savedDevices(),[]);
});
test('desktop HID grants survive restart and do not grant another serial or product',()=>{
 const dir=mkdtempSync(join(tmpdir(),'family-gear-permissions-'));try{const {createPermissions}=require('../desktop/hid-permissions.cjs'),d={vendorId:1,productId:2,productName:'Mouse',serialNumber:'one'};const first=createPermissions(dir);assert.equal(first.allow(d),false);first.remember(d);const restored=createPermissions(dir);assert.equal(restored.allow(d),true);assert.equal(restored.allow({...d,serialNumber:'two'}),false);assert.equal(restored.allow({...d,productId:3}),false);assert.equal(restored.allow({}),false);}finally{rmSync(dir,{recursive:true,force:true});}
});
