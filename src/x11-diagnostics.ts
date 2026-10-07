// Reviewed, local-only inventory. It deliberately contains no HID paths or serials.
export async function openX11Details(failure?:string){
 const bridge=window.familyGear;if(!bridge)return;
 const dialog=document.createElement('dialog');dialog.innerHTML='<button class="icon-button" aria-label="Close">×</button><h2>X11 connection details</h2><p>This reads the connected X11-family interfaces without changing settings. Review the details, then copy them to your group chat. Nothing is sent automatically.</p><textarea readonly rows="12" aria-label="X11 interface report">Reading interfaces…</textarea><p role="status"></p><button class="secondary" data-copy disabled>Copy connection details</button>';
 document.body.append(dialog);dialog.querySelector('.icon-button')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();if(failure)dialog.querySelector('[role="status"]')!.textContent=failure;
 const area=dialog.querySelector('textarea')!,status=dialog.querySelector('[role="status"]')!,copy=dialog.querySelector<HTMLButtonElement>('[data-copy]')!;
 try{const report=await bridge.x11('diagnostics');area.value=JSON.stringify({...report,error:failure},null,2);copy.disabled=false;copy.onclick=async()=>{try{await bridge.copyReport(area.value);status.textContent='Copied. You can send this in your group chat.';}catch{status.textContent='Could not copy. Select the text and copy it manually.';}};}catch(error){area.value='';status.textContent=error instanceof Error?error.message:'Interface read unavailable.';}
}
