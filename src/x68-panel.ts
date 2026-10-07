import { X68Client, X68_FILTER, X68_RATES, type X68State } from './devices/x68';
let client: X68Client | null = null, state: X68State | null = null;
export async function closeX68() { await client?.close(); client = null; state = null; }
export function x68Card() { return client ? '<button class="add-gear" id="x68-open"><span>⌨</span><strong>ATTACK SHARK X68HE</strong><small>Connected · USB · Open settings</small></button>' : ''; }
export async function addX68() {
  const devices = await navigator.hid.requestDevice({ filters: [X68_FILTER] });
  if (!devices.length) return;
  await closeX68(); const result = await X68Client.connect(devices[0]); client = result.client; state = result.state; openX68();
}
export function openX68() {
  if (!client || !state) return;
  const dialog = document.createElement('dialog'); dialog.style.width = 'min(900px, 92vw)';
  const draw = () => {
    const s = state!;
    dialog.innerHTML = `<h2>ATTACK SHARK X68HE</h2><p>Experimental · 3151:502D · onboard profile ${s.profile}. Current settings come from your keyboard.</p><div class="travel-fields"><label>Lighting effect<select id="x68-effect">${Array.from({length:26},(_,i)=>`<option value="${i}" ${s.light[1]===i?'selected':''}>${['Off','Constant','Breathing','Neon','Wave','Ripple','Raindrop','Snake'][i]??'Effect '+i}</option>`).join('')}</select></label><label>Brightness (0–4)<input id="x68-bright" type="range" min="0" max="4" value="${s.light[3]}"/></label><label>Speed (0–4)<input id="x68-speed" type="range" min="0" max="4" value="${4-s.light[2]}"/></label><label>Color<input id="x68-color" type="color" value="#${[s.light[5],s.light[6],s.light[7]].map(v=>v.toString(16).padStart(2,'0')).join('')}"/></label><label>Polling rate<select id="x68-rate">${X68_RATES.map((hz,i)=>`<option value="${i}" ${s.rate[2]===i?'selected':''}>${hz} Hz</option>`).join('')}</select></label></div><p>RGB color preview <span id="x68-preview" style="display:inline-block;width:60px;height:24px;background:rgb(${s.light[5]},${s.light[6]},${s.light[7]})"></span> · illustration only</p><h3>Hall effect settings readback</h3><p>${s.travel.size?'Select a hardware slot to inspect its current trigger settings. Physical key mapping and safe HE writes are still being verified.':'This firmware did not return a recognized Hall effect page. Trigger editing is unavailable.'}</p>${s.travel.size?'<label>Hardware slot<select id="x68-slot">'+Array.from({length:112},(_,i)=>`<option value="${i}">Slot ${i}</option>`).join('')+'</select></label><p id="x68-travel"></p>':''}<p>Calibration, analog travel and advanced bindings are unavailable until their commands and key mapping are verified. <a href="https://qmk.top" target="_blank" rel="noreferrer">Official configurator</a></p><p id="x68-result" role="status"></p><div class="apply-bar"><button class="secondary" id="x68-refresh">Refresh / cancel edits</button><button class="primary" id="x68-apply">Apply RGB & polling</button><button class="secondary" id="x68-close">Close</button></div>`;
    const q = <T extends HTMLElement>(id: string) => dialog.querySelector<T>('#x68-'+id)!;
    q<HTMLButtonElement>('close').onclick = () => dialog.close();
    q<HTMLInputElement>('color').oninput = () => {q('preview').style.background = q<HTMLInputElement>('color').value;};
    const travel = () => {const slot=Number(q<HTMLSelectElement>('slot').value);q('travel').textContent = [[0,'Actuation'],[1,'Release'],[2,'RT press'],[3,'RT release']].map(([p,n])=>`${n}: ${((s.travel.get(Number(p))![slot]+1)/10).toFixed(1)} mm`).join(' · ')+` · Rapid trigger: ${s.travel.get(7)![slot]&128?'On':'Off'}`;};
    if(s.travel.size){q<HTMLSelectElement>('slot').onchange=travel;travel();}
    const run = async (action:()=>Promise<X68State>) => {dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);try{state=await action();draw();q('result').textContent='Device values read and verified.';}catch(error){q('result').textContent=error instanceof Error?error.message:String(error);dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);}};
    q<HTMLButtonElement>('refresh').onclick=()=>void run(()=>client!.read());
    q<HTMLButtonElement>('apply').onclick=()=>{const light=s.light.slice();light[1]=Number(q<HTMLSelectElement>('effect').value);light[2]=4-Number(q<HTMLInputElement>('speed').value);light[3]=Number(q<HTMLInputElement>('bright').value);const color=q<HTMLInputElement>('color').value.slice(1);light.set([0,2,4].map(i=>parseInt(color.slice(i,i+2),16)),5);void run(()=>client!.apply(s,light,Number(q<HTMLSelectElement>('rate').value)));};
  };
  draw();document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
