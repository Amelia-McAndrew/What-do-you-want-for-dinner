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
    recipes: [],
    plan: {},
  };
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];
  const DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const TAB_KEY = 'wdywfd-tab';

  // ---------- State ----------

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.places) && Array.isArray(parsed.items)) {
          if (!Array.isArray(parsed.recipes)) parsed.recipes = [];
          if (!parsed.plan || typeof parsed.plan !== 'object') parsed.plan = {};
          return parsed;
        }
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
    renderRecipes();
    renderPlan();
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

  // ---------- Recipes ----------

  // Strip a leading amount like "200g", "2 x", "1 tin of" so "200g chicken" compares as "chicken".
  function ingredientName(line) {
    return line.toLowerCase()
      .replace(/^[\d\s.,/½¼¾x×-]+(g|kg|ml|l|tbsp|tsp|cups?|oz|lb|tins?|cans?|packs?|jars?|cloves?|pinch(es)?)?\b\s*(of\s+)?/, '')
      .trim();
  }

  // The food item that covers an ingredient line, if any. Prefers items that haven't gone off.
  function stockFor(line) {
    const name = ingredientName(line);
    const full = line.toLowerCase();
    if (name.length < 3) return null;
    const matches = data.items.filter((item) => {
      const food = item.name.toLowerCase().trim();
      if (item.qty <= 0 || food.length < 3) return false;
      return full.includes(food) || food.includes(name);
    });
    if (!matches.length) return null;
    return matches.find((i) => { const d = daysUntil(i.expiry); return d === null || d >= 0; }) || matches[0];
  }

  function recipeStock(recipe) {
    const lines = recipe.ingredients.map((line) => ({ line, item: stockFor(line) }));
    return { lines, have: lines.filter((l) => l.item).length, total: lines.length };
  }

  function timeText(mins) {
    if (!mins) return null;
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }

  function renderRecipes() {
    const container = $('#recipes');
    const query = $('#recipe-search').value.trim().toLowerCase();
    const level = $('#recipe-difficulty').value;
    const sort = $('#recipe-sort').value;
    container.replaceChildren();

    let list = data.recipes
      .filter((r) => !level || r.difficulty === level)
      .filter((r) => !query || r.name.toLowerCase().includes(query) ||
        r.ingredients.some((i) => i.toLowerCase().includes(query)))
      .map((r) => ({ recipe: r, stock: recipeStock(r) }));

    const order = { easy: 0, medium: 1, hard: 2 };
    const byTime = (a, b) => (a.recipe.time || Infinity) - (b.recipe.time || Infinity);
    const byName = (a, b) => a.recipe.name.localeCompare(b.recipe.name);
    if (sort === 'time') list.sort((a, b) => byTime(a, b) || byName(a, b));
    else if (sort === 'difficulty') list.sort((a, b) => order[a.recipe.difficulty] - order[b.recipe.difficulty] || byTime(a, b) || byName(a, b));
    else if (sort === 'name') list.sort(byName);
    else {
      const missing = (x) => x.stock.total - x.stock.have;
      list.sort((a, b) => missing(a) - missing(b) || b.stock.have - a.stock.have || byName(a, b));
    }

    $('#recipes-empty').hidden = data.recipes.length > 0;
    if (data.recipes.length && !list.length) {
      container.append(el('p', { class: 'muted' }, 'No recipes match that search.'));
    }
    for (const { recipe, stock } of list) container.append(renderRecipe(recipe, stock));
  }

  function sourceLabel(url) {
    let host;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
    if (/(^|\.)pinterest\.|(^|\.)pin\.it$/.test(host)) return 'Pinterest';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'TikTok';
    if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return 'YouTube';
    return host;
  }

  function firstUrl(text) {
    const match = (text || '').match(/https?:\/\/[^\s]+/);
    return match ? match[0].replace(/[).,]+$/, '') : '';
  }

  // Turn pasted caption or recipe text into a name, ingredients and method.
  function parseRecipeText(text) {
    const clean = (l) => l.replace(/^[\s•●▪◦*·\-–—✔✅☑🔸🔹▶➡👉\uFE0F]+/u, '').trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l && !/^(#\w+\s*)+$/.test(l) && !/^https?:\/\//.test(l));
    const isIngredientsHead = (l) => /^[^a-z0-9]*ingredients?\b[^a-z0-9]*:?\s*$/i.test(l);
    const isMethodHead = (l) => /^[^a-z0-9]*(method|instructions|directions|steps|how to make( it)?|preparation)\b[^a-z0-9]*:?\s*$/i.test(l);
    const looksLikeIngredient = (l) => /^[•●▪◦*·\-–—]/.test(l) ||
      (/^[\d½¼¾⅓⅔]/.test(l) && !/^\d+[.)]\s/.test(l) && l.length <= 70);
    const looksLikeStep = (l) => /^(step\s*)?\d+[.):]\s/i.test(l) || l.length > 70;

    let name = '';
    const ingredients = [];
    const method = [];
    let section = null;
    for (const line of lines) {
      if (isIngredientsHead(line)) { section = 'ingredients'; continue; }
      if (isMethodHead(line)) { section = 'method'; continue; }
      if (section === 'ingredients') ingredients.push(clean(line));
      else if (section === 'method') method.push(line);
      else if (!name && !looksLikeIngredient(line) && !looksLikeStep(line)) name = clean(line);
      else if (looksLikeIngredient(line)) ingredients.push(clean(line));
      else if (looksLikeStep(line)) method.push(line);
    }
    return { name: name.slice(0, 100), ingredients: ingredients.filter(Boolean), method: method.join('\n') };
  }

  function renderRecipe(recipe, stock) {
    const allIn = stock.total > 0 && stock.have === stock.total;
    const ingredients = el('ul', { class: 'ingredients' }, stock.lines.map(({ line, item }) => {
      const off = item && daysUntil(item.expiry) !== null && daysUntil(item.expiry) < 0;
      return el('li', { class: item ? `have${off ? ' off' : ''}` : '', title: item ? `In stock: ${item.name}` : 'Not in stock' },
        el('span', { class: 'mark', 'aria-label': item ? 'In stock' : 'Not in stock' }, item ? '✓' : '○'),
        el('span', {}, line, off ? el('span', { class: 'muted' }, ' (gone off)') : null));
    }));

    return el('article', { class: 'recipe' },
      el('div', { class: 'recipe-head' },
        el('h3', {}, recipe.name),
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit recipe', 'aria-label': `Edit ${recipe.name}`, onclick: () => openRecipeDialog(recipe) }, '✎'),
      ),
      el('div', { class: 'recipe-meta' },
        el('span', { class: `badge ${recipe.difficulty}` }, DIFFICULTY[recipe.difficulty]),
        recipe.time ? el('span', { class: 'badge' }, `⏱ ${timeText(recipe.time)}`) : null,
        stock.total
          ? el('span', { class: `badge ${allIn ? 'have-all' : ''}` },
              allIn ? 'You have everything' : `You have ${stock.have} of ${stock.total} ingredients`)
          : el('span', { class: 'badge' }, 'No ingredients added yet'),
      ),
      recipe.source && sourceLabel(recipe.source)
        ? el('a', { class: 'source-link', href: recipe.source, target: '_blank', rel: 'noopener' }, `Open on ${sourceLabel(recipe.source)} ↗`)
        : null,
      el('details', {},
        el('summary', {}, recipe.method ? 'Ingredients and method' : 'Ingredients'),
        el('h4', {}, 'Ingredients'),
        ingredients,
        recipe.method ? [el('h4', {}, 'Method'), el('p', { class: 'method' }, recipe.method)] : null,
      ),
    );
  }

  const recipeDialog = $('#recipe-dialog');

  function openRecipeDialog(recipe, shared) {
    $('#recipe-dialog-title').textContent = recipe ? 'Edit recipe' : 'Add recipe';
    $('#recipe-id').value = recipe?.id ?? '';
    $('#recipe-source').value = recipe?.source ?? shared?.url ?? '';
    $('#recipe-paste-text').value = shared?.text ?? '';
    $('#recipe-import').open = !!shared?.text;
    setAiStatus('');
    $('#recipe-name').value = recipe?.name ?? shared?.name ?? '';
    $('#recipe-level').value = recipe?.difficulty ?? 'easy';
    $('#recipe-time').value = recipe?.time ?? '';
    $('#recipe-ingredients').value = recipe ? recipe.ingredients.join('\n') : '';
    $('#recipe-method').value = recipe?.method ?? '';
    $('#recipe-delete').hidden = !recipe;
    recipeDialog.showModal();
    $('#recipe-name').focus();
  }

  $('#recipe-form').addEventListener('submit', () => {
    const id = $('#recipe-id').value;
    const time = parseInt($('#recipe-time').value, 10);
    const fields = {
      name: $('#recipe-name').value.trim(),
      source: firstUrl($('#recipe-source').value) || null,
      difficulty: $('#recipe-level').value,
      time: time > 0 ? time : null,
      ingredients: $('#recipe-ingredients').value.split('\n').map((l) => l.trim()).filter(Boolean),
      method: $('#recipe-method').value.trim(),
    };
    if (!fields.name) return;
    const existing = id && data.recipes.find((r) => r.id === id);
    if (existing) Object.assign(existing, fields);
    else data.recipes.push({ id: uid(), ...fields });
    save();
    renderRecipes();
    renderPlan();
  });

  $('#recipe-delete').addEventListener('click', () => {
    const id = $('#recipe-id').value;
    const recipe = data.recipes.find((r) => r.id === id);
    if (recipe && confirm(`Delete the ${recipe.name} recipe?`)) {
      data.recipes = data.recipes.filter((r) => r.id !== id);
      for (const day of Object.values(data.plan)) {
        for (const meal of Object.keys(day)) if (day[meal] === id) delete day[meal];
      }
      save();
      renderRecipes();
      renderPlan();
      recipeDialog.close();
    }
  });

  $('#add-recipe-btn').addEventListener('click', () => openRecipeDialog(null));

  $('#recipe-paste-link').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('#recipe-source').value = firstUrl(text) || text.trim();
    } catch (e) {
      $('#recipe-source').focus();
      alert('Your browser blocked pasting. Press and hold in the Link box and choose Paste.');
    }
  });

  $('#recipe-fill').addEventListener('click', () => {
    const text = $('#recipe-paste-text').value;
    if (!text.trim()) { $('#recipe-paste-text').focus(); return; }
    const parsed = parseRecipeText(text);
    if (!$('#recipe-source').value) $('#recipe-source').value = firstUrl(text);
    if (parsed.name && !$('#recipe-name').value.trim()) $('#recipe-name').value = parsed.name;
    if (parsed.ingredients.length) $('#recipe-ingredients').value = parsed.ingredients.join('\n');
    if (parsed.method) $('#recipe-method').value = parsed.method;
    if (!parsed.ingredients.length && !parsed.method) {
      alert("Couldn't find ingredients or steps in that text. You can still type them in below.");
      return;
    }
    $('#recipe-import').open = false;
    $('#recipe-name').focus();
  });

  // ---------- AI recipe writer ----------

  const AI_KEY = 'wdywfd-anthropic-key';
  const AI_MODEL = 'claude-opus-5-5';

  function getApiKey() {
    try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; }
  }

  const aiDialog = $('#ai-dialog');

  function openAiSettings() {
    const key = getApiKey();
    $('#ai-key').value = '';
    $('#ai-key-state').textContent = key ? `A key ending in …${key.slice(-4)} is saved on this device.` : 'No key saved yet.';
    $('#ai-key-remove').hidden = !key;
    aiDialog.showModal();
    $('#ai-key').focus();
  }

  $('#ai-settings-btn').addEventListener('click', openAiSettings);
  $('#ai-form').addEventListener('submit', () => {
    const key = $('#ai-key').value.trim();
    if (!key) return;
    try { localStorage.setItem(AI_KEY, key); } catch (e) { alert("Couldn't save the key on this device."); }
  });
  $('#ai-key-remove').addEventListener('click', () => {
    try { localStorage.removeItem(AI_KEY); } catch (e) { /* storage unavailable */ }
    aiDialog.close();
  });

  const RECIPE_SCHEMA = {
    type: 'object',
    properties: {
      found: { type: 'boolean', description: 'True if the actual recipe from the post (or a page it links to) was found.' },
      name: { type: 'string' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      time_minutes: { type: 'integer', description: 'Total time in minutes, or 0 if unknown.' },
      ingredients: { type: 'array', items: { type: 'string' } },
      method: { type: 'array', items: { type: 'string' } },
      note: { type: 'string', description: 'One short sentence for the cook about where this recipe came from.' },
    },
    required: ['found', 'name', 'difficulty', 'time_minutes', 'ingredients', 'method', 'note'],
    additionalProperties: false,
  };

  const AI_SYSTEM = `You write recipe cards for a home cook's meal-planning app from recipe posts they share, usually TikTok videos or Pinterest pins.

Find the real recipe first. Fetch the shared link. For TikTok, also fetch the oEmbed URL given, which returns the video's caption and creator. Captions often list the ingredients and steps, or point to the creator's website or another page; follow those with web fetch or web search to get the full recipe. For Pinterest, the pin usually links to a recipe page; fetch that.

If you can't find the creator's actual recipe, write a dependable recipe for the dish the post shows, based on its title and caption, set "found" to false, and say so in "note".

Write for a UK home cook. Each ingredient is one plain line with the amount first, like "2 chicken breasts" or "1 tbsp honey"; prefer grams, ml and spoons, and keep the source's amounts. Each method step is one clear instruction without a step number. Give the total time in minutes, and rate difficulty as easy, medium or hard. Keep "note" to one sentence, for example "From @creator's caption" or "Written from the video title; the creator didn't share exact amounts."`;

  function setAiStatus(text, kind) {
    const box = $('#recipe-ai-status');
    box.textContent = text;
    box.className = `ai-status ${kind || ''}`;
    box.hidden = !text;
  }

  // TikTok's public embed info gives the video caption. Browsers may block it; Claude can fetch it too.
  async function tiktokCaption(url) {
    if (sourceLabel(url) !== 'TikTok') return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const info = await res.json();
      return info.title ? { caption: info.title, author: info.author_name || '' } : null;
    } catch (e) {
      return null;
    }
  }

  function aiErrorMessage(err, Anthropic) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return 'Your API key wasn’t accepted. Check it in ✨ AI recipe writer at the bottom of the page.';
    }
    if (err instanceof Anthropic.RateLimitError) return 'Claude is busy right now. Wait a minute and try again.';
    if (err instanceof Anthropic.APIConnectionError) return 'Couldn’t reach Claude. Check you have signal and try again.';
    if (err instanceof Anthropic.APIError && /credit|billing/i.test(err.message)) {
      return 'Your Anthropic account is out of credit. Add some at console.anthropic.com and try again.';
    }
    return `Something went wrong writing the recipe (${err.message || err}). You can try again or fill it in yourself.`;
  }

  let aiBusy = false;

  async function writeRecipeWithAI() {
    if (aiBusy) return;
    const url = firstUrl($('#recipe-source').value);
    const pasted = $('#recipe-paste-text').value.trim();
    const typedName = $('#recipe-name').value.trim();
    if (!url && !pasted && !typedName) {
      setAiStatus('Add a link first (or paste the caption), then tap Write the recipe for me.', 'error');
      $('#recipe-source').focus();
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      setAiStatus('To use this, add your Anthropic API key first.', 'error');
      openAiSettings();
      return;
    }

    aiBusy = true;
    const button = $('#recipe-ai');
    button.disabled = true;
    button.textContent = '✨ Writing…';
    setAiStatus('Reading the post and writing your recipe. This can take up to a minute.');

    let Anthropic;
    try {
      ({ default: Anthropic } = await import('./vendor/anthropic-sdk.mjs'));
      const tiktok = url ? await tiktokCaption(url) : null;

      const lines = [];
      if (url) lines.push(`Shared link: ${url}`);
      if (url && sourceLabel(url) === 'TikTok') lines.push(`TikTok oEmbed URL: https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (tiktok) lines.push(`Video caption by ${tiktok.author || 'the creator'}:\n${tiktok.caption}`);
      if (typedName) lines.push(`Title or caption the cook already has: ${typedName}`);
      if (pasted) lines.push(`Text the cook pasted from the post:\n${pasted}`);
      lines.push('Write the recipe card.');

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const userMessage = { role: 'user', content: lines.join('\n\n') };
      const messages = [userMessage];
      let response;
      // Server-side web tools can pause a long turn; resend to let it carry on.
      for (let attempt = 0; attempt < 5; attempt++) {
        response = await client.beta.messages.create({
          model: AI_MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: AI_SYSTEM,
          messages,
          tools: [
            { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
            { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
          ],
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
        });
        if (response.stop_reason !== 'pause_turn') break;
        const soFar = messages[1] ? messages[1].content : [];
        messages[1] = { role: 'assistant', content: [...soFar, ...response.content] };
      }

      if (response.stop_reason === 'refusal') {
        throw new Error('Claude declined to write this one');
      }
      if (response.stop_reason === 'max_tokens' || response.stop_reason === 'pause_turn') {
        throw new Error('the recipe took too long to write');
      }
      const texts = response.content.filter((b) => b.type === 'text');
      const recipe = JSON.parse(texts[texts.length - 1]?.text || '');

      if (!$('#recipe-name').value.trim() || $('#recipe-name').value.trim() === typedName) {
        $('#recipe-name').value = recipe.name;
      }
      $('#recipe-level').value = DIFFICULTY[recipe.difficulty] ? recipe.difficulty : 'medium';
      $('#recipe-time').value = recipe.time_minutes > 0 ? recipe.time_minutes : '';
      $('#recipe-ingredients').value = recipe.ingredients.join('\n');
      $('#recipe-method').value = recipe.method.map((step, i) => `${i + 1}. ${step.replace(/^\d+[.)]\s*/, '')}`).join('\n');
      $('#recipe-import').open = false;
      setAiStatus(`${recipe.note} Check it over, then tap Save.`, 'done');
    } catch (err) {
      setAiStatus(Anthropic ? aiErrorMessage(err, Anthropic) : 'Couldn’t load the recipe writer. Check you have signal and try again.', 'error');
    } finally {
      aiBusy = false;
      button.disabled = false;
      button.textContent = '✨ Write the recipe for me';
    }
  }

  $('#recipe-ai').addEventListener('click', writeRecipeWithAI);

  // Opened from the phone's share menu: start a new recipe with what was shared.
  function handleShare() {
    const params = new URLSearchParams(location.search);
    const title = params.get('title') || '';
    const text = params.get('text') || '';
    const url = params.get('url') || firstUrl(text) || firstUrl(title);
    if (!url && !text) return;
    history.replaceState(null, '', location.pathname);
    const extra = text.replace(url, '').trim();
    const short = extra.length <= 60 && !extra.includes('\n');
    let name = title && !/^https?:\/\//.test(title) ? title.trim() : '';
    if (!name && short) name = extra;
    showTab('recipes');
    openRecipeDialog(null, { url, name, text: short ? '' : extra });
    if (url && getApiKey()) writeRecipeWithAI();
  }
  $('#recipe-search').addEventListener('input', renderRecipes);
  $('#recipe-difficulty').addEventListener('change', renderRecipes);
  $('#recipe-sort').addEventListener('change', renderRecipes);

  // ---------- Meal plan ----------

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function mondayOf(d) {
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }

  let weekStart = mondayOf(new Date());

  function weekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  function weekLabel() {
    const days = weekDays();
    const thisWeek = isoDate(weekStart) === isoDate(mondayOf(new Date()));
    const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const range = `${fmt(days[0])} – ${fmt(days[6])}`;
    return thisWeek ? `This week · ${range}` : `Week of ${range}`;
  }

  function plannedRecipes() {
    const list = [];
    for (const d of weekDays()) {
      const day = data.plan[isoDate(d)] || {};
      for (const [meal] of MEALS) {
        const recipe = data.recipes.find((r) => r.id === day[meal]);
        if (recipe) list.push(recipe);
      }
    }
    return list;
  }

  function setMeal(date, meal, recipeId) {
    const day = data.plan[date] || (data.plan[date] = {});
    if (recipeId) day[meal] = recipeId;
    else delete day[meal];
    if (!Object.keys(day).length) delete data.plan[date];
    save();
    renderPlan();
  }

  function renderPlan() {
    $('#week-label').textContent = weekLabel();
    $('#plan-no-recipes').hidden = data.recipes.length > 0;
    const todayIso = isoDate(new Date());
    const recipes = [...data.recipes].sort((a, b) => a.name.localeCompare(b.name));
    const container = $('#week');
    container.replaceChildren();

    for (const d of weekDays()) {
      const date = isoDate(d);
      const day = data.plan[date] || {};
      const slots = MEALS.map(([meal, label]) => {
        const id = `plan-${date}-${meal}`;
        const chosen = recipes.find((r) => r.id === day[meal]);
        const select = el('select', { id, class: chosen ? '' : 'empty', onchange: (e) => setMeal(date, meal, e.target.value) },
          el('option', { value: '' }, recipes.length ? 'Choose a meal…' : 'No recipes saved'),
          recipes.map((r) => el('option', { value: r.id }, r.name)));
        select.value = chosen ? chosen.id : '';
        let meta = null;
        if (chosen) {
          const stock = recipeStock(chosen);
          meta = el('div', { class: 'slot-meta' },
            el('span', { class: `badge ${chosen.difficulty}` }, DIFFICULTY[chosen.difficulty]),
            chosen.time ? el('span', { class: 'badge' }, `⏱ ${timeText(chosen.time)}`) : null,
            stock.total ? el('span', { class: `badge ${stock.have === stock.total ? 'have-all' : ''}` }, `${stock.have}/${stock.total} in stock`) : null);
        }
        return el('div', { class: 'slot' }, el('label', { for: id }, label), select, meta);
      });

      container.append(el('article', { class: `day ${date === todayIso ? 'today' : ''}` },
        el('div', { class: 'day-head' },
          el('h3', {}, d.toLocaleDateString(undefined, { weekday: 'long' })),
          el('span', { class: 'muted' }, d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })),
          date === todayIso ? el('span', { class: 'today-tag' }, 'Today') : null),
        slots));
    }
    renderShopping();
  }

  // Ingredients for this week's meals that aren't in stock, merged by line.
  function shoppingList() {
    const needed = new Map();
    for (const recipe of plannedRecipes()) {
      for (const line of recipe.ingredients) {
        if (stockFor(line)) continue;
        const key = line.toLowerCase();
        if (!needed.has(key)) needed.set(key, { line, recipes: new Set() });
        needed.get(key).recipes.add(recipe.name);
      }
    }
    return [...needed.values()];
  }

  function renderShopping() {
    const list = shoppingList();
    const planned = plannedRecipes().length;
    $('#shopping').replaceChildren(...list.map(({ line, recipes }) =>
      el('li', {}, line, el('span', { class: 'for' }, ` · for ${[...recipes].join(', ')}`))));
    $('#shopping-empty').hidden = list.length > 0;
    $('#shopping-empty').textContent = planned
      ? 'You already have everything for this week’s meals.'
      : 'Pick some meals above and anything you don’t have in stock will be listed here.';
    $('#copy-shopping').hidden = list.length === 0;
  }

  $('#copy-shopping').addEventListener('click', async () => {
    const text = shoppingList().map(({ line }) => `- ${line}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('#copy-shopping').textContent = 'Copied';
      setTimeout(() => { $('#copy-shopping').textContent = 'Copy list'; }, 1500);
    } catch (e) {
      prompt('Copy your shopping list:', text);
    }
  });

  const moveWeek = (days) => { weekStart.setDate(weekStart.getDate() + days); renderPlan(); };
  $('#week-prev').addEventListener('click', () => moveWeek(-7));
  $('#week-next').addEventListener('click', () => moveWeek(7));
  $('#week-today').addEventListener('click', () => { weekStart = mondayOf(new Date()); renderPlan(); });
  $('#week-clear').addEventListener('click', () => {
    if (!plannedRecipes().length || !confirm('Remove all meals planned for this week?')) return;
    for (const d of weekDays()) delete data.plan[isoDate(d)];
    save();
    renderPlan();
  });

  // ---------- Tabs ----------

  const TABS = ['food', 'recipes', 'plan'];

  function showTab(name) {
    for (const tab of TABS) {
      $(`#tab-${tab}`).setAttribute('aria-selected', String(tab === name));
      $(`#${tab}-view`).hidden = tab !== name;
    }
    try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* storage unavailable */ }
  }

  for (const tab of TABS) $(`#tab-${tab}`).addEventListener('click', () => showTab(tab));
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.includes(saved)) showTab(saved);
  } catch (e) { /* storage unavailable */ }

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
      if (!Array.isArray(parsed.recipes)) parsed.recipes = [];
      if (!parsed.plan || typeof parsed.plan !== 'object') parsed.plan = {};
      if (!confirm('Replace your current food list, recipes and meal plan with the imported ones?')) return;
      data = parsed;
      save();
      render();
    } catch (err) {
      alert('That file could not be imported.');
    }
  });

  render();
  handleShare();

  // Offline support and asking the browser not to clear our saved data.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
