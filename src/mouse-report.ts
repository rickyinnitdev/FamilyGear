import type {MouseStatus} from './devices/vxe';
export const REPORT_TERMS='Family Gear SC620 testing agreement v1: Recording is optional. After agreement, connection and Apply results are saved on this computer. Reports contain app version, mouse model, time, selected settings and device readback outcomes. They exclude serial numbers, USB paths, account names, raw packets, typed keys and browsing data. Nothing is uploaded automatically. Review before copying or opening the public GitHub form; GitHub reports are visible to everyone. Device readback does not prove physical button, RGB or latency behavior. You can stop recording and delete the local report at any time. Experimental edits may need restoring in the official driver. Declining reporting does not prevent using the app.';
const fields=['dpi','dpiStages','activeDpiStage','pollingRateHz','debounceMs','liftOffDistance','sleepTimeout','performanceMode','scrollDirection','batteryPercent','batteryState'] as const;
export function reportSettings(status:MouseStatus|null){
  const out:Record<string,unknown>={};if(!status)return out;
  for(const key of fields){const v=status[key];if(typeof v==='number'||typeof v==='boolean'||(typeof v==='string'&&v.length<50)||Array.isArray(v)&&v.every(n=>typeof n==='number'))out[key]=v;}
  if(status.lighting?.mode)out.lightingMode=status.lighting.mode;else if(typeof (status as unknown as Record<string,unknown>).lightingMode==='string')out.lightingMode=String((status as unknown as Record<string,unknown>).lightingMode).slice(0,40);
  return out;
}
export class MouseReport {
  consent=false;
  entries:{time:string;action:string;outcome:string;before:Record<string,unknown>;after:Record<string,unknown>}[]=[];
  record(action:string,before:MouseStatus|null,after:MouseStatus|null,ok:boolean){if(!this.consent)return;this.entries.push({time:new Date().toISOString(),action:action.slice(0,80),outcome:ok?'Device readback passed (physical behavior not confirmed)':'Operation failed / readback unavailable',before:reportSettings(before),after:reportSettings(after)});this.entries=this.entries.slice(-100);}
  text(version:string){return JSON.stringify({report:'Family Gear SC620 test report',version,agreement:'v1',model:'AULA SC620',physicalBehavior:'Not automatically verified; add observations before sending.',results:this.entries},null,2);}
  clear(){this.consent=false;this.entries=[];}
}
export const mouseReport=new MouseReport();
try{const saved=JSON.parse(localStorage.getItem('family-gear-sc620-report')??'null');if(saved?.agreement==='v1'&&Array.isArray(saved.entries)){mouseReport.consent=saved.consent===true;mouseReport.entries=saved.entries.slice(-100).map((e:{action:string;outcome:string;time:string;before:MouseStatus;after:MouseStatus})=>({action:String(e.action).slice(0,80),outcome:String(e.outcome).slice(0,100),time:String(e.time).slice(0,30),before:reportSettings(e.before),after:reportSettings(e.after)}));}}catch{}
export function persistReport(){try{localStorage.setItem('family-gear-sc620-report',JSON.stringify({agreement:'v1',consent:mouseReport.consent,entries:mouseReport.entries}));}catch{/* Storage failure must not turn a verified hardware write into a failure. */}}
export function recordMouseTest(action:string,before:MouseStatus|null,after:MouseStatus|null,ok:boolean){if(before?.brand!=='AULA'&&after?.brand!=='AULA')return;mouseReport.record(action,before,after,ok);persistReport();}
export async function openMouseReport(baseline:MouseStatus|null=null){
  const dialog=document.createElement('dialog');dialog.className='suggestion-dialog';
  dialog.innerHTML='<button class="icon-button" id="report-close" aria-label="Close">×</button><h2>SC620 test report</h2><p id="report-terms"></p><label><input id="report-consent" type="checkbox"/> I agree to local test-result recording</label><p>Results are collected when you connect or apply a setting. No automatic device writes or uploads are performed.</p><textarea id="report-text" rows="12" aria-label="Review report"></textarea><div class="suggestion-actions"><button class="primary" id="report-copy">Copy report</button><button class="secondary" id="report-github">Open GitHub form</button><button class="secondary" id="report-delete">Delete report & stop</button></div><p id="report-status" role="status"></p>';
  document.body.append(dialog);dialog.querySelector('#report-terms')!.textContent=REPORT_TERMS;
  const consent=dialog.querySelector<HTMLInputElement>('#report-consent')!,text=dialog.querySelector<HTMLTextAreaElement>('#report-text')!,status=dialog.querySelector('#report-status')!;
  consent.checked=mouseReport.consent;text.value=mouseReport.text('0.2.6');
  consent.onchange=()=>{mouseReport.consent=consent.checked;if(consent.checked&&baseline)recordMouseTest('Baseline device read',null,baseline,true);persistReport();text.value=mouseReport.text('0.2.6');};
  dialog.querySelector('#report-copy')!.addEventListener('click',async()=>{try{await(window.familyGear?window.familyGear.copyReport(text.value):navigator.clipboard.writeText(text.value));status.textContent='Copied. Send it to the owner in your group chat.';}catch{status.textContent='Select the report and copy it manually.';}});
  dialog.querySelector('#report-github')!.addEventListener('click',async()=>{const repo=await window.familyGear?.community();if(!repo){status.textContent='Use Copy report to share it.';return;}if(text.value.length>6000){status.textContent='Report is too long for a link. Copy it and paste it into a GitHub issue.';return;}window.open(`https://github.com/${repo}/issues/new?${new URLSearchParams({title:'[SC620 test] Device results',body:text.value})}`,'_blank','noopener,noreferrer');});
  dialog.querySelector('#report-delete')!.addEventListener('click',()=>{mouseReport.clear();persistReport();consent.checked=false;text.value=mouseReport.text('0.2.6');status.textContent='Local report deleted. Recording stopped.';});
  dialog.querySelector('#report-close')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
