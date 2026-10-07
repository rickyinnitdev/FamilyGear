import { smokeDevice, failedConnection, openDeviceReports, sendPending } from './device-smoke';
import { addX68, openX68, closeX68, x68Card, x68Connected, mountX68, unmountX68, setX68OpenHandler } from './x68-panel';
import { openX11Details } from './x11-diagnostics';
import { X11Client } from './devices/x11';
import { openDelayTool, type DelayChange } from './mouse-delay';
import { openMouseReport, recordMouseTest, mouseReport, persistReport } from './mouse-report';
import { bindDeviceScanner } from './device-scanner';
import { bindSuggestions } from './suggestions';
import './style.css';
import { createIcons, Mouse, Keyboard, SlidersHorizontal, Cable, Activity, Info, RefreshCw, X, Check, ChevronDown, ArrowUpRight, Zap, Battery, Radio, ShieldCheck, CircleHelp, Download, Unplug, LayoutGrid } from 'lucide';
import { type MouseStatus } from './devices/vxe';
import { connectMouse, MOUSE_FILTERS } from './devices/mouse';
import { Sc620Client, SC620_FILTERS, SC620_EFFECTS } from './devices/sc620';
import { AceClient, type AceStatus } from './devices/ace';
import { ACE_VENDOR, decodeTravel } from './devices/ace-codec';
import { LIGHT_EFFECTS, decodeLighting, type AceLighting } from './devices/ace-lighting';
import { BASIC_KEYS, keyCode, keyName, decodeProData, updateProMapping, updateProTrigger, type ProData, type ProTriggerValues, type ProPerformance } from './devices/ace-pro';
import { planAdvanced, type AdvancedData, type AdvancedValue } from './devices/ace-advanced';
import { ChargingEstimate } from './devices/battery';

type VxeClient = Awaited<ReturnType<typeof connectMouse>>['client'] | X11Client;
const app = document.querySelector<HTMLDivElement>('#app')!;
const desktop = window.familyGear;
let updateState:DesktopUpdateState={phase:'unconfigured',text:'Updates need a download address.'};
function updateButton(){const button=document.querySelector<HTMLButtonElement>('#desktop-update');if(!button)return;button.textContent=updateState.text;button.title=updateState.phase==='unconfigured'?'The app owner needs to set up the update download location.':updateState.text;button.disabled=busy||liveSession||calibrationSession||['unconfigured','checking','downloading'].includes(updateState.phase);}

