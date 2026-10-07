import type {MouseStatus} from './devices/vxe';
export type DelayChange={key:'pollingRateHz'|'debounceMs'|'motionSync';before:number|boolean;after:number|boolean;label:string};
export function delayPlan(s:MouseStatus,debounce:readonly number[]):DelayChange[]{
  const plan:DelayChange[]=[];
  const rate=Math.max(0,...(s.supportedPollingRates??[]).filter(v=>v<=1000));
  if(rate&&s.pollingReadVerified!==false&&s.pollingRateHz!==rate)plan.push({key:'pollingRateHz',before:s.pollingRateHz,after:rate,label:`Polling: ${s.pollingRateHz} → ${rate} Hz`});
  const timing=debounce.filter(v=>v>=2&&v<=4).sort((a,b)=>a-b)[0];
  if(timing!=null&&s.debounceMs!=null&&s.debounceMs>timing)plan.push({key:'debounceMs',before:s.debounceMs,after:timing,label:`Click debounce: ${s.debounceMs} → ${timing} ms`});
  if(s.motionSync===true)plan.push({key:'motionSync',before:true,after:false,label:'Motion sync: On → Off'});
  return plan;
}
export async function openDelayTool(s:MouseStatus,debounce:readonly number[],apply:(changes:DelayChange[])=>Promise<void>){
  const dialog=document.createElement('dialog');dialog.className='suggestion-dialog';
  dialog.innerHTML='<button class="icon-button" id="delay-close" aria-label="Close">×</button><h2>Check delay & optimize</h2><p>Zero delay is not possible. This checks reported settings and suggests a modest mouse preset. It cannot measure end-to-end latency or determine whether Windows, a game, USB or the mouse is responsible.</p><p id="delay-system">Checking Windows pointer settings…</p><h3>Suggested mouse changes</h3><div id="delay-plan"></div><p>Lower debounce can increase double clicks. Motion sync trades movement consistency for timing. DPI stays unchanged. Test the result in your game; you can restore the previous settings below.</p><div class="suggestion-actions"><button class="primary" id="delay-apply">Apply supported changes</button><button class="secondary" id="delay-undo" disabled>Restore previous values</button><button class="secondary" id="delay-windows">Open Windows mouse settings</button></div><h3>If delay remains</h3><p>Compare wired USB with the receiver near your mouse. Close other device configurators. Compare 500 and 1,000 Hz in the affected game, and check frame rate, V-sync and the game’s input settings. Pointer acceleration changes cursor response; it is not proof of latency.</p><p id="delay-result" role="status"></p>';
  document.body.append(dialog);const plan=delayPlan(s,debounce),result=dialog.querySelector('#delay-result')!;
  dialog.querySelector('#delay-plan')!.textContent=plan.length?plan.map(v=>v.label).join(' · '):'No supported preset changes are needed, or the necessary reads are unavailable.';
  const applyButton=dialog.querySelector<HTMLButtonElement>('#delay-apply')!,undo=dialog.querySelector<HTMLButtonElement>('#delay-undo')!;
  applyButton.disabled=!plan.length;let applied=false;
  const execute=async(changes:DelayChange[])=>{applyButton.disabled=true;undo.disabled=true;result.textContent='Applying and checking device readback…';try{await apply(changes);applied=!applied;result.textContent='Device readback confirmed these settings. Test physical behavior; lower latency is not measured.';}catch(error){applied=true;result.textContent=String(error instanceof Error?error.message:error)+' Some settings may have applied. Refresh and review them.';}finally{applyButton.disabled=applied||!plan.length;undo.disabled=!applied;}};
  applyButton.onclick=()=>void execute(plan);undo.onclick=()=>void execute(plan.map(v=>({...v,before:v.after,after:v.before})).reverse());
  dialog.querySelector('#delay-windows')!.addEventListener('click',()=>void window.familyGear?.openMouseSettings());
  const environment=await window.familyGear?.delayEnvironment().catch(()=>null);
  dialog.querySelector('#delay-system')!.textContent=environment?`Windows pointer acceleration: ${environment.acceleration?'On':'Off'} · pointer speed ${environment.pointerSpeed}/20. These affect desktop cursor response, not every game.`:'Windows settings read is unavailable. Use Windows mouse settings to inspect pointer options.';
  dialog.querySelector<HTMLButtonElement>('#delay-windows')!.disabled=!window.familyGear;
  dialog.querySelector('#delay-close')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
