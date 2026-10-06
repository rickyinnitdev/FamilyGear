import './suggestions.css';

export function bindSuggestions() {
  document.querySelector('#suggestions')?.addEventListener('click', async () => {
    const repository = await window.familyGear?.community().catch(() => null);
    let draft = { title: '', category: 'Feature idea', message: '' };
    try { draft = { ...draft, ...JSON.parse(localStorage.getItem('family-gear-suggestion') || '{}') }; } catch {}
    const dialog = document.createElement('dialog');
    dialog.className = 'suggestion-dialog';
    dialog.innerHTML = `<button class="icon-button suggestion-close" aria-label="Close suggestions">×</button><span class="eyebrow">MAKE FAMILY GEAR BETTER</span><h2>Share an idea</h2><p>Tell us what would make your setup easier.</p><form><label>Title<input name="title" maxlength="120" required placeholder="A short description"/></label><label>Type<select name="category"><option>Feature idea</option><option>Bug report</option><option>Other</option></select></label><label>Your message<textarea name="message" rows="5" maxlength="4000" required placeholder="What would you like to see? Include your device model if it helps."></textarea></label><button class="secondary" type="submit">Preview message</button></form><section class="suggestion-preview" hidden><h3>Your message</h3><pre></pre><p class="suggestion-note"></p><div class="suggestion-actions"><button class="primary suggestion-send" type="button">Open GitHub form</button><button class="secondary suggestion-copy" type="button">Copy message</button></div></section><hr/><a class="suggestion-review" target="_blank" rel="noreferrer">Review suggestions on GitHub ↗</a><p class="suggestion-status" role="status"></p>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form')!;
    const title = form.elements.namedItem('title') as HTMLInputElement;
    const category = form.elements.namedItem('category') as HTMLSelectElement;
    const message = form.elements.namedItem('message') as HTMLTextAreaElement;
    title.value = String(draft.title).slice(0, 120); category.value = draft.category; message.value = String(draft.message).slice(0, 4000);
    const status = dialog.querySelector('.suggestion-status')!;
    const preview = dialog.querySelector<HTMLElement>('.suggestion-preview')!;
    const send = dialog.querySelector<HTMLButtonElement>('.suggestion-send')!;
    const review = dialog.querySelector<HTMLAnchorElement>('.suggestion-review')!;
    if (repository) review.href = `https://github.com/${repository}/issues?q=${encodeURIComponent('is:issue "[Suggestion]"')}`;
    else { review.remove(); status.textContent = 'The suggestion inbox is not connected yet. You can copy your message and send it in the group chat.'; }
    let contents = '', issueTitle = '';
    form.addEventListener('input', () => {
      localStorage.setItem('family-gear-suggestion', JSON.stringify({title:title.value, category:category.value, message:message.value}));
      preview.hidden = true;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      issueTitle = `[Suggestion] ${title.value.trim()}`;
      contents = `${category.value}\n\n${message.value.trim()}`;
      dialog.querySelector('pre')!.textContent = `${issueTitle}\n\n${contents}`;
      dialog.querySelector('.suggestion-note')!.textContent = repository ? 'GitHub suggestions are public. The next button opens a form for you to review and submit with your GitHub account. No device data is attached.' : 'Copy this message to share it in your group chat. Nothing is sent automatically.';
      send.hidden = !repository;
      preview.hidden = false;
    });
    send.addEventListener('click', () => {
      if (repository) window.open(`https://github.com/${repository}/issues/new?${new URLSearchParams({title:issueTitle, body:contents})}`, '_blank', 'noopener,noreferrer');
    });
    dialog.querySelector('.suggestion-copy')!.addEventListener('click', async () => {
      try { await (window.familyGear ? window.familyGear.copyReport(`${issueTitle}\n\n${contents}`) : navigator.clipboard.writeText(`${issueTitle}\n\n${contents}`)); status.textContent = 'Copied. Paste it in your group chat.'; }
      catch { status.textContent = 'Select the preview text and copy it manually.'; }
    });
    dialog.querySelector('.suggestion-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  });
}
