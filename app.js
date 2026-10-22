(() => {
  'use strict';

  const STORAGE_KEY = 'wdywfd-data-v1';
  const SOON_DAYS = 3;
  const LOW_RATIO = 0.25;

  const DEFAULT_DATA = {
    places: [
      { id: 'fridge', name: 'Fridge', icon: '🥶' },
      { id: 'freezer', name: 'Freezer', icon: '🧊' },
      { id: 'cupboard', name: 'Cupboard', icon: '🥫' },
    ],
    items: [],
  };

  // ---------- State ----------

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.places) && Array.isArray(parsed.items)) return parsed;
      }
    } catch (e) { /* fall through to defaults */ }
    return structuredClone(DEFAULT_DATA);
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Helpers ----------

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function today() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysUntil(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    return Math.round((target - today()) / 86400000);
  }

  function expiryInfo(item) {
    const days = daysUntil(item.expiry);
    if (days === null) return { days: null, cls: '', text: 'No date' };
    if (days < 0) return { days, cls: 'bad', text: `Gone off ${-days} day${days === -1 ? '' : 's'} ago` };
    if (days === 0) return { days, cls: 'bad', text: 'Goes off today' };
    if (days === 1) return { days, cls: 'warn', text: 'Goes off tomorrow' };
    if (days <= SOON_DAYS) return { days, cls: 'warn', text: `Goes off in ${days} days` };
    const date = new Date(item.expiry + 'T00:00:00');
    const opts = { day: 'numeric', month: 'short' };
    if (date.getFullYear() !== today().getFullYear()) opts.year = 'numeric';
    const label = date.toLocaleDateString(undefined, opts);
    return { days, cls: 'ok', text: `Use by ${label}` };
  }

  function fmtNum(n) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function amountText(item) {
    const qty = fmtNum(item.qty);
    const unit = item.unit ? ` ${item.unit}` : '';
    if (item.full) return `${qty} of ${fmtNum(item.full)}${unit} left`;
    return `${qty}${unit} left`;
  }

  function leftRatio(item) {
    if (!item.full) return null;
    return Math.max(0, Math.min(1, item.qty / item.full));
  }

  function isLow(item) {
    const r = leftRatio(item);
    return r !== null ? r <= LOW_RATIO : item.qty <= 0;
  }

  function sortItems(items) {
    const mode = $('#sort').value;
    const copy = [...items];
    if (mode === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (mode === 'left') {
      const key = (i) => leftRatio(i) ?? (i.qty > 0 ? 1 : 0);
      copy.sort((a, b) => key(a) - key(b));
    } else {
      const key = (i) => { const d = daysUntil(i.expiry); return d === null ? Infinity : d; };
      copy.sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
    }
    return copy;
  }

  // ---------- Rendering ----------

  function render() {
    renderStats();
    renderUseFirst();
    renderPlaces();
  }

  function renderStats() {
    let soon = 0, expired = 0, low = 0;
    for (const item of data.items) {
      const d = daysUntil(item.expiry);
      if (d !== null && d < 0) expired++;
      else if (d !== null && d <= SOON_DAYS) soon++;
      if (isLow(item)) low++;
    }
    $('#stat-total').textContent = data.items.length;
    $('#stat-soon').textContent = soon;
    $('#stat-expired').textContent = expired;
    $('#stat-low').textContent = low;
  }

  function renderUseFirst() {
    const list = $('#use-first');
    list.replaceChildren();
    const urgent = data.items
      .map((item) => ({ item, days: daysUntil(item.expiry) }))
      .filter((x) => x.days !== null && x.days <= SOON_DAYS)
      .sort((a, b) => a.days - b.days);
    for (const { item, days } of urgent) {
      const place = data.places.find((p) => p.id === item.placeId);
      const when = days < 0 ? 'gone off' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`;
      list.append(el('li', { class: days < 0 ? 'expired' : '' },
        `${item.name} · ${when}${place ? ` · ${place.name}` : ''}`));
    }
    $('#use-first-empty').hidden = urgent.length > 0;
  }

  function renderPlaces() {
    const container = $('#places');
    const query = $('#search').value.trim().toLowerCase();
    container.replaceChildren();
    $('#places-empty').hidden = data.places.length > 0;

    for (const place of data.places) {
      const all = data.items.filter((i) => i.placeId === place.id);
      const shown = sortItems(all.filter((i) =>
        !query || i.name.toLowerCase().includes(query) || (i.notes || '').toLowerCase().includes(query)));
      if (query && shown.length === 0) continue;

      const list = el('ul', { class: 'items' }, shown.map(renderItem));

      container.append(el('article', { class: 'place' },
        el('div', { class: 'place-head' },
          el('h3', {}, `${place.icon ? place.icon + ' ' : ''}${place.name}`),
          el('span', { class: 'place-count' }, `${all.length} item${all.length === 1 ? '' : 's'}`),
          el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit storage place', 'aria-label': `Edit ${place.name}`, onclick: () => openPlaceDialog(place) }, '✎'),
        ),
        all.length ? list : el('p', { class: 'place-empty' }, 'Nothing here yet.'),
        el('button', { type: 'button', class: 'btn btn-small place-add', onclick: () => openItemDialog(null, place.id) }, `+ Add to ${place.name}`),
      ));
    }
  }

  function renderItem(item) {
    const exp = expiryInfo(item);
    const ratio = leftRatio(item);
    const low = isLow(item);

    return el('li', { class: 'item' },
      el('div', { class: 'item-name' }, item.name,
        item.notes ? el('span', { class: 'item-notes' }, ` – ${item.notes}`) : null),
      el('div', { class: 'item-actions' },
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Use one', 'aria-label': `Use one ${item.name}`, onclick: () => useSome(item) }, '−1'),
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit', 'aria-label': `Edit ${item.name}`, onclick: () => openItemDialog(item) }, '✎'),
      ),
      el('div', { class: 'item-meta' },
        el('span', { class: `badge ${exp.cls}` }, exp.text),
        el('span', { class: `badge ${low ? 'low' : ''}` }, amountText(item)),
      ),
      ratio !== null
        ? el('div', { class: `meter ${low ? 'low' : ''}`, role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(ratio * 100), 'aria-label': `${Math.round(ratio * 100)}% left` },
            el('span', { style: `width:${ratio * 100}%` }))
        : null,
    );
  }

  // ---------- Actions ----------

  function useSome(item) {
    item.qty = Math.max(0, item.qty - 1);
    if (item.qty === 0 && confirm(`${item.name} is all used up. Remove it?`)) {
      data.items = data.items.filter((i) => i.id !== item.id);
    }
    save();
    render();
  }

  // Item dialog
  const itemDialog = $('#item-dialog');

  function openItemDialog(item, placeId) {
    if (data.places.length === 0) {
      alert('Add a storage place first.');
      return;
    }
    $('#item-dialog-title').textContent = item ? 'Edit food' : 'Add food';
    $('#item-place').replaceChildren(...data.places.map((p) =>
      el('option', { value: p.id }, `${p.icon ? p.icon + ' ' : ''}${p.name}`)));
    $('#item-id').value = item?.id ?? '';
    $('#item-name').value = item?.name ?? '';
    $('#item-place').value = item?.placeId ?? placeId ?? data.places[0].id;
    $('#item-expiry').value = item?.expiry ?? '';
    $('#item-qty').value = item ? fmtNum(item.qty) : '1';
    $('#item-unit').value = item?.unit ?? '';
    $('#item-full').value = item?.full ? fmtNum(item.full) : '';
    $('#item-notes').value = item?.notes ?? '';
    $('#item-delete').hidden = !item;
    itemDialog.showModal();
    $('#item-name').focus();
  }

  $('#item-form').addEventListener('submit', () => {
    const id = $('#item-id').value;
    const full = parseFloat($('#item-full').value);
    const fields = {
      name: $('#item-name').value.trim(),
      placeId: $('#item-place').value,
      expiry: $('#item-expiry').value || null,
      qty: Math.max(0, parseFloat($('#item-qty').value) || 0),
      unit: $('#item-unit').value.trim(),
      full: full > 0 ? full : null,
      notes: $('#item-notes').value.trim(),
    };
    if (!fields.name) return;
    if (id) Object.assign(data.items.find((i) => i.id === id), fields);
    else data.items.push({ id: uid(), ...fields });
    save();
    render();
  });

  $('#item-delete').addEventListener('click', () => {
    const id = $('#item-id').value;
    const item = data.items.find((i) => i.id === id);
    if (item && confirm(`Delete ${item.name}?`)) {
      data.items = data.items.filter((i) => i.id !== id);
      save();
      render();
      itemDialog.close();
    }
  });

  // Place dialog
  const placeDialog = $('#place-dialog');

  function openPlaceDialog(place) {
    $('#place-dialog-title').textContent = place ? 'Edit storage place' : 'Add storage place';
    $('#place-id').value = place?.id ?? '';
    $('#place-name').value = place?.name ?? '';
    $('#place-icon').value = place?.icon ?? '';
    $('#place-delete').hidden = !place;
    placeDialog.showModal();
    $('#place-name').focus();
  }

  $('#place-form').addEventListener('submit', () => {
    const id = $('#place-id').value;
    const fields = { name: $('#place-name').value.trim(), icon: $('#place-icon').value.trim() };
    if (!fields.name) return;
    if (id) Object.assign(data.places.find((p) => p.id === id), fields);
    else data.places.push({ id: uid(), ...fields });
    save();
    render();
  });

  $('#place-delete').addEventListener('click', () => {
    const id = $('#place-id').value;
    const place = data.places.find((p) => p.id === id);
    if (!place) return;
    const count = data.items.filter((i) => i.placeId === id).length;
    const msg = count
      ? `Delete ${place.name} and the ${count} item${count === 1 ? '' : 's'} in it?`
      : `Delete ${place.name}?`;
    if (confirm(msg)) {
      data.places = data.places.filter((p) => p.id !== id);
      data.items = data.items.filter((i) => i.placeId !== id);
      save();
      render();
      placeDialog.close();
    }
  });

  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('dialog').close()));

  // Toolbar
  $('#add-item-btn').addEventListener('click', () => openItemDialog(null));
  $('#add-place-btn').addEventListener('click', () => openPlaceDialog(null));
  $('#search').addEventListener('input', renderPlaces);
  $('#sort').addEventListener('change', renderPlaces);

  // Export / import
  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `food-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.places) || !Array.isArray(parsed.items)) throw new Error('bad shape');
      if (!confirm('Replace your current food list with the imported one?')) return;
      data = parsed;
      save();
      render();
    } catch (err) {
      alert('That file could not be imported.');
    }
  });

  render();

  // Offline support and asking the browser not to clear our saved data.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
