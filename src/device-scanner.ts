import './suggestions.css';

const hex = (value: number) => value.toString(16).padStart(4, '0').toUpperCase();
export function bindDeviceScanner() {
  document.querySelector('#device-scanner')?.addEventListener('click', async () => {
    const desktop = window.familyGear;
    if (!desktop) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'suggestion-dialog scanner-dialog';
    dialog.innerHTML = `<button class="icon-button scanner-close" aria-label="Close scanner">×</button><span class="eyebrow">HELP US SUPPORT YOUR GEAR</span><h2>Scan your devices</h2><p>Find connected USB mice, keyboards and HID devices, including models Family Gear does not support yet.</p><p class="scanner-note">The scan reads Windows device names and USB vendor/product IDs. It does not change settings or include serial numbers, computer names or account details.</p><button class="primary scanner-start">Scan connected devices</button><p class="scanner-status" role="status"></p><div class="scanner-results"></div><section class="scanner-compose" hidden><label>Your mouse / keyboard model<input class="scanner-model" maxlength="160" placeholder="For example: AULA SC580 — use the name on the box"/></label><label>What should we add?<textarea class="scanner-notes" rows="3" maxlength="1500" placeholder="DPI, button bindings, lighting…"></textarea></label><button class="secondary scanner-preview">Preview report</button></section><section class="scanner-report" hidden><h3>Report preview</h3><pre></pre><p>Review the selected devices and text before sharing. GitHub reports are public and require your GitHub login; copying works for group chat without login.</p><div class="suggestion-actions"><button class="primary scanner-submit">Send report on GitHub</button><button class="secondary scanner-copy">Copy report</button><button class="secondary scanner-save">Save report</button></div></section>`;
    document.body.append(dialog);
    const status = dialog.querySelector('.scanner-status')!;
    const start = dialog.querySelector<HTMLButtonElement>('.scanner-start')!;
    const compose = dialog.querySelector<HTMLElement>('.scanner-compose')!;
    const preview = dialog.querySelector<HTMLElement>('.scanner-report')!;
    const results = dialog.querySelector('.scanner-results')!;
    const model = dialog.querySelector<HTMLInputElement>('.scanner-model')!;
    const notes = dialog.querySelector<HTMLTextAreaElement>('.scanner-notes')!;
    let devices: ScannedDevice[] = [], report = '', title = '';
    const repository = await desktop.community().catch(() => null);
    dialog.querySelector<HTMLButtonElement>('.scanner-submit')!.hidden = !repository;
    start.addEventListener('click', async () => {
      start.disabled = true; preview.hidden = compose.hidden = true; results.replaceChildren();
      status.textContent = 'Reading connected devices…';
      try {
        devices = await desktop.scanDevices();
        if (!dialog.isConnected) return;
        for (const [index, device] of devices.entries()) {
          const row = document.createElement('label'); row.className = 'scanner-device';
          const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.dataset.index = String(index);
          const text = document.createElement('span'); text.textContent = `${device.name} · ${device.deviceClass} · ${hex(device.vendorId)}:${hex(device.productId)}`;
          row.append(input, text); results.append(row);
        }
        status.textContent = devices.length ? `${devices.length} device entries found. Select only the gear you want to share. Windows may list several entries for one device.` : 'No USB input devices found. Bluetooth-only devices are not included. You can still type your model below.';
        compose.hidden = false;
      } catch { status.textContent = 'The Windows scan could not finish. Try again, or use Share an idea to tell us your model.'; }
      finally { start.disabled = false; }
    });
    const invalidate = () => { preview.hidden = true; };
    results.addEventListener('change', invalidate); model.addEventListener('input', invalidate); notes.addEventListener('input', invalidate);
    dialog.querySelector('.scanner-preview')!.addEventListener('click', () => {
      const chosen = [...results.querySelectorAll<HTMLInputElement>('input:checked')].map(input => devices[Number(input.dataset.index)]);
      if (!chosen.length && !model.value.trim()) { status.textContent = 'Select a device or type your model first.'; return; }
      title = `[Device report] ${model.value.trim() || chosen[0].name}`;
      report = `Family Gear 0.2.3 · Windows device scan\n\nModel supplied by user: ${model.value.trim() || 'Not specified'}\n\nSelected devices:\n${chosen.map(device => `- ${device.name} | ${device.deviceClass} | VID ${hex(device.vendorId)} | PID ${hex(device.productId)}`).join('\n') || 'None selected'}\n\nRequested support:\n${notes.value.trim() || 'Please investigate support for these devices.'}\n\nUSB IDs identify device families; they do not prove protocol compatibility. No serial numbers or device instance paths are included.`;
      preview.querySelector('pre')!.textContent = `${title}\n\n${report}`;
      preview.hidden = false;
    });
    dialog.querySelector('.scanner-submit')!.addEventListener('click', () => {
      if (!preview.hidden && repository) window.open(`https://github.com/${repository}/issues/new?${new URLSearchParams({ title, body: report })}`, '_blank', 'noopener,noreferrer');
    });
    dialog.querySelector('.scanner-copy')!.addEventListener('click', async () => {
      try { await desktop.copyReport(`${title}\n\n${report}`); status.textContent = 'Copied. Send it in your group chat.'; }
      catch { status.textContent = 'Select and copy the preview text manually.'; }
    });
    dialog.querySelector('.scanner-save')!.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([`${title}\n\n${report}`], { type: 'text/plain' }));
      const link = document.createElement('a'); link.href = url; link.download = 'Family-Gear-device-report.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    dialog.querySelector('.scanner-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
  });
}