let view: 'mouse' | 'keyboard' = 'mouse';
let home=true;
let x68Active=false;
setX68OpenHandler(()=>{x68Active=x68Connected();view='keyboard';home=!x68Active;render();});
let theme: 'dark'|'light' = localStorage.getItem('amouse-theme')==='light'?'light':'dark';
let demo = false;
let mouseTab = 'settings';
let sc620Edits=false;
let keyboardTab = 'lighting';
let busy = false;
let mouse: VxeClient | X11Client | null = null;
let mouseStatus: MouseStatus | null = null;
let mouseDraft: typeof demoMouse | null = null;
let mouseApplyResult: {text:string;kind:'info'|'success'|'error'} | null = null;
function readMouseDraft(){
  const value=(id:string)=>Number(document.querySelector<HTMLSelectElement>('#'+id)!.value);
  const checked=(id:string)=>document.querySelector<HTMLInputElement>('#'+id)!.checked;
  return {dpi:value('dpi'),pollingRateHz:value('polling'),debounceMs:value('debounce'),motionSync:checked('motion'),angleSnapping:checked('angle'),rippleControl:checked('ripple')};
}
let keyboard: AceClient | null = null;
let keyboardStatus: AceStatus | null = null;
let proData: ProData | null = null;
let proLayer = 0;
let advancedData:AdvancedData|null=null;
let advancedType:AdvancedValue['type']='mt';
let liveSession=false,calibrationSession=false;
const liveValues=new Map<number,{mm:number;calibration:number}>();
let advancedSlots:(number|null)[]=[null,null],advancedPick=0,actionPick='advanced-tap';
let triggerDisplay='actuation';
let lightDraft:AceLighting|null=null;
const chargingEstimate=new ChargingEstimate();
let batteryUpdated=0;
let telemetry:Promise<void>|null=null;
const selectedProKeys = new Set<number>();
let demoMouse = { dpi: 1600, pollingRateHz: 1000, debounceMs: 4, motionSync: false, angleSnapping: false, rippleControl: false };
let demoTravel = { actuation: 1.0, press: 0.2, release: 0.2 };
let demoLighting: AceLighting = { effect: 3, color: '#c9fa65', rainbow: false, brightness: 100, speed: 3 };
let demoWinLock = false;
let demoPerformance:ProPerformance={winLock:false,macMode:false,debounce:false,stability:true,autoCalibration:true,pollingCode:3};
let message = 'Connect a device to read its current settings.';
let messageType: 'info' | 'success' | 'error' = 'info';
let tester = false;
const pressed = new Set<string>();
const tested = new Set<string>();
let lastKey = '—';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const icon = (name: string, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const hex = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();
function notice(text: string, kind: typeof messageType = 'info') { message = text; messageType = kind; }
function supported() { return 'hid' in navigator && window.isSecureContext; }
function download(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const options = (values: readonly number[], current: number, suffix = '') => values.map(value => `<option value="${value}" ${value === current ? 'selected' : ''}>${value.toLocaleString()}${suffix}</option>`).join('');
const toggle = (id: string, label: string, help: string, value: boolean, disabled: boolean) => `<label class="toggle-row"><span><strong>${label}</strong><small>${help}</small></span><input id="${id}" type="checkbox" ${value ? 'checked' : ''} ${disabled ? 'disabled' : ''}/><span class="switch" aria-hidden="true"></span></label>`;

function render() {
  unmountX68();
  if(!proData){advancedData=null;advancedSlots=[null,null];}
  document.documentElement.dataset.theme=theme;
  const ready = demo || Boolean(view === 'mouse' ? mouseStatus : keyboardStatus);
  const clientConnected = Boolean(view === 'mouse' ? mouse : keyboard);
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="Family Gear device studio"><span class="brand-mark">MK</span><span>Family Gear<small>DEVICE STUDIO</small></span></a>
      <span class="nav-label">YOUR STUDIO</span><button id="home" class="nav-item ${home?'active':''}">${icon('layout-grid')}<span>Your desk</span></button>
      <button class="nav-item ${!home&&view === 'mouse' ? 'active' : ''}" data-view="mouse" ${!mouse&&!demo?'hidden':''}>${icon('mouse')}<span>Mouse</span><span class="nav-count">01</span></button>
      <button class="nav-item ${!home&&view === 'keyboard' ? 'active' : ''}" data-view="keyboard" ${!keyboard&&!demo&&!x68Connected()?'hidden':''}>${icon('keyboard')}<span>Keyboard</span><span class="nav-count">02</span></button>
      <div class="sidebar-bottom"><div class="local-note">${icon('shield-check')}<div>On your device<small>Settings travel directly over USB.</small></div></div>${desktop?'<button class="text-button" id="device-scanner">Scan devices</button>':''}<button class="text-button" id="automatic-reports">Device reports</button><button class="text-button" id="suggestions">Share an idea</button><button class="text-button" id="about">${icon('info')} About & source</button><span class="version">Family Gear / v0.2.15</span></div>
    </aside>
    <div class="shell">
      <header class="topbar"><div class="breadcrumb">Workspace <span>/</span> <strong>${home?'Your desk':view === 'mouse' ? 'Mouse' : 'Keyboard'}</strong></div><div class="top-actions">${desktop?'<button class="theme-button" id="desktop-update"></button>':''}<button class="theme-button" id="theme-toggle" aria-label="Switch to ${theme==='dark'?'light':'dark'} mode">${theme==='dark'?'☀':'☾'}<span>${theme==='dark'?'Light':'Dark'} mode</span></button><label class="demo-toggle"><input id="demo" type="checkbox" ${demo ? 'checked' : ''} ${busy ? 'disabled' : ''}/><span>Preview mode</span></label><span class="local-pill">${icon('cable')} Local connection</span></div></header>
      <main>
        ${home?homePanel():x68Active?'<section id="x68-workspace"></section>':`        <div class="page-heading"><div><span class="eyebrow">YOUR GEAR. YOUR SETTINGS.</span><h1>${view==='mouse'?'Every movement, yours.':'Make every key yours.'}</h1><p>${view==='mouse'?'Find your feel. Fine-tune your mouse below.':'Lighting, response, and bindings — all in one place.'}</p></div><button class="primary" id="connect" ${busy || demo || !supported() || (view === 'mouse' ? mouse : keyboard) ? 'disabled' : ''}>${icon('cable')} ${busy ? 'Working…' : !demo && ready ? 'Device connected' : `Connect ${view === 'mouse' ? 'mouse' : 'keyboard'}`}</button></div>
        ${!supported() ? `<div class="banner warning">${icon('circle-help')} Device connections need Chrome or Edge on desktop, using HTTPS or localhost. You can still explore preview mode.</div>` : ''}
        ${demo ? `<div class="banner preview">${icon('layout-grid')} Preview mode — sample values only. Changes here do not affect hardware.</div>` : ''}
        <section class="workspace" data-mouse-tab="${mouseTab}" data-keyboard-tab="${keyboardTab}" aria-label="${view === 'mouse' ? 'Mouse' : 'Keyboard'} settings">
          <div class="workspace-header"><div><span class="eyebrow">${view === 'mouse' ? `${escape(mouseStatus?.brand??'MOUSE')} / MOUSE CONTROL` : 'MCHOSE / KEYBOARD CONTROL'}</span><h2>${escape(view === 'mouse' ? mouseStatus?.name ?? 'VXE R1' : keyboardStatus?.name ?? 'Ace 60 / Pro')}</h2></div><div class="workspace-tools"><span class="status-pill ${ready ? 'ready' : ''}">${demo ? 'Preview' : ready ? 'Connected' : 'Not connected'}</span><button class="icon-button" id="refresh" aria-label="Refresh device settings" ${!clientConnected || busy || demo ? 'disabled' : ''}>${icon('refresh-cw')}</button><button class="icon-button" id="disconnect" aria-label="Disconnect device" ${!clientConnected || busy || demo ? 'disabled' : ''}>${icon('unplug')}</button></div></div>
          ${view==='mouse'?mousePreview():''}${deviceTabs()}${view === 'mouse' ? sc620Notice()+mousePanel() : keyboardPanel()}
        </section>
`}
        <div class="notice ${messageType}" role="status" aria-live="polite">${icon(messageType === 'success' ? 'check' : messageType === 'error' ? 'circle-help' : 'info')}<span>${escape(message)}</span></div>
        <footer><span>Built for your desk.</span><button id="source" class="text-button">Powered by open source ${icon('arrow-up-right')}</button></footer>
      </main>
    </div>
    <dialog id="add-dialog"><button type="button" class="icon-button" id="add-close" aria-label="Close add device">${icon('x')}</button><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>What’s on your desk?</h2><p>Choose a device type. Choose the connected device you’d like to add.</p><div class="add-options"><button data-add="mouse"><span>${icon('mouse')}</span><strong>Add a mouse</strong><small>VXE R1 · ATTACK SHARK R2 / R3 / R5 Ultra / R6 / R8</small>${icon('arrow-up-right')}</button><button data-add="aula-sc620"><span>${icon('mouse')}</span><strong>Add AULA SC620</strong><small>Experimental · USB / 2.4 GHz · select only an SC620</small>${icon('arrow-up-right')}</button>${desktop?`<button data-add="x11"><span>${icon('mouse')}</span><strong>Add ATTACK SHARK X11</strong><small>Experimental native Windows HID · USB / 2.4 GHz</small>${icon('arrow-up-right')}</button>`:''}<button data-add="x68"><span>⌨</span><strong>Add ATTACK SHARK X68HE</strong><small>Experimental · wired USB · RGB, polling & verified triggers</small></button><button data-add="keyboard"><span>${icon('keyboard')}</span><strong>Add a keyboard</strong><small>MCHOSE Ace 60 / Pro · wired USB</small>${icon('arrow-up-right')}</button></div><p class="compatibility-note">ATTACK SHARK support is experimental and model-specific. X11 uses the Windows native connection. Wake the mouse before adding it. AULA SC620 has a separate experimental driver. Other AULA models are not supported.</p>${desktop?'<button class="secondary" type="button" id="x11-details">X11 connection details</button>':''}<button class="secondary" type="button" id="sc620-report-start">SC620 test report & agreement</button><p class="compatibility-note">Everyone is welcome. Device controls currently support these models; more devices can be added as compatible drivers become available.</p></dialog><dialog id="about-dialog"><button class="icon-button close-dialog" aria-label="Close">${icon('x')}</button><span class="eyebrow">OPEN BY DESIGN</span><h2>Your devices, directly.</h2><p>Family Gear uses WebHID to read and configure supported hardware. Device settings stay between this browser and your USB device. Close other configurators before connecting.</p><h3>Support in this version</h3><p>VXE R1-family mice: OpenMouse ATK driver. ATTACK SHARK R2/R3: GearHub driver; R5 Ultra/R6/R8: CompX/Lamzu driver. Current settings and write readback are required. These additions have not been tested on your physical hardware. X11: experimental Windows native HID settings, DPI stages, sensor controls, lighting, button mappings and profiles; AULA SC620: experimental profile-1 DPI, polling, RGB effects, basic button mappings and power controls. Readback is required; macro editing and sensor-processing flags remain unavailable. Ace 60: experimental actuation and rapid-trigger distances. Ace 60 Pro firmware 1.18: RGB lighting with verified readback; experimental per-key actuation, rapid trigger, and basic remapping; Windows key lock. The key tester uses normal browser key events, not analog depth.</p><h3>Sources & licenses</h3><p><a href="https://github.com/OpenMouse-Project/mouse-protocol" target="_blank" rel="noreferrer">OpenMouse protocol</a> · AGPL-3.0-or-later<br><a href="https://github.com/backaround/ace60-re" target="_blank" rel="noreferrer">ace60-re protocol research</a> · MIT stated in README<br><a href="https://github.com/PashOK7/HallJoy" target="_blank" rel="noreferrer">HallJoy Pro protocol research</a> · AGPL-3.0</p><p>Family Gear is released under AGPL-3.0-or-later. <a href="/LICENSE.txt" target="_blank">Read the license</a>. The complete source and build instructions are in this project folder; The Windows sharing ZIP includes Family-Gear-source.zip with the matching source and build instructions.</p>${desktop?'<button class="secondary" id="desktop-source">Open source folder</button>':''}<button class="secondary" id="diagnostics">${icon('download')} Export connection details</button></dialog>
  `;
  createIcons({ icons: { Mouse, Keyboard, SlidersHorizontal, Cable, Activity, Info, RefreshCw, X, Check, ChevronDown, ArrowUpRight, Zap, Battery, Radio, ShieldCheck, CircleHelp, Download, Unplug, LayoutGrid } });
  bind();
  const x68Root=document.querySelector<HTMLElement>('#x68-workspace');if(x68Root)mountX68(x68Root);
}

function gearCard(kind:'mouse'|'keyboard') {
 const isMouse=kind==='mouse',status=isMouse?mouseStatus:keyboardStatus;
 const name=status?.name??(isMouse?'VXE R1 series':'MCHOSE Ace 60 Pro');
 return `<button class="gear-card" data-view="${kind}"><div class="gear-art ${kind}"><span class="gear-orbit"></span><img src="/images/${isMouse?mouseArt():'ace60-pro.png'}" alt="${isMouse?escape(status?.name??'VXE R1 family mouse'):'MCHOSE Ace 60 Pro keyboard'}"/><span class="gear-open">${icon('arrow-up-right')}</span></div><div class="gear-caption"><span class="device-category">${isMouse?'GAMING MOUSE':'MAGNETIC KEYBOARD'}</span><h3>${escape(name)}</h3><div><span class="connection-dot"></span><span>${demo?'Preview device':'Connected'}</span><span class="gear-detail">${isMouse?mouseStatus?.batteryPercent!=null?mouseStatus.batteryPercent+'% battery':demo?'Sample settings':'USB':keyboardStatus?'Firmware '+escape(keyboardStatus.firmware):'Sample settings'}</span></div></div></button>`;
}
function homePanel() {
 const count=Number(Boolean(mouse||demo))+Number(Boolean(keyboard||demo))+Number(x68Connected());
 return `<section class="welcome"><div class="welcome-copy"><span class="eyebrow">A LITTLE SPACE FOR YOUR SETUP</span><h1>Good to have<br/>you here<span>.</span></h1><p>Your desk. Your rhythm. Make your gear feel just right, one small adjustment at a time.</p><div class="welcome-actions"><button class="primary" data-open-add>+ Add device</button><button class="secondary" id="explore-preview">Explore a preview ${icon('arrow-up-right')}</button></div><div class="welcome-trust">${icon('shield-check')} Settings go directly to your device</div></div><div class="welcome-visual" aria-hidden="true"><div class="hero-rings"></div><img src="/images/vxe-r1.png" alt=""/><div class="floating-note"><span class="connection-dot"></span> A setup that feels like you.</div><span class="visual-label">LESS FRICTION. MORE YOU.</span></div></section><section class="desk-section"><div class="desk-title"><div><span class="eyebrow">YOUR COLLECTION</span><h2>On your desk <span>${count.toString().padStart(2,'0')}</span></h2></div><button class="text-button" data-open-add>+ Add device</button></div><div class="gear-grid">${mouse||demo?gearCard('mouse'):''}${keyboard||demo?gearCard('keyboard'):''}${x68Card()}${count===0?'<div class="empty-desk"><span class="empty-symbol">+</span><h3>Your setup starts here.</h3><p>Connect your first device to see it here.<br/>Or explore a preview and get a feel for the studio.</p><button class="secondary" data-open-add>Add your first device</button></div>':'<button class="add-gear" data-open-add><span>+</span><strong>Room for one more</strong><small>Add another device</small></button>'}</div></section><div class="home-bottom"><div>${icon('cable')}<strong>Connect. Make it yours.</strong><p>Use a USB cable or supported 2.4 GHz receiver.</p></div><div>${icon('sliders-horizontal')}<strong>Small tweaks. Your feel.</strong><p>See your settings before applying a change.</p></div><div>${icon('shield-check')}<strong>Right here on your desk.</strong><p>No account needed. Your settings stay on your device.</p></div></div>${!supported()?'<div class="banner warning">Device connections need Chrome or Edge on desktop. Preview is available in this browser.</div>':''}${demo?'<div class="banner preview">You’re exploring sample devices. Preview changes do not affect hardware.</div>':''}`;
}
function mouseArt(){return mouseStatus?.name==='AULA SC620'?'aula-sc620.png':mouseStatus?.brand==='Attack Shark'||mouseStatus?.brand==='AULA'?'generic-mouse.svg':'vxe-r1.png';}
function mousePreview() {
 return `<div class="mouse-preview"><div class="mouse-preview-art" id="mouse-live" tabindex="0" aria-label="Mouse button tester"><div class="mouse-halo"></div><img src="/images/${mouseArt()}" alt="${escape(mouseStatus?.name??'VXE R1 family')} mouse preview"/><button type="button" class="mouse-hotspot left" data-mouse-button="0" aria-label="Preview left mouse button"></button><button type="button" class="mouse-hotspot right" data-mouse-button="2" aria-label="Preview right mouse button"></button><button type="button" class="mouse-hotspot wheel" data-mouse-button="1" aria-label="Preview middle mouse button"></button></div><div class="mouse-preview-copy"><span class="eyebrow">LIVE MOUSE PREVIEW</span><h3>A feel for every click.</h3><p>Click the mouse illustration or press your mouse buttons inside the preview. Scroll to see the wheel respond.</p><div class="mouse-feedback" id="mouse-feedback" role="status">Ready when you are.</div><div class="mouse-preview-chips"><span>${demo?demoMouse.dpi:mouseStatus?.dpi??'—'} DPI</span><span>${demo?demoMouse.pollingRateHz:(mouseStatus?.pollingReadVerified===false)?'Unknown':mouseStatus?.pollingRateHz??'—'} Hz</span><span>Browser input tester</span></div><small>This tests browser input. It does not change button assignments.</small><button class="secondary" id="mouse-delay" ${busy||!mouseStatus?'disabled':''}>Check delay & optimize</button></div></div>`;
}

function deviceTabs() {
  const tabs = view === 'mouse' ? [['settings','Performance & parameters'],['dpi','DPI stages'],['buttons','Buttons & macros'],['profiles','Profiles'],['device','Device']] : [['lighting','Lighting'],['tester','Key tester'],['trigger','Trigger'],['keys','Key config'],['advanced','Advanced keys'],['performance','Performance'],['profiles','Profiles'],['device','Device']];
  return '<nav class="device-tabs" aria-label="Device settings sections">' + tabs.map(([id,label]) => '<button type="button" data-section="'+id+'" class="'+((view==='mouse'?mouseTab:keyboardTab)===id?'active':'')+'">'+label+'</button>').join('')+'</nav>';
}
function sc620Notice(){
 if(!(mouse instanceof Sc620Client))return '';
 return `<div class="banner warning"><strong>AULA SC620 · experimental</strong><p>Settings are read from profile 1 over USB or the 2.4 GHz receiver. Physical verification is still needed. Bluetooth configuration, macro editing and sensor-processing flags are unavailable.</p><label><input type="checkbox" id="sc620-edits" ${sc620Edits?'checked':''} ${busy?'disabled':''}/> Enable experimental SC620 edits</label><button type="button" class="secondary" id="sc620-report">Test report & agreement</button></div>`;
}
function sc620Panel(){
 const s=mouseStatus;return `<form id="sc620-form" class="panel"><fieldset ${busy||!sc620Edits?'disabled':''}><h3>SC620 lighting & wheel</h3><p>Choose a built-in multicolor effect. A fixed RGB color and animation speed are not verified for this model.</p><div class="effect-tiles">${SC620_EFFECTS.map(effect=>`<label class="effect-tile"><input type="radio" name="sc620-effect" value="${effect}" ${s?.lighting?.mode===effect?'checked':''}/>${effect}</label>`).join('')}</div><label class="field-label" for="sc620-scroll">Wheel direction</label><select id="sc620-scroll" ${s?.scrollDirection==null?'disabled':''}>${['Forward','Reverse'].map(v=>`<option ${s?.scrollDirection===v?'selected':''}>${v}</option>`).join('')}</select><div class="apply-bar"><span>Built-in effects · checked by device readback</span><button class="primary" type="submit">Apply lighting & wheel</button></div></fieldset></form>`;
}
function x11Panel(){const s=(mouse as X11Client).native,l=s.lighting;if(l.mode<0||l.mode>6||l.speed<1||l.speed>5||l.brightness<1||l.brightness>8||l.deepSleep<1||l.deepSleep>60)return '<div class="banner warning">X11 lighting values are not recognized. Lighting editing is disabled; refresh or test another connection.</div>';return `<form id="x11-lighting" class="panel"><fieldset ${busy?'disabled':''}><h3>X11 device lighting & sleep</h3><p>Experimental native driver. Dock lighting uses the dock’s physical button. Existing macros are preserved; macro editing is not enabled.</p><div class="travel-fields"><label><span class="field-label">Device LED effect</span><select id="x11-mode">${['Off','Static','Breathing','Neon','Color breathing','DPI static','DPI breathing'].map((n,i)=>`<option value="${i}" ${l.mode===i?'selected':''}>${n}</option>`).join('')}</select></label><label>Speed<input id="x11-speed" type="number" min="1" max="5" value="${l.speed}" required/></label><label>Brightness<input id="x11-brightness" type="number" min="1" max="8" value="${l.brightness}" required/></label><label>Color<input id="x11-color" type="color" value="${l.color}"/></label><label>Deep sleep (minutes)<input id="x11-deep" type="number" min="1" max="60" value="${l.deepSleep}" required/></label></div><div class="apply-bar"><span>Current values read from the mouse. Physical testing is still needed.</span><button class="secondary" type="button" id="x11-cancel">Cancel changes</button><button class="primary">Apply lighting & sleep</button></div></fieldset></form>`;}
async function connectX11(){if(!desktop||busy)return;await perform(async()=>{const candidates=await desktop.x11('list') as Array<{id:string;name:string;productId?:number}>;if(!candidates.length)throw Error('No X11 configuration interface found. Connect its USB cable or 2.4 GHz receiver.');const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Choose your X11</h2><p>Wake the mouse. Shared receivers must identify as an X11 before settings unlock.</p>'+candidates.map(d=>'<button class="secondary" data-native-id="'+escape(d.id)+'">'+escape(d.name)+'</button>').join('')+'<button class="secondary" id="native-cancel">Cancel</button>';document.body.append(dialog);dialog.showModal();const id=await new Promise<string|null>(resolve=>{dialog.querySelectorAll<HTMLButtonElement>('[data-native-id]').forEach(b=>b.onclick=()=>{resolve(b.dataset.nativeId!);dialog.close();});dialog.querySelector('#native-cancel')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>resolve(null),{once:true});});dialog.remove();if(id===null)return;await mouse?.close();mouse=null;mouseStatus=null;let state;try{state=await desktop.x11('connect',[id]);}catch(error){const details=await desktop.x11('diagnostics').catch(()=>null);await failedConnection('mouse',{vendorId:0x1d57,productId:candidates.find(d=>d.id===id)?.productId??0xfa60},details?.interfaces,details?.checks);void openX11Details();throw error;}const client=new X11Client(state);mouse=client;mouseStatus=client.status();await smokeDevice('mouse',client.device,mouseStatus,()=>client.readStatus());mouseDraft=null;mouseApplyResult=null;view='mouse';home=true;notice('X11 connected. Current settings were read from the device.','success');});}
function mousePanel() {
  if (mouseTab === 'dpi') return dpiPanel();
  if (mouseTab === 'buttons') return mouseButtonsPanel();
  if (mouseTab === 'profiles') return mouseProfilesPanel();
  if (mouseTab === 'device') return deviceInfoPanel();
  const s = demo ? demoMouse : mouseStatus;
  const editing = mouseDraft ?? s;
  const locked = busy || (!demo && (!mouse || !mouseStatus || mouseStatus.ui?.settingsReady===false));
  const dpiValues = demo ? [400, 800, 1600, 3200, 6400] : mouse?.getDpiOptions() ?? [];
  const polling = demo ? [125, 250, 500, 1000] : mouseStatus?.supportedPollingRates ?? [];
  const debounce = demo ? [0, 1, 2, 4, 8, 15, 20] : mouse?.getDebounceOptions() ?? [];
  const stats = [
    ['battery', 'BATTERY', demo ? '55' : mouseStatus?.batteryPercent ?? '—', '%', demo ? 'Sample battery' : mouseStatus?.batteryState ?? 'Waiting for device'],
    ['zap', 'SENSITIVITY', s?.dpi?.toLocaleString() ?? '—', 'DPI', 'Active DPI stage'],
    ['radio', 'POLLING RATE', !demo&&(mouseStatus?.pollingReadVerified===false)?'Unknown':s?.pollingRateHz?.toLocaleString() ?? '—', 'Hz', 'Reports per second'],
    ['cable', 'CONNECTION', demo ? '2.4' : mouseStatus?.connectionType === 'Wireless' ? '2.4' : mouseStatus ? 'USB' : '—', demo || mouseStatus?.connectionType === 'Wireless' ? 'GHz' : '', demo ? 'Sample wireless connection' : mouseStatus?.connectionDetail ?? 'No device connected'],
  ];
  return `<div class="stats">${stats.map(([glyph, label, value, unit, sub],i) => `<div class="stat" ${i===0?'id="battery-stat"':''}><span>${icon(String(glyph))}${label}</span><strong>${i===0?`<b id="battery-value">${escape(value)}</b>`:escape(value)}<small>${unit}</small></strong><p ${i===0?'id="battery-detail"':''}>${escape(i===0&&!demo?batteryDetail():sub)}</p></div>`).join('')}</div>
    <form id="mouse-form"><fieldset ${locked ? 'disabled' : ''}>
      <div class="settings-grid"><div class="panel sensitivity"><div class="panel-title">${icon('sliders-horizontal')}<h3>Sensitivity</h3><span class="mini-tag">DPI</span></div><p>Set the sensitivity of your active DPI stage.</p><label class="field-label" for="dpi">DPI value</label><select id="dpi" required ${!dpiValues.length ? 'disabled' : ''}>${dpiValues.length ? options(dpiValues, editing?.dpi ?? 1600) : '<option>Connect to read DPI</option>'}</select><div class="dpi-presets">${[400, 800, 1600, 3200].map(value => `<button type="button" data-dpi="${value}" ${!dpiValues.includes(value) ? 'disabled' : ''} class="preset ${editing?.dpi === value ? 'chosen' : ''}">${value}</button>`).join('')}</div><div class="mini-chart" aria-hidden="true">${[12, 18, 24, 30, 38, 46, 55, 66, 78, 92, 100, 100, 100, 100, 100, 100].map((h, i) => `<span style="height:${h}%;opacity:${0.25 + i / 22}"></span>`).join('')}</div><div class="chart-labels"><span>MORE CONTROL</span><span>MORE SPEED</span></div></div>
      <div class="panel"><div class="panel-title">${icon('activity')}<h3>Performance</h3></div><p>Fine-tune response and click timing.</p><label class="field-label" for="polling">Polling rate</label><select id="polling" ${!polling.length ? 'disabled' : ''}>${polling.length ? ((!demo&&mouseStatus?.pollingReadVerified===false&&!mouseDraft?.pollingRateHz)?'<option value="" selected disabled>Current rate unknown — choose a rate to verify</option>':'')+options(polling, mouseDraft?.pollingRateHz || ((!demo&&mouseStatus?.pollingReadVerified===false)?-1:s?.pollingRateHz ?? 1000), ' Hz') : '<option>Connect to read rates</option>'}</select><small class="field-help">Only rates supported by your receiver are offered.</small><label class="field-label spaced" for="debounce">Click debounce</label><select id="debounce" required ${!demo&&s?.debounceMs==null?'disabled':''}>${debounce.length ? options(debounce, editing?.debounceMs ?? 4, ' ms') : '<option>Connect to read timing</option>'}</select><small class="field-help">Lower values reduce the delay between clicks.</small></div>
      <div class="panel processing"><div class="panel-title">${icon('zap')}<h3>Sensor behavior</h3></div><p>Choose how your mouse processes movement.</p>${toggle('motion', 'Motion sync', 'Synchronize sensor data with USB reports.', editing?.motionSync ?? false, locked || (!demo && mouseStatus?.motionSync == null))}${toggle('angle', 'Angle snapping', 'Straighten movement along a line.', editing?.angleSnapping ?? false, locked || (!demo && mouseStatus?.angleSnapping == null))}${toggle('ripple', 'Ripple control', 'Smooth sensor jitter at higher DPI.', editing?.rippleControl ?? false, locked || (!demo && mouseStatus?.rippleControl == null))}</div></div>
      <div class="apply-bar"><span>${icon('info')} ${mouse instanceof Sc620Client?'Changes apply to SC620 profile 1.':'Changes apply to the active onboard configuration.'}</span><button class="primary" type="submit">${icon('check')} ${demo ? 'Apply to preview' : 'Apply changes'}</button></div>
    </fieldset>${mouseApplyResult?'<div class="banner '+(mouseApplyResult.kind==='error'?'warning':'')+'" role="status">'+escape(mouseApplyResult.text)+'</div>':''}${mouseDraft&&!busy?'<div class="apply-bar"><span>Your selection is pending. The numbers above show the last device read.</span><button type="button" class="secondary" id="discard-mouse-draft">Cancel changes</button></div>':''}</form>${mouseExtraPanel()}${mouse instanceof Sc620Client?sc620Panel():''}${mouse instanceof X11Client?x11Panel():''}${!s ? '<div class="connect-hint">Connect a supported mouse or its receiver to unlock settings. Existing settings are read before anything changes.</div>' : ''}`;
}

const rows: [string, string, number?][][] = [
  [['Esc', 'Escape'], ['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4'], ['5', 'Digit5'], ['6', 'Digit6'], ['7', 'Digit7'], ['8', 'Digit8'], ['9', 'Digit9'], ['0', 'Digit0'], ['−', 'Minus'], ['=', 'Equal'], ['Backspace', 'Backspace', 2]],
  [['Tab', 'Tab', 1.5], ...'QWERTYUIOP'.split('').map(c => [c, `Key${c}`] as [string, string]), ['[', 'BracketLeft'], [']', 'BracketRight'], ['\\', 'Backslash', 1.5]],
  [['Caps', 'CapsLock', 1.75], ...'ASDFGHJKL'.split('').map(c => [c, `Key${c}`] as [string, string]), [';', 'Semicolon'], ["'", 'Quote'], ['Enter', 'Enter', 2.25]],
  [['Shift', 'ShiftLeft', 2.25], ...'ZXCVBNM'.split('').map(c => [c, `Key${c}`] as [string, string]), [',', 'Comma'], ['.', 'Period'], ['/', 'Slash'], ['Shift', 'ShiftRight', 2.75]],
  [['Ctrl', 'ControlLeft', 1.25], ['Win', 'MetaLeft', 1.25], ['Alt', 'AltLeft', 1.25], ['Space', 'Space', 6.25], ['Alt', 'AltRight', 1.25], ['Menu', 'ContextMenu', 1.25], ['Ctrl', 'ControlRight', 1.25], ['Fn', 'Fn', 1.25]],
];
function keyboardPanel() {
  if (keyboardTab === 'trigger' && (demo || keyboard?.device.productId === 0x2103)) return proTriggerPanel();
  if (keyboardTab === 'performance') return keyboardPerformancePanel();
  if (keyboardTab === 'profiles') return keyboardProfilesPanel();
  if (keyboardTab === 'device') return deviceInfoPanel();
  if (keyboardTab === 'keys' || keyboardTab === 'advanced') return keyboardBindingsPanel();
  const writable = demo || keyboardStatus?.canWrite;
  const locked = busy || !writable;
  const first = demo ? demoTravel : keyboardStatus?.keys[0];
  return `<div class="keyboard-layout"><div class="panel tester-panel"><div class="panel-title">${icon('keyboard')}<h3>Key tester</h3><span class="mini-tag">60% ANSI</span></div><p>Test ordinary key presses. Analog travel is not measured.</p><div class="keyboard-board" aria-label="Keyboard key test visualization">${rows.map(row => `<div class="key-row">${row.map(([label, code, width]) => `<span class="key ${tested.has(code) ? 'tested' : ''} ${pressed.has(code) ? 'pressed' : ''}" data-code="${code}" style="flex:${width ?? 1}">${escape(label)}</span>`).join('')}</div>`).join('')}</div><div class="tester-bar"><span>Last key <strong id="last-key">${escape(lastKey)}</strong></span><span><strong id="key-count">${tested.size}</strong> keys tested</span><button type="button" class="secondary" id="test-toggle">${icon(tester ? 'x' : 'activity')}${tester ? 'Stop test' : 'Start key test'}</button><button type="button" class="text-button" id="clear-test">Clear</button></div><small class="field-help">Some system keys and Fn cannot be observed by a webpage. Click Stop test to use shortcuts normally.</small></div>
    <div class="panel keyboard-info"><span class="eyebrow">DEVICE DETAILS</span><h3>${escape(keyboardStatus?.name ?? 'MCHOSE Ace 60')}</h3><dl><div><dt>Firmware</dt><dd>${escape(demo ? 'Preview' : keyboardStatus?.firmware ?? '—')}</dd></div><div><dt>USB identity</dt><dd>${keyboard ? `${hex(keyboard.device.vendorId)}:${hex(keyboard.device.productId)}` : '—'}</dd></div><div><dt>Active profile</dt><dd>${demo ? 'Preview' : keyboardStatus?.profile ?? '—'}</dd></div><div><dt>Settings access</dt><dd>${demo ? 'Preview' : keyboardStatus ? writable ? 'Experimental' : keyboardStatus.canWriteLighting ? 'Lighting enabled' : 'Read-only' : 'Disconnected'}</dd></div></dl><p class="compatibility-note">${keyboardStatus && !writable ? 'Your Ace 60 Pro has a different settings layout. Firmware 1.18 supports lighting, Windows key lock, and experimental trigger/basic key controls. Load keys before editing.' : 'Ace 60 writes use a community-documented protocol. Compatibility must be tested on your firmware.'}</p></div></div>
    ${lightingPanel()}
    <form id="keyboard-form"><fieldset ${locked ? 'disabled' : ''}><div class="panel travel-panel"><div class="panel-title">${icon('sliders-horizontal')}<h3>Actuation & rapid trigger</h3><span class="mini-tag amber">${demo ? 'PREVIEW' : 'ACE 60 · EXPERIMENTAL'}</span></div><p>Adjust activation and rapid-trigger distances while preserving existing key modes.</p><div class="travel-fields">${[['actuation', 'Actuation distance', first?.actuation ?? 1], ['press', 'RT press distance', first?.press ?? 0.2], ['release', 'RT release distance', first?.release ?? 0.2]].map(([id, label, value]) => `<label><span class="field-label">${label}</span><div class="unit-input"><input type="number" id="${id}" min="0.10" max="4" step="0.02" value="${Number(value).toFixed(2)}" required/><span>mm</span></div></label>`).join('')}</div><label class="field-label" for="key-slot">Apply to</label><select id="key-slot"><option value="all">All detected travel records</option>${keyboardStatus?.keys.map(k => `<option value="${k.slot}">Hardware slot ${k.slot} · ${k.actuation.toFixed(2)} mm</option>`).join('') ?? ''}</select><small class="field-help">Slot numbers are device record IDs, not the keys in the tester above.</small><label class="experimental-consent"><input id="experimental" type="checkbox" ${demo ? 'checked' : ''} required/> I understand these Ace 60 controls are experimental. Settings will be checked by reading them back.</label><div class="apply-bar"><button class="secondary" type="button" id="backup" ${!keyboardStatus?.raw || demo ? 'disabled' : ''}>${icon('download')} Back up settings</button><button class="primary" type="submit">${icon('check')}${demo ? 'Apply to preview' : 'Apply distances'}</button></div></div></fieldset></form>`;
}

function lightingPanel() {
  const light=lightDraft ?? (demo?demoLighting:keyboardStatus?.lighting) ?? {effect:3,color:'#ff0033',rainbow:false,brightness:100,speed:3};
  const locked=busy||(!demo&&!keyboardStatus?.canWriteLighting);
  return `<form id="lighting-form"><fieldset ${locked?'disabled':''}><div class="panel travel-panel"><div class="panel-title">${icon('zap')}<h3>Keyboard lighting</h3><span class="mini-tag">${demo?'PREVIEW':'ACE 60 PRO · 1.18'}</span></div><div id="rgb-preview" class="rgb-preview" aria-label="Keyboard RGB simulation">${rgbBoard(light)}</div><p class="preview-caption">Visual simulation of your selection. Check your keyboard to confirm the physical effect.</p><div class="studio-columns"><section><h3>Lighting effects</h3><input id="light-effect" type="hidden" value="${light.effect}"/><div class="effect-tiles">${LIGHT_EFFECTS.map(e=>`<button type="button" data-effect="${e.value}" class="effect-tile ${light.effect===e.value?'active':''}" aria-pressed="${light.effect===e.value}"><span class="effect-symbol">${['◌','≈','✧','◈'][e.value%4]}</span>${e.label}</button>`).join('')}</div></section><section><h3>Speed & brightness</h3><label class="slider-label" for="light-speed">Animation speed <output id="light-speed-value">${light.speed ?? 3} / 4</output></label><input id="light-speed" type="range" min="1" max="4" step="1" value="${Math.max(1,light.speed ?? 3)}"/><label class="slider-label spaced" for="light-brightness">Brightness <output id="light-brightness-value">${light.brightness ?? 100}%</output></label><input id="light-brightness" type="range" min="0" max="100" step="1" value="${light.brightness ?? 100}"/><small class="field-help">0% turns LEDs off. 100% is full brightness.</small><label class="experimental-consent"><input id="light-rainbow" type="checkbox" ${light.rainbow?'checked':''}/> Multicolor effect</label></section><section><h3>Color palette</h3><label for="light-color" class="field-label">RGB color</label><input id="light-color" class="large-color" type="color" value="${light.color}"/><label for="light-hex" class="field-label spaced">Hex color</label><input id="light-hex" type="text" maxlength="7" pattern="#[0-9a-fA-F]{6}" value="${light.color.toUpperCase()}"/><div class="color-presets">${['#ff0033','#ff9900','#ffff00','#00ff66','#00ccff','#6633ff','#ff00ff','#ffffff'].map(color=>`<button type="button" data-color="${color}" style="background:${color}" aria-label="Color ${color}"></button>`).join('')}</div><small class="field-help">Static and Breathing use this color when Multicolor is off. Reactive effects appear on a key press.</small></section></div><div class="apply-bar"><span>${icon('download')} Settings are verified by device readback.</span><button class="primary" type="submit">${icon('check')}${demo?'Preview lighting':'Apply lighting'}</button></div></div></fieldset></form>`;
}
function rgbBoard(light:AceLighting) {
  let index=0;const family=[1,5,6,7,8,10,11,12,18].includes(light.effect)?'wave':[4].includes(light.effect)?'breath':[9,19,20,21,22].includes(light.effect)?'spark':[13,14,15,16,17].includes(light.effect)?'reactive':'static';
  return `<div class="keyboard-board rgb-board rgb-${family} ${(light.brightness??100)===0?'rgb-off':''}" style="--rgb-duration:${5-(light.speed??3)}s;--rgb-brightness:${(light.brightness??100)/100}">${rows.map(row=>`<div class="key-row">${row.map(([label,code,width])=>{const i=index++;const color=light.rainbow||[1,5].includes(light.effect)?`hsl(${i*27%360} 95% 58%)`:light.color;return `<button type="button" class="key rgb-key" data-rgb-key="${code}" style="flex:${width??1};--key-color:${color};--key-delay:-${i*.08}s">${escape(label)}</button>`;}).join('')}</div>`).join('')}</div>`;
}

function mouseExtraPanel() {
  const s = mouseStatus;
  const locked = busy || (!demo && !s);
  const sleep = mouse?.getSleepOptions() ?? [30,60,120,180,300,1200,1500,1800];
  const lod = s?.supportedLiftOffDistances ?? ['Low','High'];
  const performanceHelp = !demo && s && s.performanceMode == null ? 'This interface did not provide a valid sensor-mode read. Try wired USB and Refresh.' : mouse?.device.productId===0xf58e && s?.name==='VXE R1' ? 'Experimental R1 receiver path; requires an echoed write and full readback.' : 'Higher sensor sampling, where supported.';
  return `<form id="mouse-extra-form"><fieldset ${locked ? 'disabled' : ''}><div class="panel travel-panel"><div class="panel-title">${icon('sliders-horizontal')}<h3>Power, sensor & indicator</h3></div><div class="travel-fields"><label><span class="field-label">Sleep timeout</span><select id="mouse-sleep" ${!demo && s?.sleepTimeout == null ? 'disabled' : ''}>${sleep.map(v => `<option value="${v}" ${v === (s?.sleepTimeout ?? 60) ? 'selected' : ''}>${v < 60 ? `${v} seconds` : `${v/60} minutes`}</option>`).join('')}</select></label><label><span class="field-label">Lift-off distance</span><select id="mouse-lod" ${!demo && s?.liftOffDistance == null ? 'disabled' : ''}>${lod.map(v => `<option value="${v}" ${v === (s?.liftOffDistance ?? 'Low') ? 'selected' : ''}>${v === 'Low' ? 'Low' : v === 'High' ? 'High' : v}</option>`).join('')}</select></label><div>${toggle('mouse-performance','High-performance mode',performanceHelp,s?.performanceMode ?? false,locked || (!demo && s?.performanceMode == null))}${toggle('mouse-range','Long-range mode','Extended wireless range with increased power use.',s?.longRangeMode ?? false,locked || (!demo && s?.longRangeMode == null))}</div></div><div class="travel-fields"><label><span class="field-label">DPI indicator effect</span><select id="mouse-led-mode" ${!demo && !s?.ui?.dpiLighting ? 'disabled' : ''}>${[[0,'Off'],[1,'Always on'],[2,'Breathing']].map(([v,l]) => `<option value="${v}" ${v === (s?.dpiLedMode ?? 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label><span class="field-label">Indicator brightness</span><select id="mouse-led-brightness" ${!demo && !s?.ui?.dpiLighting ? 'disabled' : ''}>${options([0,1,2],s?.dpiLedBrightness ?? 1)}</select></label><label><span class="field-label">Indicator speed</span><select id="mouse-led-speed" ${!demo && !s?.ui?.dpiLighting ? 'disabled' : ''}>${options([0,1,2],s?.dpiLedSpeed ?? 1)}</select></label></div><small class="field-help">Indicator levels: 0 low, 1 medium, 2 high. Controls unlock only when the driver reads the setting on your connection.</small><div class="apply-bar"><button class="primary" type="submit">${icon('check')}${demo ? 'Apply to preview' : 'Apply parameters'}</button></div></div></fieldset></form>`;
}

function dpiPanel() {
  const stages = demo ? [400,800,1600,3200] : mouseStatus?.dpiStages ?? [];
  const editor = mouseStatus?.ui?.dpiStageEditor;
  const locked = busy || (!demo && !editor);
  const active = demo ? 2 : mouseStatus?.activeDpiStage ?? 0;
  return `<div class="panel"><div class="panel-title">${icon('sliders-horizontal')}<h3>DPI stages</h3><span class="mini-tag">${stages.length} STAGES</span></div><p>Edit each onboard sensitivity stage and choose the stage used by your mouse.</p><form id="dpi-count-form"><fieldset ${locked||(!demo&&!editor?.countEditable) ? 'disabled' : ''}><div class="inline-controls"><label><span class="field-label">Number of stages</span><select id="dpi-count">${options(Array.from({length: editor?.maxStages ?? 6},(_,i)=>i+1),stages.length || 4)}</select></label><button class="secondary" type="submit">Change stage count</button></div></fieldset></form><div class="stage-grid">${stages.map((dpi,index) => `<form class="stage-card" data-stage="${index}"><fieldset ${locked ? 'disabled' : ''}><div class="panel-title"><h3>Stage ${index+1}</h3><span class="mini-tag">${index === active ? 'ACTIVE' : 'DPI'}</span></div><label><span class="field-label">DPI value</span><input class="stage-dpi" type="number" value="${dpi}" min="${editor?.minDpi ?? 50}" max="${editor?.maxDpi ?? 26000}" step="${editor?.stepDpi ?? 50}" required/></label>${demo || mouseStatus?.dpiStageColors ? `<label><span class="field-label">Stage color</span><input class="stage-color" type="color" value="${mouseStatus?.dpiStageColors?.[index] ?? ['#ff3333','#33dd55','#3377ff','#dd33ff'][index%4]}"/></label>` : ''}<div class="inline-controls"><button class="secondary" type="submit">Save stage</button><button class="text-button" type="button" data-activate-stage="${index}" ${mouseStatus?.pollingReadVerified!=null&&!(mouse instanceof X11Client)?'disabled title="Use the physical DPI button on this receiver"':''}>Use stage</button></div></fieldset></form>`).join('')}</div>${!demo && !editor ? '<div class="connect-hint">Stages are shown when read from the mouse. Stage editing requires a connection verified by the driver; try wired USB if it stays locked.</div>' : ''}<p class="field-help">Separate X/Y editing is available below only when the device advertises support.</p>${demo || mouseStatus?.supportsSeparateDpiAxes ? `<form id="dpi-axis-form"><fieldset ${busy ? 'disabled' : ''}><div class="travel-fields"><label><span class="field-label">Active X DPI</span><input id="dpi-x" type="number" min="50" step="50" value="${mouseStatus?.dpi ?? 1600}" required/></label><label><span class="field-label">Active Y DPI</span><input id="dpi-y" type="number" min="50" step="50" value="${mouseStatus?.dpiY ?? 1600}" required/></label><button class="primary" type="submit">Apply X/Y</button></div></fieldset></form>` : ''}</div>`;
}

function mouseButtonsPanel() {
  const generic=mouseStatus?.buttonMappings,actions=mouseStatus?.buttonOptions;
  if(generic)return `<div class="panel"><div class="panel-title"><h3>Mouse buttons</h3></div><p>Current assignments read from your device.</p><div class="data-table">${Object.entries(generic).map(([button,action])=>`<div><strong>${escape(button)}</strong><span>${escape(action)}</span></div>`).join('')}</div>${actions?.length?`<form id="shark-button-form"><fieldset ${busy?'disabled':''}><div class="travel-fields"><label><span class="field-label">Mouse button</span><select id="shark-button">${Object.entries(generic).filter(([button,action])=>((!(mouse instanceof Sc620Client)&&!(mouse instanceof X11Client))||button!=='Left')&&(mouse instanceof X11Client||actions.includes(action))).map(([button])=>`<option>${escape(button)}</option>`).join('')}</select></label><label><span class="field-label">New action</span><select id="shark-action">${actions.map(action=>`<option>${escape(action)}</option>`).join('')}</select></label><button class="primary" type="submit">Apply button</button></div></fieldset></form><small>Existing macros and unknown actions are preserved. Test the physical button after applying.</small>`:''}</div>`;
  const mappings = mouseStatus?.atkButtonMappings;
  return `<div class="panel"><div class="panel-title">${icon('mouse')}<h3>Button assignments</h3><span class="mini-tag">READ-ONLY</span></div><p>Current onboard assignments, when the driver can read them.</p>${mappings?.length ? `<div class="data-table">${mappings.map(b => `<div><strong>${escape(b.name)}</strong><span>${escape(b.action)}</span><small>${b.checksumValid ? 'Verified record' : 'Unknown checksum'}</small></div>`).join('')}</div>` : '<div class="connect-hint">Button records are unavailable on this connection. Try a supported wired interface.</div>'}<div class="feature-note"><h3>Remapping & macros</h3><p>The current VXE driver exposes button records for inspection but does not provide a verified writer for button assignments or macros. Existing bindings stay usable; editing is not enabled yet.</p></div></div>`;
}

function mouseProfilesPanel() {
  const s = mouseStatus;
  return `<div class="panel"><div class="panel-title">${icon('layout-grid')}<h3>Onboard profiles</h3></div><p>Switch between the configuration banks reported by the device.</p><form id="mouse-profile-form"><fieldset ${busy || (!demo && !s?.atkProfileCount) ? 'disabled' : ''}><div class="inline-controls"><label><span class="field-label">Active profile</span><select id="mouse-profile">${options(Array.from({length:s?.atkProfileCount ?? 4},(_,i)=>i+1),s?.activeProfile ?? 1)}</select></label><button class="primary" type="submit">Use profile</button></div></fieldset></form>${!demo && !s?.atkProfileCount ? '<div class="connect-hint">Profile switching unlocks after the driver reads the onboard banks on a supported connection.</div>' : ''}<div class="feature-note"><h3>Settings snapshot</h3><p>Download the settings currently displayed by Family Gear for reference. This is not a complete firmware backup.</p><button class="secondary" id="mouse-export" ${!s ? 'disabled' : ''}>${icon('download')} Export displayed settings</button></div></div>`;
}

function keyboardPerformancePanel() {
  const snapshot=keyboardStatus?.lightingSnapshot,offset=(snapshot?.profile??0)*64,settings=snapshot?.settings;
  const locked=busy||(!demo&&!keyboardStatus?.canWriteLighting);
  const pollingCode=demo?demoPerformance.pollingCode!:settings?settings[offset+4]&15:3;
  const mac=demo?demoPerformance.macMode:Boolean(settings&&((settings[offset+1]&3)>=2));
  return `<form id="pro-performance-form"><fieldset ${locked?'disabled':''}><div class="panel"><div class="panel-title">${icon('activity')}<h3>Keyboard performance</h3></div><div class="travel-fields"><label><span class="field-label">Polling rate</span><select id="pro-polling">${![1,2,3,4].includes(pollingCode)?`<option value="${pollingCode}">Unknown current code ${pollingCode} — choose a rate</option>`:''}${[[4,'1,000 Hz'],[3,'2,000 Hz'],[2,'4,000 Hz'],[1,'8,000 Hz']].map(([v,name])=>`<option value="${v}" ${v===pollingCode?'selected':''}>${name}</option>`).join('')}</select><small class="field-help">A polling change can restart USB. Reconnect and Refresh if needed.</small></label><div>${toggle('pro-win-lock','Windows key lock','Disabled automatically when switching to Mac mode.',demo?demoWinLock:Boolean(settings&&(settings[offset+6]&1)),locked)}${toggle('pro-mac','Mac mode','Use the active profile’s Mac base layer.',mac,locked)}</div><div>${toggle('pro-debounce','Debounce optimization','Reduce repeated triggers caused by key bounce.',demo?demoPerformance.debounce:Boolean(settings&&(settings[offset+7]>>5)),locked)}${toggle('pro-stability','Stability mode','Reduce mistouches caused by vibration or light finger pressure.',demo?demoPerformance.stability:Boolean(settings&&(settings[offset+7]&2)),locked)}${toggle('pro-calibration','Adaptive dynamic calibration','Enable the device’s automatic travel compensation.',demo?demoPerformance.autoCalibration:Boolean(settings&&(settings[offset+7]&4)),locked)}</div></div><div class="apply-bar"><span>${icon('download')} A profile backup downloads before writing.</span><button class="primary" type="submit">Apply keyboard performance</button></div></div></fieldset></form>`;
}

function keyboardProfilesPanel() {
  const snapshot = keyboardStatus?.lightingSnapshot;
  return `<div class="panel"><div class="panel-title">${icon('layout-grid')}<h3>Keyboard profiles</h3></div><p>Active onboard profile: <strong>${keyboardStatus?.profile ?? '—'}</strong></p><p>Lighting and Windows key lock apply to this active profile.</p><button class="secondary" id="keyboard-profile-export" ${!snapshot ? 'disabled' : ''}>${icon('download')} Export profile settings</button><div class="feature-note"><h3>Onboard profile management</h3><p>Creating, switching and deleting onboard profiles also changes key and trigger data. Those commands are not enabled yet. Use M HUB for those operations, then return here and Refresh.</p></div></div>`;
}

function keyboardBindingsPanel() {
  return keyboardTab==='advanced'?advancedPanel():proRemapPanel();
}
function advancedBoard() {
  const keys=proData?.keys??[];
  return '<div class="keyboard-board advanced-board" aria-label="Choose binding keys">'+rows.map(row=>'<div class="key-row">'+row.map(([label,code,width])=>{
    const key=keys.find(k=>k.code===browserCodeToHid(code));
    const type=key?advancedData?.mappings[proLayer*512+key.slot*3]:undefined;
    const tag=({144:'DKS',145:'TGL',146:'MT',147:'RS',148:'SOCD'} as Record<number,string>)[type??0]??'';
    return key?`<button type="button" class="key ${advancedSlots.includes(key.slot)?'tested':''}" data-advanced-key="${key.slot}" data-browser-code="${code}" aria-label="Bind ${escape(key.name)}" aria-pressed="${advancedSlots.includes(key.slot)}" style="flex:${width??1}"><strong>${escape(label)}</strong><small>${tag}</small></button>`:`<span class="key" style="flex:${width??1};opacity:.4">${escape(label)}</span>`;
  }).join('')+'</div>').join('')+'</div>';
}
function advancedPanel() {
  const data=advancedData,keys=proData?.keys??[],loaded=Boolean(data),locked=busy||!loaded,pair=['rs','socd'].includes(advancedType);
  const keyOptions=(index:number)=>'<option value="-1">Click a key above</option>'+keys.map(k=>`<option value="${k.slot}" ${advancedSlots[index]===k.slot?'selected':''}>${escape(k.name)}</option>`).join('');
  const action=(id:string,name:string)=>`<div class="action-card"><button type="button" data-action-target="${id}" class="secondary ${actionPick===id?'active':''}">${name}<strong id="${id}-name">A</strong></button><select class="sr-only" aria-label="${name}" id="${id}">${BASIC_KEYS.map(k=>`<option value="${k.code}">${escape(k.name)}</option>`).join('')}</select></div>`;
  return `<div class="panel advanced-studio"><div class="panel-title"><h3>Advanced key bindings</h3><span class="mini-tag amber">EXPERIMENTAL · PRO 1.18</span></div>${proLoadControls()}<div class="advanced-stage">${advancedBoard()}<p>Click a key to bind it. Press keys to see digital input feedback.</p></div><div class="advanced-tiles">${[['rs','RS','Deeper key press takes priority'],['socd','SOCD','Resolve two opposing keys'],['mt','Hold / Tap','Tap one action, hold another'],['tgl','Toggle','Press once to hold, again to release'],['dks','Dynamic key press','Four actions across press and release'],['remove','Remove binding','Restore the original physical key action']].map(([id,name,help])=>`<button type="button" data-advanced-type="${id}" class="effect-tile ${advancedType===id?'active':''}" aria-pressed="${advancedType===id}"><strong>${name}</strong><small>${help}</small></button>`).join('')}</div>${!loaded?'<div class="connect-hint">Load keys to read the active layer and action banks.</div>':`<form id="advanced-form"><fieldset ${locked?'disabled':''}><div class="binding-editor"><section><h3>Binding keys</h3><div class="bind-key-cards">${[0,...pair?[1]:[]].map(index=>`<label><button type="button" class="secondary ${advancedPick===index?'active':''}" data-binding-target="${index}">Bind key ${index+1}</button><select id="advanced-${index?'second':'slot'}" aria-label="${index?'Second key':'Physical key'}">${keyOptions(index)}</select></label>`).join('')}</div><small>Choose a binding slot, then click the keyboard above.</small></section><section><h3>${advancedType==='socd'?'Trigger condition':'Actions'}</h3>${advancedType==='socd'?`<div class="priority-options">${['Last input wins','First key wins','Second key wins','Neutral — neither key'].map((name,i)=>`<label><input type="radio" name="socd-priority" value="${i}" ${i===0?'checked':''}/>${name}</label>`).join('')}</div>`:advancedType==='mt'?action('advanced-hold','Hold action')+action('advanced-tap','Tap action')+'<label class="slider-label" for="advanced-delay">Hold delay <output id="advanced-delay-value">150 ms</output></label><input id="advanced-delay" type="range" min="10" max="2550" step="10" value="150"/>':advancedType==='tgl'?action('advanced-hold','Toggle action'):advancedType==='dks'?['Shallow press · 1 mm','Deep press · 3 mm','Deep release · 3 mm','Shallow release · 1 mm'].map((name,i)=>action('advanced-action-'+i,name)).join(''):advancedType==='rs'?'<p>The deeper pressed key takes priority. Each key keeps its original physical action.</p>':'<p>Restore the original physical key action. Paired bindings are removed together.</p>'}</section>${['mt','tgl','dks'].includes(advancedType)?`<section><h3>Assign an action</h3><input id="action-search" placeholder="Search key actions" aria-label="Search key actions"/><div class="action-palette">${BASIC_KEYS.map(k=>`<button type="button" class="key" data-action-code="${k.code}">${escape(k.name)}</button>`).join('')}</div><small>Select an action card, then click a key action.</small></section>`:''}</div><p>${advancedType==='dks'?'Preset events at fixed 1 / 3 / 3 / 1 mm points.':'New bindings require basic keys. SOCD priority applies across layers. Remove restores original physical actions.'}</p><div class="apply-bar"><span>Test the physical keys after applying.</span><button class="secondary" type="button" id="advanced-cancel">Cancel</button><button class="primary" type="submit" id="advanced-submit" ${advancedSlots[0]==null||(pair&&advancedSlots[1]==null)?'disabled':''}>${advancedType==='remove'?'Remove selected binding':'Apply advanced binding'}</button></div></fieldset></form><div class="data-table">${keys.filter(k=>[144,145,146,147,148].includes(data!.mappings[proLayer*512+k.slot*3])).map(k=>`<div><strong>${escape(k.name)}</strong><span>${({144:'DKS',145:'Toggle',146:'Hold / Tap',147:'RS',148:'SOCD'} as Record<number,string>)[data!.mappings[proLayer*512+k.slot*3]]}</span></div>`).join('')||'<p>No advanced bindings in this layer.</p>'}</div>`}</div>`;
}

function deviceInfoPanel() {
  const isMouse = view === 'mouse';
  return `<div class="panel"><div class="panel-title">${icon('info')}<h3>Device information</h3></div><dl class="detail-list"><div><dt>Model</dt><dd>${escape(isMouse ? mouseStatus?.name ?? 'Not connected' : keyboardStatus?.name ?? 'Not connected')}</dd></div><div><dt>Firmware</dt><dd>${escape(isMouse ? mouseStatus?.firmware ?? '—' : keyboardStatus?.firmware ?? '—')}</dd></div><div><dt>Connection</dt><dd>${escape(isMouse ? mouseStatus?.connectionDetail ?? '—' : keyboard ? 'Wired USB' : '—')}</dd></div></dl><div class="feature-note"><h3>Firmware, pairing & factory reset</h3><p>Use the official configurator for firmware updates${isMouse ? ', receiver pairing' : ''} and factory reset. Family Gear does not perform these operations.</p><a href="${isMouse ? 'https://hub.atk.pro/' : 'https://www.mchose.com.cn/'}" target="_blank" rel="noreferrer">Open official configurator ${icon('arrow-up-right')}</a></div></div>`;
}

function exportKeyboardProfile() {
  const snapshot = keyboardStatus?.lightingSnapshot;
  if (snapshot) download(`ace60pro-profile-${Date.now()}.json`,JSON.stringify({format:'amouse-ace60pro-profile-v1',firmware:snapshot.firmware,profile:snapshot.profile+1,baseBytes:Array.from(snapshot.base),settingsBytes:Array.from(snapshot.settings)},null,2));
}

function proLoadControls() {
  return `<div class="inline-controls"><label><span class="field-label">Key layer</span><select id="pro-layer">${['Windows base','Windows Fn','Mac base','Mac Fn'].map((name,i)=>`<option value="${i}" ${proLayer===i?'selected':''}>${name}</option>`).join('')}</select></label><button class="secondary" id="pro-load" ${busy || (!demo && !keyboardStatus?.canWriteLighting) ? 'disabled' : ''}>${icon('refresh-cw')} Load keys from keyboard</button></div>`;
}
function browserCodeToHid(code:string):number {
  if(/^Key[A-Z]$/.test(code))return code.charCodeAt(3)-65+4;
  if(/^Digit[0-9]$/.test(code))return code==='Digit0'?39:Number(code.at(-1))+29;
  return ({Escape:41,Backspace:42,Tab:43,Space:44,Minus:45,Equal:46,BracketLeft:47,BracketRight:48,Backslash:49,Semicolon:51,Quote:52,Comma:54,Period:55,Slash:56,CapsLock:57,Enter:40,ContextMenu:101,ControlLeft:224,ShiftLeft:225,AltLeft:226,MetaLeft:227,ControlRight:228,ShiftRight:229,AltRight:230,MetaRight:231} as Record<string,number>)[code] ?? 0;
}
function proKeyboardBoard(keys:ProData['keys']) {
  return `<div class="keyboard-board trigger-board" aria-label="Select physical keyboard keys">${rows.map(row=>`<div class="key-row">${row.map(([label,code,width])=>{
    const key=keys.find(k=>k.code===browserCodeToHid(code));
    return key ? `<button type="button" class="key ${selectedProKeys.has(key.slot)?'tested':''}" data-live-slot="${key.slot}" style="flex:${width??1}" data-pro-select="${key.slot}" aria-pressed="${selectedProKeys.has(key.slot)}" aria-label="${escape(key.name)}"><strong>${escape(label)}</strong><small>${triggerDisplay==='rt'?key.press.toFixed(2):triggerDisplay==='deadzone'?key.pressDeadzone.toFixed(2):key.actuation.toFixed(2)}</small>${triggerDisplay!=='actuation'?`<small>${triggerDisplay==='rt'?key.release.toFixed(2):key.releaseDeadzone.toFixed(2)}</small>`:''}</button>` : `<span class="key" style="flex:${width??1};opacity:.4">${escape(label)}</span>`;
  }).join('')}</div>`).join('')}</div>`;
}
function makeProPreview(layer:number):ProData {
  const physical=new Uint8Array(384),travel=new Uint8Array(1024),settings=new Uint8Array(256);
  rows.flat().filter(([,code])=>code!=='Fn').forEach(([,browserCode],slot)=>{const code=browserCodeToHid(browserCode);physical.set(code>=224?[16,1<<(code-224),0]:[16,0,code],slot*3);travel.set([0xa0,1,149,0,29,0,29,0],slot*8);});
  settings.set([0xaa,0xbb],2);
  return {snapshot:{settings,base:new Uint8Array([0,1,0,0,0,0]),profile:0,firmware:'Preview'},layer,physical,travel,mappings:physical.slice(),keys:decodeProData(travel,physical)};
}
function proTriggerPanel() {
  const keys=proData?.keys??[],first=keys.find(k=>selectedProKeys.has(k.slot))??keys[0];
  const range=(id:string,name:string,value:number,min:number,max:number,step:number)=>`<label class="slider-label" for="${id}">${name}<output id="${id}-value">${value.toFixed(2)} mm</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"/>`;
  return `<div class="panel trigger-studio"><div class="panel-title">${icon('zap')}<h3>Actuation & rapid trigger</h3><span class="mini-tag amber">PRO · EXPERIMENTAL</span></div>${proLoadControls()}<div class="live-controls"><button type="button" class="secondary" id="live-start" ${!proData||busy||liveSession?'disabled':''}>Live travel</button><button type="button" class="secondary" id="calibration-start" ${!proData||busy||liveSession?'disabled':''}>Start calibration</button><button type="button" class="secondary" id="live-stop" ${!liveSession||busy?'disabled':''}>Exit ${calibrationSession?'calibration':'live travel'}</button><span id="live-label">${liveSession?(demo?'Preview session — digital keys only':calibrationSession?'Calibration active — press each key fully several times':'Waiting for measured travel reports'):'Live travel is stopped'}</span></div><div class="live-meter"><span id="live-key">Measured travel</span><strong id="live-mm">— mm</strong><div class="travel-track"><div id="live-fill"></div></div></div>${calibrationSession?'<div class="connect-hint">Place the keyboard flat on a non-metal surface. Keep it still and press each key fully several times. Green keys indicate device-confirmed calibration; no color is inferred from browser key events.</div>':''}<div class="trigger-stage"><div>${proKeyboardBoard(keys)}<div class="preview-tabs">${[['actuation','Actuation distance'],['rt','Quick trigger (RT)'],['deadzone','Dead zone']].map(([id,name])=>`<button type="button" data-trigger-display="${id}" class="${triggerDisplay===id?'active':''}">${name}</button>`).join('')}</div></div><div class="selection-tools"><button class="secondary" id="pro-wasd" ${!proData?'disabled':''}>Select WASD</button><button class="secondary" id="pro-all" ${!proData?'disabled':''}>Select all keys</button><button class="secondary" id="pro-invert" ${!proData?'disabled':''}>Invert selection</button><button class="secondary" id="pro-clear">Clear selection</button><span>${selectedProKeys.size} keys selected</span></div></div>${!proData?'<div class="connect-hint">Connect and Load keys to read actual distances. The keyboard layout is shown while waiting.</div>':''}<p class="field-help">${first?`Saved values shown for ${escape(first.name)}. Choose keys above; Apply updates all selected keys.`:'Load keys to read saved trigger settings.'}</p><form id="pro-trigger-form"><fieldset ${busy||!selectedProKeys.size?'disabled':''}><div class="studio-columns"><section><h3>Set actuation distance</h3><p>Actuation point for the selected keys.</p>${range('pro-actuation','Actuation distance',first?.actuation??1.5,.1,3.3,.01)}<div class="switch-travel" style="--travel:${(first?.actuation??1.5)/3.3*100}%"><div class="switch-stem"></div><div class="travel-track"><div id="travel-fill"></div></div><strong id="travel-distance">${(first?.actuation??1.5).toFixed(2)} mm</strong></div><small class="field-help">Default switch type. Existing switch type and precision are preserved. Click Live travel to measure actual key depth.</small></section><section><h3>Quick trigger (RT)</h3>${toggle('pro-rt-enabled','Quick Trigger (RT)','Dynamic actuation and reset for the selected keys.',Boolean(first&&first.mode>0),false)}<label class="field-label" for="pro-mode">Trigger mode</label><select id="pro-mode">${first&&first.mode>2?`<option value="${first.mode}" selected>Unsupported saved mode ${first.mode}</option>`:''}${[[0,'Normal'],[1,'Quick Trigger'],[2,'Quick Trigger + Rapid trigger']].map(([v,name])=>`<option value="${v}" ${(first?.mode??0)===v?'selected':''}>${name}</option>`).join('')}</select>${toggle('pro-continuous','Rapid trigger','Keep resetting dynamically without returning to the actuation point.',first?.mode===2,false)}<label class="toggle-row"><span><strong>Separate press and release settings</strong><small>Use different trigger and reset distances.</small></span><input id="pro-separate" type="checkbox" ${first&&(first.press!==first.release||first.pressStep!==first.releaseStep)?'checked':''}/><span class="switch"></span></label><div class="press-slider">${range('pro-press','Press sensitivity',first?.press??.3,first?.pressStep===.005?.01:.02,first?.pressStep===.005?2.5:3.4,first?.pressStep??.01)}</div><div class="release-slider">${range('pro-release','Release sensitivity',first?.release??.3,first?.releaseStep===.005?.01:.02,first?.releaseStep===.005?2.5:3.4,first?.releaseStep??.01)}</div></section><section><h3>Advanced settings</h3><p>Dead zone and saved precision.</p>${range('pro-top','Top deadzone',first?.pressDeadzone??0,0,1.27,.01)}${range('pro-bottom','Bottom deadzone',first?.releaseDeadzone??0,0,1.27,.01)}<div class="precision-info"><span>Press precision <strong>${first?.pressStep??.01} mm</strong></span><span>Release precision <strong>${first?.releaseStep??.01} mm</strong></span></div><small class="field-help">Values apply to all selected keys. The key tester observes digital presses, not analog depth.</small></section></div><div class="apply-bar"><span>${icon('download')} Only selected keys are changed.</span><button class="primary" type="submit">Apply to selected keys</button></div></fieldset></form></div>`;
}

function proRemapPanel() {
  const data=proData;
  return `<div class="panel"><div class="panel-title">${icon('keyboard')}<h3>Key configuration</h3><span class="mini-tag amber">BASIC KEYS · EXPERIMENTAL</span></div><p>Assign a basic key action in the Windows base/Fn or Mac base/Fn layer. All other bindings are preserved.</p>${proLoadControls()}${data ? `<div class="data-table">${data.keys.map(k=>`<div><strong>${escape(k.name)}</strong><span>${data.mappings[k.slot*3]===16 ? keyCode(data.mappings,k.slot*3)>=0 ? escape(keyName(keyCode(data.mappings,k.slot*3))) : 'Modified key / shortcut' : `Existing action type ${data.mappings[k.slot*3]}`}</span><small>Slot ${k.slot}</small></div>`).join('')}</div><form id="pro-remap-form"><fieldset ${busy?'disabled':''}><div class="travel-fields"><label><span class="field-label">Physical key</span><select id="pro-remap-slot">${data.keys.map(k=>`<option value="${k.slot}">${escape(k.name)}</option>`).join('')}</select></label><label><span class="field-label">New action</span><select id="pro-remap-code">${BASIC_KEYS.map(k=>`<option value="${k.code}">${escape(k.name)}</option>`).join('')}</select></label><button class="primary" type="submit">Apply key binding</button></div></fieldset></form><small class="field-help">Verify by pressing the remapped key in the Key tester. This changes the onboard binding until you remap it back.</small>` : '<div class="connect-hint">Connect the Pro on firmware 1.18 and Load keys to read this layer. Fn remains preserved.</div>'}<div class="feature-note"><p>Mouse/media actions and recorded shortcuts are not enabled here. RS, SOCD, DKS, Hold/Tap and Toggle are in Advanced keys. Existing advanced bindings are preserved.</p></div></div>`;
}
function loadPro() {
  if(busy)return;
    if(demo){proData=keyboardTab==='advanced'&&proData?proData:makeProPreview(proLayer);selectedProKeys.clear();if(keyboardTab==='trigger')proData.keys.filter(k=>[26,4,22,7].includes(k.code)).forEach(k=>selectedProKeys.add(k.slot));const mappings=new Uint8Array(2048);for(let layer=0;layer<4;layer++)mappings.set(proData.physical,layer*512);mappings.set(proData.mappings,proLayer*512);advancedData={keys:proData,mappings,mt:new Uint8Array(256),dks:new Uint8Array(768),tgl:new Uint8Array(128)};notice('Preview keys loaded. No hardware was accessed.');render();return;}
  const client=keyboard,snapshot=keyboardStatus?.lightingSnapshot;if(!client||!snapshot||!keyboardStatus?.canWriteLighting)return;
  void perform(async()=>{proData=null;advancedData=null;selectedProKeys.clear();const data=await client.loadProKeys(snapshot,proLayer);if(keyboardTab==='advanced')advancedData=await client.loadAdvanced(data);proData=data;if(keyboardTab==='trigger')data.keys.filter(k=>[26,4,22,7].includes(k.code)).forEach(k=>selectedProKeys.add(k.slot));notice(`Read ${data.keys.length} physical keys${keyboardTab==='advanced'?' and advanced-action banks':''} without changing the device.`,'success');});
}
function observeBattery(){batteryUpdated=Date.now();chargingEstimate.observe(mouseStatus?.batteryPercent??null,mouseStatus?.batteryState==='Charging');}
function batteryDetail(){
  if(!mouseStatus)return 'Waiting for device';
  const state=mouseStatus.batteryState??'Unknown',minutes=chargingEstimate.minutes();
  if(state==='Charging')return mouseStatus.batteryPercent===100?'Fully charged':minutes!==null?`Charging · ~${minutes} min to full (estimate)`:'Charging · learning charge rate…';
  return `${state} · updates every 15 seconds`;
}
function updateBatteryDisplay(){const value=document.querySelector('#battery-value'),detail=document.querySelector('#battery-detail');if(value)value.textContent=String(mouseStatus?.batteryPercent??'—');if(detail){detail.textContent=batteryDetail();detail.setAttribute('title',batteryUpdated?`Last read ${new Date(batteryUpdated).toLocaleTimeString()}. Charging estimates need at least 3 minutes and a 3% increase; charging can slow near full.`:'');}}
setInterval(()=>{
  const client=mouse;if(!client||demo||busy||telemetry||document.hidden)return;
  telemetry=(async()=>{try{const status=await client.readStatus(true);if(mouse!==client)return;mouseStatus=status;observeBattery();updateBatteryDisplay();}catch{const detail=document.querySelector('#battery-detail');if(detail)detail.textContent='Battery update unavailable · reconnect or Refresh';}finally{telemetry=null;}})();
},15000);

function runMouseChange(action: (client: VxeClient) => Promise<unknown>,label='Apply mouse setting') {
  if (demo) { notice('Preview action completed. No hardware was changed.','success'); render(); return; }
  const client = mouse; if (!client) return;const before=mouseStatus;
  void perform(async () => {
    try { await action(client); mouseStatus = await client.readStatus();recordMouseTest(label,before,mouseStatus,true); notice('Mouse setting applied and read back from the device.','success'); }
    catch (error) { await refresh().catch(() => { mouseStatus = null; });recordMouseTest(label,before,mouseStatus,false); throw error; }
  });
}

function bindExtendedControls() {
  if(liveSession){document.querySelectorAll<HTMLSelectElement>('#pro-layer').forEach(el=>el.disabled=true);document.querySelector<HTMLButtonElement>('#pro-load')!.disabled=true;document.querySelector<HTMLFieldSetElement>('#pro-trigger-form fieldset')!.disabled=true;}
  const num = (id:string) => Number(document.querySelector<HTMLInputElement>(`#${id}`)!.value);
  const readLight=():AceLighting=>({effect:num('light-effect'),color:document.querySelector<HTMLInputElement>('#light-color')!.value,brightness:num('light-brightness'),speed:num('light-speed'),rainbow:document.querySelector<HTMLInputElement>('#light-rainbow')!.checked});
  const previewLight=()=>{lightDraft=readLight();document.querySelector('#rgb-preview')!.innerHTML=rgbBoard(lightDraft);document.querySelector('#light-brightness-value')!.textContent=`${lightDraft.brightness}%`;document.querySelector('#light-speed-value')!.textContent=`${lightDraft.speed} / 4`;};
  document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach(button=>button.onclick=()=>{document.querySelector<HTMLInputElement>('#light-effect')!.value=button.dataset.effect!;document.querySelectorAll<HTMLElement>('[data-effect]').forEach(el=>{const chosen=el===button;el.classList.toggle('active',chosen);el.setAttribute('aria-pressed',String(chosen));});previewLight();});
  for(const id of ['light-color','light-brightness','light-speed','light-rainbow'])document.querySelector('#'+id)?.addEventListener('input',()=>{if(id==='light-color')document.querySelector<HTMLInputElement>('#light-hex')!.value=document.querySelector<HTMLInputElement>('#light-color')!.value.toUpperCase();previewLight();});
  document.querySelector<HTMLInputElement>('#light-hex')?.addEventListener('input',event=>{const value=(event.target as HTMLInputElement).value;if(/^#[0-9a-f]{6}$/i.test(value)){document.querySelector<HTMLInputElement>('#light-color')!.value=value;previewLight();}});
  document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>button.onclick=()=>{document.querySelector<HTMLInputElement>('#light-color')!.value=button.dataset.color!;document.querySelector<HTMLInputElement>('#light-hex')!.value=button.dataset.color!.toUpperCase();previewLight();});
  document.querySelector('#rgb-preview')?.addEventListener('click',event=>{const key=(event.target as HTMLElement).closest('.rgb-key');key?.classList.add('rgb-hit');setTimeout(()=>key?.classList.remove('rgb-hit'),800);});
  document.querySelectorAll<HTMLButtonElement>('[data-advanced-type]').forEach(button=>button.onclick=()=>{if(busy)return;advancedType=button.dataset.advancedType as AdvancedValue['type'];if(!['rs','socd'].includes(advancedType))advancedSlots[1]=null;advancedPick=0;actionPick=advancedType==='tgl'?'advanced-hold':advancedType==='dks'?'advanced-action-0':'advanced-tap';render();});
  document.querySelector('#advanced-cancel')?.addEventListener('click',()=>{if(busy)return;advancedSlots=[null,null];advancedPick=0;actionPick='advanced-tap';notice('Edit cancelled. No device settings were changed.');render();});
  document.querySelector('#advanced-form')?.addEventListener('submit',event=>{
    event.preventDefault();const data=advancedData,client=keyboard;if(!data)return;
    const value:AdvancedValue={type:advancedType,slot:num('advanced-slot')};
    if(advancedType==='tgl')value.hold=num('advanced-hold');
    if(advancedType==='mt')Object.assign(value,{tap:num('advanced-tap'),hold:num('advanced-hold'),delay:num('advanced-delay')});
    if(['rs','socd'].includes(advancedType))value.second=num('advanced-second');
    if(advancedType==='socd')value.priority=Number(document.querySelector<HTMLInputElement>('input[name=socd-priority]:checked')!.value);
    if(advancedType==='dks')value.actions=[0,1,2,3].map(i=>num('advanced-action-'+i));
    try{planAdvanced(data,value);}catch(error){notice(String(error),'error');render();return;}
    if(demo){advancedData=planAdvanced(data,value);advancedData.keys={...advancedData.keys,mappings:advancedData.mappings.slice(proLayer*512,proLayer*512+384),keys:decodeProData(advancedData.keys.travel,advancedData.keys.physical)};proData=advancedData.keys;notice('Preview advanced binding updated. No hardware was changed.','success');render();return;}
    if(!client)return;
    void perform(async()=>{try{advancedData=await client.applyAdvanced(data,value);proData=advancedData.keys;notice('Advanced binding saved and verified by full readback. Test the physical keys to confirm behavior.','success');}catch(error){advancedData=null;proData=null;throw error;}});
  });
  document.querySelectorAll<HTMLButtonElement>('[data-trigger-display]').forEach(button=>button.onclick=()=>{triggerDisplay=button.dataset.triggerDisplay!;render();});
  document.querySelector('#pro-invert')?.addEventListener('click',()=>{proData?.keys.forEach(k=>selectedProKeys.has(k.slot)?selectedProKeys.delete(k.slot):selectedProKeys.add(k.slot));render();});
  for(const id of ['pro-actuation','pro-press','pro-release','pro-top','pro-bottom'])document.querySelector('#'+id)?.addEventListener('input',()=>{document.querySelector('#'+id+'-value')!.textContent=num(id).toFixed(2)+' mm';if(id==='pro-actuation'){(document.querySelector('.switch-travel') as HTMLElement)?.style.setProperty('--travel',num(id)/3.3*100+'%');document.querySelector('#travel-distance')!.textContent=num(id).toFixed(2)+' mm';}});
  const syncMode=()=>{const enabled=document.querySelector<HTMLInputElement>('#pro-rt-enabled')!.checked,continuous=document.querySelector<HTMLInputElement>('#pro-continuous')!.checked;document.querySelector<HTMLSelectElement>('#pro-mode')!.value=String(enabled?continuous?2:1:0);if(!enabled)document.querySelector<HTMLInputElement>('#pro-continuous')!.checked=false;};
  for(const id of ['pro-rt-enabled','pro-continuous'])document.querySelector('#'+id)?.addEventListener('change',syncMode);
  document.querySelector<HTMLSelectElement>('#pro-mode')?.addEventListener('change',event=>{const mode=Number((event.target as HTMLSelectElement).value);document.querySelector<HTMLInputElement>('#pro-rt-enabled')!.checked=mode>0;document.querySelector<HTMLInputElement>('#pro-continuous')!.checked=mode===2;});
  document.querySelector('#pro-separate')?.addEventListener('change',()=>{if(!document.querySelector<HTMLInputElement>('#pro-separate')!.checked){const key=proData?.keys.find(k=>selectedProKeys.has(k.slot));if(key&&key.pressStep!==key.releaseStep){document.querySelector<HTMLInputElement>('#pro-separate')!.checked=true;return;}document.querySelector<HTMLInputElement>('#pro-release')!.value=String(num('pro-press'));document.querySelector('#pro-release-value')!.textContent=num('pro-press').toFixed(2)+' mm';}});
  document.querySelector('#pro-press')?.addEventListener('input',()=>{const separate=document.querySelector<HTMLInputElement>('#pro-separate')!;if(!separate.checked){document.querySelector<HTMLInputElement>('#pro-release')!.value=String(num('pro-press'));document.querySelector('#pro-release-value')!.textContent=num('pro-press').toFixed(2)+' mm';}});
  document.querySelector('#pro-release')?.addEventListener('input',()=>{document.querySelector<HTMLInputElement>('#pro-separate')!.checked=num('pro-press')!==num('pro-release');});
  document.querySelector('#live-start')?.addEventListener('click',()=>startTravel(false));
  document.querySelector('#calibration-start')?.addEventListener('click',()=>startTravel(true));
  document.querySelector('#live-stop')?.addEventListener('click',()=>void perform(async()=>{await stopTravel();await refresh();notice('Travel session ended. Saved settings reloaded.');}));
  const markBindings=()=>{const submit=document.querySelector<HTMLButtonElement>('#advanced-submit');if(submit)submit.disabled=advancedSlots[0]==null||(['rs','socd'].includes(advancedType)&&advancedSlots[1]==null);document.querySelectorAll<HTMLElement>('[data-advanced-key]').forEach(el=>{const selected=advancedSlots.includes(Number(el.dataset.advancedKey));el.classList.toggle('tested',selected);el.setAttribute('aria-pressed',String(selected));});};
  document.querySelectorAll<HTMLButtonElement>('[data-binding-target]').forEach(button=>button.onclick=()=>{advancedPick=Number(button.dataset.bindingTarget);document.querySelectorAll<HTMLElement>('[data-binding-target]').forEach(el=>el.classList.toggle('active',el===button));});
  document.querySelectorAll<HTMLButtonElement>('[data-advanced-key]').forEach(button=>button.onclick=()=>{if(busy||!advancedData)return;const slot=Number(button.dataset.advancedKey);advancedSlots[advancedPick]=slot;document.querySelector<HTMLSelectElement>(advancedPick?'#advanced-second':'#advanced-slot')!.value=String(slot);markBindings();if(['rs','socd'].includes(advancedType)){advancedPick=1-advancedPick;document.querySelectorAll<HTMLElement>('[data-binding-target]').forEach(el=>el.classList.toggle('active',Number(el.dataset.bindingTarget)===advancedPick));}});
  for(const [id,index] of [['advanced-slot',0],['advanced-second',1]] as const)document.querySelector<HTMLSelectElement>('#'+id)?.addEventListener('change',event=>{advancedSlots[index]=Number((event.target as HTMLSelectElement).value);markBindings();});
  document.querySelectorAll<HTMLButtonElement>('[data-action-target]').forEach(button=>button.onclick=()=>{actionPick=button.dataset.actionTarget!;document.querySelectorAll<HTMLElement>('[data-action-target]').forEach(el=>el.classList.toggle('active',el===button));});
  document.querySelectorAll<HTMLButtonElement>('[data-action-code]').forEach(button=>button.onclick=()=>{const select=document.querySelector<HTMLSelectElement>('#'+actionPick);if(!select)return;select.value=button.dataset.actionCode!;document.querySelector('#'+actionPick+'-name')!.textContent=keyName(Number(select.value));});
  document.querySelector('#action-search')?.addEventListener('input',event=>{const term=(event.target as HTMLInputElement).value.toLowerCase();document.querySelectorAll<HTMLButtonElement>('[data-action-code]').forEach(button=>button.hidden=!button.textContent!.toLowerCase().includes(term));});
  document.querySelector('#advanced-delay')?.addEventListener('input',()=>document.querySelector('#advanced-delay-value')!.textContent=num('advanced-delay')+' ms');
  document.querySelector<HTMLInputElement>('#sc620-edits')?.addEventListener('change',event=>{if(!(mouse instanceof Sc620Client)||busy)return;sc620Edits=(event.target as HTMLInputElement).checked;mouse.enableExperimentalWrites(sc620Edits);render();});
  document.querySelector('#x11-cancel')?.addEventListener('click',()=>render());
  document.querySelector('#x11-lighting')?.addEventListener('submit',event=>{event.preventDefault();const values=[num('x11-mode'),num('x11-speed'),num('x11-brightness'),document.querySelector<HTMLInputElement>('#x11-color')!.value,num('x11-deep')] as const;runMouseChange(async client=>{if(client instanceof X11Client)await client.setLighting(...values);},'X11 lighting & sleep');});
  document.querySelector('#sc620-form')?.addEventListener('submit',event=>{event.preventDefault();const effect=document.querySelector<HTMLInputElement>('input[name="sc620-effect"]:checked')?.value,scroll=document.querySelector<HTMLSelectElement>('#sc620-scroll')!.value as 'Forward'|'Reverse';runMouseChange(async client=>{if(!(client instanceof Sc620Client)||!effect)return;await client.setSc620Lighting(effect);if(mouseStatus?.scrollDirection!=null&&mouseStatus.scrollDirection!==scroll)await client.setScrollDirection(scroll);},'Lighting effect / wheel direction');});
  document.querySelector('#mouse-extra-form')?.addEventListener('submit',event => {
    event.preventDefault();
    const s = mouseStatus;
    const sleep = num('mouse-sleep'), lod = document.querySelector<HTMLSelectElement>('#mouse-lod')!.value as NonNullable<MouseStatus['liftOffDistance']>;
    const performance = document.querySelector<HTMLInputElement>('#mouse-performance')!.checked, range = document.querySelector<HTMLInputElement>('#mouse-range')!.checked;
    const lighting = [num('mouse-led-mode'),num('mouse-led-brightness'),num('mouse-led-speed')];
    runMouseChange(async client => {
      if (s?.sleepTimeout != null && sleep !== s.sleepTimeout) await client.setSleepTimeout(sleep);
      if (s?.liftOffDistance != null && lod !== s.liftOffDistance) await client.setLiftOffDistance(lod);
      if (s?.performanceMode != null && performance !== s.performanceMode) await client.setPerformanceMode(performance);
      if (s?.longRangeMode != null && range !== s.longRangeMode) await client.setLongRangeMode(range);
      if (s?.ui?.dpiLighting && (lighting[0] !== s.dpiLedMode || lighting[1] !== s.dpiLedBrightness || lighting[2] !== s.dpiLedSpeed)) await client.setDpiLighting(lighting[0],lighting[1],lighting[2]);
    },'Power / sleep / LOD / performance');
  });
  document.querySelector('#dpi-count-form')?.addEventListener('submit',event => { event.preventDefault(); const count=num('dpi-count'); runMouseChange(client => client.setDpiStageCount(count)); });
  document.querySelectorAll<HTMLFormElement>('[data-stage]').forEach(form => form.addEventListener('submit',event => { event.preventDefault(); const stage=Number(form.dataset.stage),dpi=Number(form.querySelector<HTMLInputElement>('.stage-dpi')!.value),color=form.querySelector<HTMLInputElement>('.stage-color')?.value; runMouseChange(async client => { await client.setDpiStageValue(stage,dpi); if (color && mouseStatus?.dpiStageColors) await client.setDpiStageColor(stage,color); },'DPI stage '+(stage+1)+' → '+dpi); }));
  document.querySelectorAll<HTMLButtonElement>('[data-activate-stage]').forEach(button => button.onclick=()=> { const stage=Number(button.dataset.activateStage); runMouseChange(client=>client.setActiveDpiStage(stage)); });
  document.querySelector('#dpi-axis-form')?.addEventListener('submit',event => { event.preventDefault(); const x=num('dpi-x'),y=num('dpi-y'); runMouseChange(client=>client.setDpi(x,y)); });
  document.querySelector('#mouse-profile-form')?.addEventListener('submit',event => { event.preventDefault(); const profile=num('mouse-profile'); runMouseChange(client=>client.setR1ActiveProfile(profile)); });
  document.querySelector('#shark-button-form')?.addEventListener('submit',event=>{event.preventDefault();const button=document.querySelector<HTMLSelectElement>('#shark-button')!.value,action=document.querySelector<HTMLSelectElement>('#shark-action')!.value;runMouseChange(async client=>{if(!('setButtonMapping' in client))throw new Error('Button remapping is unavailable on this driver.');await client.setButtonMapping(button,action);},'Button '+button+' → '+action);});
  document.querySelector('#mouse-export')?.addEventListener('click',()=>{ if(mouseStatus)download(`vxe-settings-${Date.now()}.json`,JSON.stringify({format:'amouse-mouse-status-v1',savedAt:new Date().toISOString(),status:mouseStatus},null,2)); });
  document.querySelector('#keyboard-profile-export')?.addEventListener('click',exportKeyboardProfile);
  document.querySelector<HTMLSelectElement>('#pro-layer')?.addEventListener('change',event=>{if(busy)return;proLayer=Number((event.target as HTMLSelectElement).value);proData=null;advancedData=null;selectedProKeys.clear();render();loadPro();});
  document.querySelector('#pro-load')?.addEventListener('click',loadPro);
  document.querySelectorAll<HTMLInputElement>('[data-pro-key]').forEach(input=>input.onchange=()=>{if(busy)return;const slot=Number(input.dataset.proKey);input.checked?selectedProKeys.add(slot):selectedProKeys.delete(slot);render();});
  document.querySelectorAll<HTMLButtonElement>('[data-pro-select]').forEach(button=>button.onclick=()=>{if(busy)return;const slot=Number(button.dataset.proSelect);selectedProKeys.has(slot)?selectedProKeys.delete(slot):selectedProKeys.add(slot);render();});
  document.querySelector('#pro-wasd')?.addEventListener('click',()=>{selectedProKeys.clear();proData?.keys.filter(k=>[26,4,22,7].includes(k.code)).forEach(k=>selectedProKeys.add(k.slot));render();});
  document.querySelector('#pro-all')?.addEventListener('click',()=>{proData?.keys.forEach(k=>selectedProKeys.add(k.slot));render();});
  document.querySelector('#pro-clear')?.addEventListener('click',()=>{selectedProKeys.clear();render();});
  document.querySelector('#pro-trigger-form')?.addEventListener('submit',event=>{
    event.preventDefault();const client=keyboard,data=proData,slots=Array.from(selectedProKeys);if(!data||!slots.length)return;
    const values:ProTriggerValues={actuation:num('pro-actuation'),press:num('pro-press'),release:num('pro-release'),mode:num('pro-mode'),pressDeadzone:num('pro-top'),releaseDeadzone:num('pro-bottom')};
    if(demo){try{const travel=updateProTrigger(data,slots,values);proData={...data,travel,keys:decodeProData(travel,data.physical)};advancedData=null;notice('Preview trigger values updated. No hardware was changed.','success');}catch(error){notice(String(error),'error');}render();return;}
    if(!client)return;
    void perform(async()=>{try{proData=await client.applyProTrigger(data,slots,values);advancedData=null;notice('Selected trigger settings saved and verified by full readback.','success');}catch(error){proData=null;selectedProKeys.clear();throw error;}});
  });
  document.querySelector('#pro-remap-form')?.addEventListener('submit',event=>{
    event.preventDefault();const client=keyboard,data=proData,slot=num('pro-remap-slot'),code=num('pro-remap-code');if(!data)return;
    if(demo){proData={...data,mappings:updateProMapping(data,slot,code)};advancedData=null;notice('Preview key binding updated. No hardware was changed.','success');render();return;}if(!client)return;
    void perform(async()=>{try{proData=await client.applyProMapping(data,slot,code);advancedData=null;notice('Key binding saved and verified by full readback. Test the physical key to confirm its action.','success');}catch(error){proData=null;throw error;}});
  });
  document.querySelector('#pro-performance-form')?.addEventListener('submit',event=>{
    event.preventDefault();const checked=(id:string)=>document.querySelector<HTMLInputElement>('#'+id)!.checked;
    const value:ProPerformance={winLock:checked('pro-win-lock'),macMode:checked('pro-mac'),debounce:checked('pro-debounce'),stability:checked('pro-stability'),autoCalibration:checked('pro-calibration'),pollingCode:num('pro-polling')};
    if(demo){demoWinLock=value.winLock&&!value.macMode;demoPerformance={...value,winLock:demoWinLock};notice('Preview performance updated. No hardware was changed.','success');render();return;}
    const client=keyboard,snapshot=keyboardStatus?.lightingSnapshot;if(!client||!snapshot)return;
    exportKeyboardProfile();void perform(async()=>{try{const settings=await client.applyProPerformance(snapshot,value);keyboardStatus={...keyboardStatus!,lightingSnapshot:{...snapshot,settings}};proData=null;selectedProKeys.clear();notice('Keyboard performance saved and verified by full readback.','success');}catch(error){proData=null;await refresh().catch(()=>{keyboardStatus=null;});throw new Error(String(error)+' If USB restarted, reconnect and Refresh to confirm the saved values.');}});
  });
}

function bind() {
 document.querySelector('#automatic-reports')?.addEventListener('click',()=>void openDeviceReports());
 document.querySelector('#x68-open')?.addEventListener('click',openX68);
  if(view==='mouse'&&!home&&mouse instanceof Sc620Client&&!sc620Edits)document.querySelectorAll<HTMLFieldSetElement>('form fieldset').forEach(field=>{field.disabled=true;});
  document.querySelector('#sc620-report-start')?.addEventListener('click',()=>{document.querySelector<HTMLDialogElement>('#add-dialog')!.close();void openMouseReport(mouseStatus?.brand==='AULA'?mouseStatus:null);});
  document.querySelector('#sc620-report')?.addEventListener('click',()=>void openMouseReport(mouseStatus));
  document.querySelector('#mouse-delay')?.addEventListener('click',()=>{
    const client=mouse,s=mouseStatus;if(!client||!s||busy)return;
    void openDelayTool(s,client.getDebounceOptions(),async(changes:DelayChange[])=>{
      if(busy||mouse!==client)throw new Error('Wait for the current operation or reconnect.');
      busy=true;render();const before=mouseStatus;
      try{await telemetry;let current=await client.readStatus();
        for(const change of changes){const actual=current[change.key];if(actual===change.after)continue;if(actual!==change.before)throw new Error('Settings changed since preview. Reopen the delay tool.');
          if(change.key==='pollingRateHz')await client.setPollingRate(Number(change.after));
          else if(change.key==='debounceMs')await client.setDebounceTime(Number(change.after));
          else await client.setMotionSync(Boolean(change.after));
          current=await client.readStatus();if(current[change.key]!==change.after||change.key==='pollingRateHz'&&(current as MouseStatus).pollingReadVerified===false)throw new Error('Readback did not confirm '+change.label);
        }mouseStatus=current;recordMouseTest('Delay preset / restore',before,current,true);
      }catch(error){await refresh().catch(()=>{});recordMouseTest('Delay preset / restore',before,mouseStatus,false);throw error;}
      finally{busy=false;render();}
    });
  });
  bindDeviceScanner();
  bindSuggestions();
  document.querySelector('#desktop-source')?.addEventListener('click',()=>desktop?.source());
  updateButton();
  document.querySelector('#desktop-update')?.addEventListener('click',()=>{if(busy||liveSession||calibrationSession)return;if(updateState.phase==='ready')desktop?.restartUpdate();else desktop?.checkUpdates();});
  document.querySelector('#theme-toggle')?.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';localStorage.setItem('amouse-theme',theme);document.documentElement.dataset.theme=theme;const button=document.querySelector('#theme-toggle')!;button.innerHTML=(theme==='dark'?'☀':'☾')+'<span>'+(theme==='dark'?'Light':'Dark')+' mode</span>';button.setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' mode');});
  document.querySelector('#home')?.addEventListener('click',()=>{if(busy)return;void perform(async()=>{home=true;tester=false;});});
  document.querySelectorAll('[data-open-add]').forEach(button=>button.addEventListener('click',()=>{if(!busy)document.querySelector<HTMLDialogElement>('#add-dialog')!.showModal();}));
  document.querySelector('#add-close')?.addEventListener('click',()=>document.querySelector<HTMLDialogElement>('#add-dialog')!.close());
  document.querySelector('#x11-details')?.addEventListener('click',()=>{document.querySelector<HTMLDialogElement>('#add-dialog')?.close();void openX11Details();});
  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button=>button.onclick=()=>{if(busy)return;if(button.dataset.add==='x68'){document.querySelector<HTMLDialogElement>('#add-dialog')!.close();void perform(async()=>{await addX68();});return;}if(button.dataset.add==='x11'){document.querySelector<HTMLDialogElement>('#add-dialog')!.close();void connectX11();return;}const sc620=button.dataset.add==='aula-sc620';view=sc620?'mouse':button.dataset.add as typeof view;document.querySelector<HTMLDialogElement>('#add-dialog')!.close();if(demo){home=false;render();return;}if(!sc620&&(view==='mouse'?mouse:keyboard)){home=false;render();return;}void connect(sc620?'aula-sc620':undefined);});
  document.querySelector('#explore-preview')?.addEventListener('click',()=>{if(mouse||keyboard){notice('Open a connected device below to explore its settings.');render();return;}demo=true;home=true;notice('Welcome to the preview. Sample settings only.');render();});
  const mouseArea=document.querySelector<HTMLElement>('#mouse-live');
  const feedback=(button:number)=>{const names=['Left click','Middle click','Right click','Back button','Forward button'];document.querySelector('#mouse-feedback')!.textContent=names[button]??'Mouse button '+button;const spot=mouseArea?.querySelector<HTMLElement>('[data-mouse-button="'+button+'"]');spot?.classList.add('clicked');setTimeout(()=>spot?.classList.remove('clicked'),240);};
  mouseArea?.addEventListener('pointerdown',event=>{if(event.button>=3)event.preventDefault();feedback(event.button);});
  mouseArea?.addEventListener('auxclick',event=>event.preventDefault());
  mouseArea?.addEventListener('contextmenu',event=>event.preventDefault());
  mouseArea?.addEventListener('wheel',event=>{event.preventDefault();document.querySelector('#mouse-feedback')!.textContent=event.deltaY>0?'Scrolling down':'Scrolling up';mouseArea.querySelector('[data-mouse-button="1"]')?.classList.add('clicked');setTimeout(()=>mouseArea.querySelector('[data-mouse-button="1"]')?.classList.remove('clicked'),240);},{passive:false});
  document.querySelectorAll<HTMLButtonElement>('[data-mouse-button]').forEach(button=>button.onclick=()=>feedback(Number(button.dataset.mouseButton)));

  document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(el => el.onclick = () => { if (busy) return; if(liveSession){void perform(async()=>{await stopTravel();keyboardTab=el.dataset.section!;});return;} if (view === 'mouse') mouseTab = el.dataset.section!; else keyboardTab = el.dataset.section!; tester = false; pressed.clear(); render(); if(view==='keyboard'&&['trigger','keys','advanced'].includes(keyboardTab)&&(!proData||(keyboardTab==='advanced'&&!advancedData)))loadPro(); });
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(el => el.onclick = () => { if (busy) return; if(liveSession){void perform(async()=>{await stopTravel();view=el.dataset.view as typeof view;home=false;});return;} view = el.dataset.view as typeof view;x68Active=view==='keyboard'&&x68Connected()&&!keyboard;home=false; tester = false; pressed.clear(); render(); });
  document.querySelector<HTMLInputElement>('#demo')!.onchange = async event => {
    const enabled = (event.target as HTMLInputElement).checked;
    if (mouse || keyboard) { notice('Disconnect your hardware before entering preview mode.'); render(); return; }
    await stopTravel();demo = enabled;mouseDraft=null;mouseApplyResult=null; proData = null;lightDraft=null;advancedData=null;selectedProKeys.clear(); notice(demo ? 'Preview mode is active. Hardware will not be changed.' : 'Connect a device to read its current settings.'); render();
  };
  document.querySelector('#connect')?.addEventListener('click',()=>void connect());
  document.querySelector('#refresh')?.addEventListener('click', () => perform(async () => { await refresh(); notice('Current device settings refreshed.', 'success'); }));
  document.querySelector('#disconnect')?.addEventListener('click', () => perform(async () => { if (view === 'mouse') { await mouse?.close(); mouse = null; mouseStatus = null; mouseDraft=null;mouseApplyResult=null; } else { await keyboard?.close(); keyboard = null; keyboardStatus = null; proData = null; selectedProKeys.clear(); } notice('Device disconnected.'); }));
  for (const id of ['about', 'source']) document.querySelector(`#${id}`)!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#about-dialog')!.showModal());
  document.querySelector('.close-dialog')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#about-dialog')!.close());
  document.querySelector('#diagnostics')!.addEventListener('click', () => download('amouse-connection.json', JSON.stringify({ version: '0.1.0', browser: navigator.userAgent, webHid: supported(), mouse: mouse ? { vendor: hex(mouse.device.vendorId), product: hex(mouse.device.productId), name: mouseStatus?.name } : null, keyboard: keyboard ? { vendor: hex(keyboard.device.vendorId), product: hex(keyboard.device.productId), firmware: keyboardStatus?.firmware } : null }, null, 2)));
  if(home)return;
  if (view === 'mouse') {
    document.querySelectorAll<HTMLButtonElement>('[data-dpi]').forEach(el => el.onclick = () => { document.querySelector<HTMLSelectElement>('#dpi')!.value = el.dataset.dpi!; document.querySelectorAll('.preset').forEach(p => p.classList.remove('chosen')); el.classList.add('chosen'); mouseDraft=readMouseDraft();mouseApplyResult=null;render(); });
    document.querySelector('#mouse-form')?.addEventListener('change',()=>{mouseDraft=readMouseDraft();mouseApplyResult=null;render();});
    document.querySelector('#discard-mouse-draft')?.addEventListener('click',()=>{mouseDraft=null;mouseApplyResult=null;render();});
    document.querySelector('#mouse-form')?.addEventListener('submit', event => { event.preventDefault(); applyMouse(); });
  } else {
    document.querySelector('#test-toggle')?.addEventListener('click', () => { tester = !tester; pressed.clear(); render(); });
    document.querySelector('#clear-test')?.addEventListener('click', () => { pressed.clear(); tested.clear(); lastKey = '—'; render(); });
    document.querySelector('#backup')?.addEventListener('click', backup);
    document.querySelector('#keyboard-form')?.addEventListener('submit', event => { event.preventDefault(); applyKeyboard(); });
    document.querySelector('#lighting-form')?.addEventListener('submit', event => { event.preventDefault(); applyLighting(); });
  }
  bindExtendedControls();
}

function paintTravel(slot:number,mm:number,status:number) {
  liveValues.set(slot,{mm,calibration:status});
  const key=proData?.keys.find(k=>k.slot===slot);
  const node=document.querySelector<HTMLElement>('[data-live-slot="'+slot+'"]');
  if(node){node.style.setProperty('--depth',Math.min(100,mm/3.3*100)+'%');node.classList.toggle('calibrated',calibrationSession&&status===255);node.classList.toggle('travel-down',mm>.1);node.title=(key?.name??'Key')+' · '+mm.toFixed(2)+' mm';}
  const label=document.querySelector('#live-key'),value=document.querySelector('#live-mm'),fill=document.querySelector<HTMLElement>('#live-fill');
  if(label)label.textContent=key?.name??'Measured travel';if(value)value.textContent=mm.toFixed(2)+' mm';if(fill)fill.style.height=Math.min(100,mm/3.3*100)+'%';
  const note=document.querySelector('#live-label');if(note)note.textContent=calibrationSession?'Calibration active · '+Array.from(liveValues.values()).filter(v=>v.calibration===255).length+' keys confirmed':'Receiving measured key travel';
}
async function stopTravel() {
  if(!demo&&keyboard)await keyboard.stopLiveTravel();
  liveSession=false;calibrationSession=false;liveValues.clear();
}
function startTravel(calibrating:boolean) {
  const data=proData,client=keyboard;if(!data||busy)return;
  void perform(async()=>{
    if(!demo&&!client)return;
    liveValues.clear();calibrationSession=calibrating;
    if(!demo){await client!.startLiveTravel(data,value=>paintTravel(value.slot,value.mm,value.calibration),calibrating);}
    liveSession=true;notice(demo?'Preview session: hardware travel and calibration are unavailable.':calibrating?'Calibration started. Keep the keyboard still and press keys fully.':'Live travel enabled. Press keys to measure their depth.');
  });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&liveSession)void perform(async()=>{await stopTravel();notice('Travel session stopped while the page was hidden.');});});
window.addEventListener('pagehide',()=>{void keyboard?.stopLiveTravel().catch(()=>{});});

async function perform(action: () => Promise<void>) {
  if (busy) return;
  busy = true; render();
  try { await telemetry; if(liveSession)await stopTravel(); await action(); }
  catch (error) { notice(error instanceof Error ? error.message : String(error), 'error'); }
  finally { busy = false; render(); }
}
async function connect(model?:'aula-sc620') {
  if (demo || !supported() || busy) return;
  // The picker must be invoked before any await, directly from a user gesture.
  const request = navigator.hid.requestDevice({ filters: view === 'mouse' ? (model==='aula-sc620'?SC620_FILTERS:MOUSE_FILTERS) : [{ vendorId: ACE_VENDOR, productId: 0x2101 }, { vendorId: ACE_VENDOR, productId: 0x2103 }] });
  await perform(async () => {
    const candidates = await request;
    if (!candidates.length) { notice('No device selected.'); return; }
    let lastError: unknown;
    for (const device of candidates) {
      try {
        if (view === 'mouse') {
          const result = await connectMouse(device,model);
          await mouse?.close(); sc620Edits=false;mouseDraft=null;mouseApplyResult=null;mouse = result.client; mouseStatus = result.status; chargingEstimate.samples=[];observeBattery();recordMouseTest('Connect / read profile',null,mouseStatus,true);await smokeDevice('mouse',device,mouseStatus,()=>result.client.readStatus());
        } else {
          const result = await AceClient.connect(device);
          await keyboard?.close(); keyboard = result.client; keyboardStatus = result.status; await smokeDevice('keyboard',device,keyboardStatus,()=>result.client.readStatus());
        }
        home=true;notice(`${view === 'mouse' ? mouseStatus?.name : keyboardStatus?.name} connected. Settings were read without changing the device.`, 'success'); return;
      } catch (error) { lastError = error;await failedConnection(view,device);if(model==='aula-sc620'){mouseReport.record('SC620 connection / settings read',null,null,false);persistReport();} }
    }
    throw lastError ?? new Error('No compatible configuration interface was found.');
  });
}
async function refresh() {
  if (view === 'mouse' && mouse) { mouseStatus = await mouse.readStatus();observeBattery(); }
  if (view === 'keyboard' && keyboard) { keyboardStatus = await keyboard.readStatus(); proData = null; advancedData=null;lightDraft=null;selectedProKeys.clear(); }
}
function applyMouse() {
  const next = readMouseDraft();
  mouseDraft=next;mouseApplyResult={text:'Applying your selection and checking the device…',kind:'info'};
  if (demo) { demoMouse = next; mouseDraft=null;mouseApplyResult=null;notice('Preview mouse settings updated. No hardware was changed.', 'success'); render(); return; }
  if (!mouse || !mouseStatus) return;
  const client = mouse;
  const before = mouseStatus;
  void perform(async () => {
    try {
      if (next.dpi !== before.dpi) await client.setDpi(next.dpi);
      if (next.pollingRateHz>0&&(before.pollingReadVerified===false || next.pollingRateHz !== before.pollingRateHz)) await client.setPollingRate(next.pollingRateHz);
      if (before.debounceMs!=null && next.debounceMs !== before.debounceMs) await client.setDebounceTime(next.debounceMs);
      if (before.motionSync != null && next.motionSync !== before.motionSync) await client.setMotionSync(next.motionSync);
      if (before.angleSnapping != null && next.angleSnapping !== before.angleSnapping) await client.setAngleSnapping(next.angleSnapping);
      if (before.rippleControl != null && next.rippleControl !== before.rippleControl) await client.setRippleControl(next.rippleControl);
      mouseStatus = await client.readStatus();
      const failed = Object.entries(next).filter(([key, value]) => !(key==='pollingRateHz'&&next.pollingRateHz===0) && (before as unknown as Record<string, unknown>)[key] != null && (mouseStatus as unknown as Record<string, unknown>)[key] !== value);
      if (failed.length) throw new Error(`Readback did not confirm: ${failed.map(([key]) => key).join(', ')}.`);
      if(next.pollingRateHz>0&&mouseStatus.pollingReadVerified===false)throw new Error('Polling rate is unconfirmed; no 1,000 Hz default is substituted.');
      recordMouseTest('Performance: DPI '+next.dpi+', polling '+next.pollingRateHz+' Hz, debounce '+next.debounceMs+' ms',before,mouseStatus,true);
      mouseDraft=null;mouseApplyResult={text:'Saved. The device confirmed your settings.',kind:'success'};
      notice('Mouse settings applied and read back from the device.', 'success');
    } catch (error) {
      await refresh().catch(() => { mouseStatus = null; });
      recordMouseTest('Performance: DPI '+next.dpi+', polling '+next.pollingRateHz+' Hz, debounce '+next.debounceMs+' ms',before,mouseStatus,false);
      const text=`${error instanceof Error ? error.message : error} Your selection is kept in the controls. Some changes may have applied; the summary shows refreshed device values.`;
      mouseApplyResult={text,kind:'error'};throw new Error(text);
    }
  });
}
function backup() {
  if (keyboardStatus?.raw && keyboard) download(`ace60-backup-${Date.now()}.json`, JSON.stringify({ format: 'amouse-ace60-travel-v1', vendorId: keyboard.device.vendorId, productId: keyboard.device.productId, firmware: keyboardStatus.firmware, savedAt: new Date().toISOString(), travelBytes: Array.from(keyboardStatus.raw) }, null, 2));
}
function applyLighting() {
  const value: AceLighting = { effect: Number(document.querySelector<HTMLSelectElement>('#light-effect')!.value), color: document.querySelector<HTMLInputElement>('#light-color')!.value, rainbow: document.querySelector<HTMLInputElement>('#light-rainbow')!.checked, brightness: Number(document.querySelector<HTMLSelectElement>('#light-brightness')!.value), speed: Number(document.querySelector<HTMLSelectElement>('#light-speed')!.value) };
  if (demo) { demoLighting = { ...value, rainbow: value.rainbow || value.effect === 1 };lightDraft=null;notice('Preview lighting updated. No hardware was changed.', 'success'); render(); return; }
  const client = keyboard, snapshot = keyboardStatus?.lightingSnapshot;
  if (!client || !snapshot || !keyboardStatus?.canWriteLighting) return;
  void perform(async () => {
    try {
      const settings = await client.applyLighting(snapshot, value);
      proData = null; selectedProKeys.clear();
      keyboardStatus = { ...keyboardStatus!, lighting: decodeLighting(settings, snapshot.profile), lightingSnapshot: { ...snapshot, settings } };
      lightDraft=null;advancedData=null;
      notice('Lighting saved and verified by device readback. Check your keyboard LEDs to confirm the visible effect.', 'success');
    } catch (error) { await refresh().catch(() => { keyboardStatus = null; }); throw error; }
  });
}
function applyKeyboard() {
  const read = (id: string) => Number(document.querySelector<HTMLInputElement>(`#${id}`)!.value);
  const values = { actuation: read('actuation'), press: read('press'), release: read('release') };
  if (demo) { demoTravel = values; notice('Preview distances updated. No hardware was changed.', 'success'); render(); return; }
  if (!keyboardStatus?.canWrite || !keyboardStatus.raw || !keyboard || !document.querySelector<HTMLInputElement>('#experimental')!.checked) return;
  const client = keyboard, snapshot = keyboardStatus.raw;
  const selection = document.querySelector<HTMLSelectElement>('#key-slot')!.value;
  const slots = selection === 'all' ? keyboardStatus.keys.map(k => k.slot) : [Number(selection)];
  void perform(async () => {
    try {
      const raw = await client.applyTravel(snapshot, slots, values);
      keyboardStatus = { ...keyboardStatus!, raw, keys: decodeTravel(raw) };
      notice('Keyboard distances applied and verified by reading them back.', 'success');
    } catch (error) {
      await refresh().catch(() => { keyboardStatus = null; });
      throw error;
    }
  });
}

function updateTester() {
  document.querySelectorAll<HTMLElement>('[data-code]').forEach(el => { el.classList.toggle('pressed', pressed.has(el.dataset.code!)); el.classList.toggle('tested', tested.has(el.dataset.code!)); });
  const last = document.querySelector('#last-key'), count = document.querySelector('#key-count');
  if (last) last.textContent = lastKey;
  if (count) count.textContent = String(tested.size);
}
window.addEventListener('keydown', event => {
  if(view==='keyboard'&&keyboardTab==='advanced')document.querySelectorAll<HTMLElement>('[data-browser-code]').forEach(el=>{if(el.dataset.browserCode===event.code)el.classList.add('key-down');});
  if (!tester || view !== 'keyboard' || document.querySelector('dialog[open]') || (event.target as HTMLElement).matches('input,select,textarea')) return;
  if (event.code === 'Escape') { tester = false; pressed.clear(); render(); return; }
  event.preventDefault(); pressed.add(event.code); tested.add(event.code); lastKey = event.code; updateTester();
});
window.addEventListener('keyup', event => { document.querySelectorAll<HTMLElement>('[data-browser-code]').forEach(el=>{if(el.dataset.browserCode===event.code)el.classList.remove('key-down');}); pressed.delete(event.code); updateTester(); });
window.addEventListener('blur', () => { document.querySelectorAll('.key-down').forEach(el=>el.classList.remove('key-down'));pressed.clear(); updateTester(); });
if ('hid' in navigator) navigator.hid.addEventListener('disconnect', event => {
  if (mouse?.device === event.device) { mouse = null; mouseStatus = null; mouseDraft=null;mouseApplyResult=null; notice('Mouse unplugged. Connect it again to continue.'); }
  if (keyboard?.device === event.device) { void keyboard.close().catch(() => {}); keyboard = null; keyboardStatus = null;liveSession=false;calibrationSession=false;liveValues.clear();proData=null; notice('Keyboard unplugged. Connect it again to continue.'); }
  render();
});
render();

// Progressive enhancement: inspect the same visible state without device access.
interface PageTool { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute(input: unknown): unknown }
const context = (document as Document & { modelContext?: { registerTool(tool: PageTool, options: { signal: AbortSignal }): void | Promise<void> } }).modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const tools: PageTool[] = [{
    name: 'read_device_studio_status',
    description: 'Read displayed connection and compatibility status. Does not connect, read USB, or change hardware.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Use an empty object.');
      return { view, preview: demo, mouse: mouseStatus?.name ?? null, keyboard: keyboardStatus?.name ?? null, keyboardAccess: keyboardStatus ? keyboardStatus.canWriteLighting ? 'experimental Pro controls' : keyboardStatus.canWrite ? 'experimental travel controls' : 'read-only' : 'disconnected', message };
    },
  }, {
    name: 'open_device_settings',
    description: 'Navigate to the mouse or keyboard workspace. Does not connect or apply settings.',
    inputSchema: { type: 'object', properties: { device: { type: 'string', enum: ['mouse', 'keyboard'] } }, required: ['device'], additionalProperties: false },
    annotations: { readOnlyHint: false },
    execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => k !== 'device')) throw new Error('Provide a device only.');
      const device = (input as { device?: unknown }).device;
      if (device !== 'mouse' && device !== 'keyboard') throw new Error('Choose mouse or keyboard.');
      if (busy) throw new Error('Wait for the current device operation.');
      if (liveSession) throw new Error('Exit live travel or calibration before navigating.');
      view = device;home=false; tester = false; pressed.clear(); render(); return { view };
    },
  }];
  for (const tool of tools) {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Unsupported experimental API does not affect controls. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}


import './studio-theme.css';

desktop?.onClose(async reason=>{if(reason==='update'&&(busy||liveSession||calibrationSession))throw new Error('A device session is still active.');await telemetry;await closeX68();await stopTravel();await keyboard?.close();await mouse?.close();});
if(desktop){desktop.onUpdate(state=>{updateState=state;updateButton();});void desktop.updateState().then(state=>{updateState=state;updateButton();});}

window.addEventListener('online',()=>void sendPending().catch(()=>{}));void sendPending().catch(()=>{});
