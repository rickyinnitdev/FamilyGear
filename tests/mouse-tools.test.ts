import {test} from 'node:test';
import assert from 'node:assert/strict';
import {delayPlan} from '../src/mouse-delay';
import {MouseReport,reportSettings} from '../src/mouse-report';
import type {MouseStatus} from '../src/devices/vxe';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('delay preset changes only reported supported fields and never claims zero debounce',()=>{
  const s={supportedPollingRates:[125,500,1000,8000],pollingRateHz:500,debounceMs:8,motionSync:true,dpi:1600} as MouseStatus;
  assert.deepEqual(delayPlan(s,[0,1,2,4,8]).map(c=>[c.key,c.after]),[['pollingRateHz',1000],['debounceMs',2],['motionSync',false]]);
  assert.deepEqual(delayPlan({...s,pollingReadVerified:false,debounceMs:null,motionSync:null},[0,1]),[]);
});
test('SC620 report recording requires consent, bounds data and excludes identifying fields',()=>{
  const report=new MouseReport(),status={brand:'AULA',dpi:800,batteryPercent:60,serialNumber:'private',path:'private',lighting:{mode:'Neon'}} as unknown as MouseStatus;
  report.record('Connect',null,status,true);assert.equal(report.entries.length,0);
  report.consent=true;report.record('Apply',status,{...status,dpi:1600},false);
  const text=report.text('test');assert.ok(!text.includes('private'));assert.ok(text.includes('failed'));assert.ok(text.includes('Not automatically verified'));
  assert.equal(reportSettings(status).lightingMode,'Neon');
  for(let i=0;i<110;i++)report.record('Apply',status,status,true);assert.equal(report.entries.length,100);
  report.clear();assert.equal(report.consent,false);assert.deepEqual(report.entries,[]);
});
test('Windows delay check is bounded and read-only and returns only pointer settings',async()=>{
  const {delayEnvironment}=require('../desktop/delay.cjs');
  const result=await delayEnvironment(async(file:string,args:string[],options:{timeout:number;windowsHide:boolean})=>{
    assert.equal(file,'powershell.exe');assert.ok(args.join(' ').includes('Get-ItemProperty'));assert.ok(args.join(' ').includes('HKCU:\\Control Panel\\Mouse'));assert.ok(!args.join(' ').includes('Set-'));assert.ok(options.windowsHide);assert.equal(options.timeout,5000);
    return {stdout:'{"acceleration":true,"pointerSpeed":10,"username":"private"}'};
  });assert.deepEqual(result,{acceleration:true,pointerSpeed:10});
});
