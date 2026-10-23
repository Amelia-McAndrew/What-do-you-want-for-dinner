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
    members: [],
  };
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];
  const DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  // What a recipe is: a whole meal on its own, or one part of a meal.
  const KINDS = [
    ['meal', '🍽️', 'Full meal', 'Full meals'],
    ['main', '🍗', 'Main', 'Mains'],
    ['side', '🥗', 'Side', 'Sides'],
    ['sauce', '🥣', 'Sauce or dip', 'Sauces and dips'],
    ['starter', '🥟', 'Starter', 'Starters'],
    ['dessert', '🍰', 'Dessert', 'Desserts'],
    ['drink', '🥤', 'Drink', 'Drinks'],
  ];
  const KIND_INFO = Object.fromEntries(KINDS.map(([id, icon, label, plural]) => [id, { icon, label, plural }]));
  const kindOf = (recipe) => (KIND_INFO[recipe.course] ? recipe.course : 'meal');

  // Recipe categories. A recipe can have any number; anything not in this list is the
  // person's own category, stored as they typed it.
  const CATEGORY_GROUPS = [
    ['Cuisine', [['asian', '🥢', 'Asian'], ['italian', '🍝', 'Italian'], ['mexican', '🌮', 'Mexican'], ['indian', '🍛', 'Indian'],
      ['british', '🫖', 'British'], ['mediterranean', '🫒', 'Mediterranean'], ['american', '🍔', 'American'],
      ['middle-eastern', '🧆', 'Middle Eastern'], ['french', '🥐', 'French']]],
    ['Season', [['spring', '🌷', 'Spring'], ['summer', '☀️', 'Summer'], ['autumn', '🍂', 'Autumn'], ['winter', '❄️', 'Winter'], ['christmas', '🎄', 'Christmas']]],
    ['Diet', [['vegetarian', '🥕', 'Vegetarian'], ['vegan', '🌱', 'Vegan'], ['healthy', '🥗', 'Healthy'], ['gluten-free', '🌾', 'Gluten free']]],
    ['Occasion', [['quick', '⚡', 'Quick'], ['comfort', '🛋️', 'Comfort food'], ['fakeaway', '🥡', 'Fakeaway'], ['batch', '🍲', 'Batch cook'],
      ['slow-cooker', '⏲️', 'Slow cooker'], ['bbq', '🔥', 'BBQ'], ['roast', '🍖', 'Sunday roast'], ['kids', '🧒', 'Kid friendly'], ['hosting', '🎉', 'Hosting']]],
  ];
  const CATEGORY_INFO = Object.fromEntries(CATEGORY_GROUPS.flatMap(([, cats]) => cats.map(([id, icon, label]) => [id, { icon, label }])));
  const catLabel = (tag) => (CATEGORY_INFO[tag] ? `${CATEGORY_INFO[tag].icon} ${CATEGORY_INFO[tag].label}` : `🏷️ ${tag}`);
  const tagsOf = (recipe) => (Array.isArray(recipe.tags) ? recipe.tags : []);

  // Match a typed category ("asian", "Slow Cooker") to a built-in one, or keep it as the person's own.
  function categoryFor(text) {
    const t = text.trim().replace(/[^\p{L}\p{N}\s'&-]/gu, '').trim();
    if (!t) return null;
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    for (const [id, info] of Object.entries(CATEGORY_INFO)) {
      if (key === id.replace('-', ' ') || key === info.label.toLowerCase()) return id;
    }
    if (key === 'veggie') return 'vegetarian';
    if (key === 'slow cook') return 'slow-cooker';
    return t.slice(0, 30);
  }

  // UK seasons by month.
  function currentSeason(date = new Date()) {
    const m = date.getMonth();
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }

  // Kinds of food, in rough supermarket order (used to group the shopping list).
  const FOOD_TYPES = [
    ['produce', '🥦', 'Fruit & veg'],
    ['bakery', '🍞', 'Bread & bakery'],
    ['meat', '🥩', 'Meat & fish'],
    ['dairy', '🧀', 'Dairy & eggs'],
    ['grains', '🍝', 'Pasta, rice & grains'],
    ['tins', '🥫', 'Tins & jars'],
    ['sauces', '🧂', 'Sauces, oils & spices'],
    ['baking', '🧁', 'Baking'],
    ['snacks', '🍫', 'Snacks & sweets'],
    ['drinks', '🥤', 'Drinks'],
    ['other', '🛒', 'Other'],
  ];
  const TYPE_INFO = Object.fromEntries(FOOD_TYPES.map(([id, icon, label]) => [id, { icon, label }]));

  // Checked in order, so specific phrases ("coconut milk", "peanut butter") win over single words.
  const TYPE_KEYWORDS = [
    ['other', /\b(kitchen roll|toilet roll|foil|cling film|bin bags|washing.up|soap|bleach|nappies|tissues)\b/],
    ['produce', /\b(bell|red|green|yellow|orange|sweet) peppers?\b/],
    ['snacks', /\bice cream\b/],
    ['tins', /\b(tins?|tinned|cans?|canned|chopped tomatoes|passata|tomato (puree|paste)|baked beans|coconut milk|peanut butter|jam|marmalade|honey|chickpeas|kidney beans|black beans|butter beans|lentils|sweetcorn|tuna|sardines|olives|pickles?|capers|nutella|soup)\b/],
    ['sauces', /\b(sauce|ketchup|mayo(nnaise)?|mustard|vinegar|oil|stock|gravy|soy|gochujang|miso|pesto|salsa|chutney|dressing|salt|pepper(corns)?|spices?|paprika|cumin|turmeric|curry powder|chilli flakes|cinnamon|oregano|thyme|basil|rosemary|bay leaves|herbs?|seasoning|garam masala|sriracha|harissa|worcestershire)\b/],
    ['baking', /\b(flour|sugar|baking (powder|soda)|bicarbonate|yeast|cocoa|vanilla|icing|chocolate chips|cornflour|caster|syrup|treacle|oats)\b/],
    ['grains', /\b(pasta|spaghetti|penne|fusilli|linguine|lasagne|noodles?|rice|couscous|quinoa|bulgur|cereal|porridge|granola|crackers?|gnocchi|risotto)\b/],
    ['bakery', /\b(bread|loaf|rolls?|baguette|bagels?|wraps?|tortillas?|pittas?|naan|croissants?|crumpets?|muffins?|buns?|brioche|ciabatta|sourdough)\b/],
    ['meat', /\b(chicken|beef|pork|lamb|turkey|duck|mince|steak|bacon|ham|sausages?|chorizo|salami|pepperoni|gammon|fish|salmon|cod|haddock|prawns?|shrimp|mackerel|trout|seafood|mussels|squid|meatballs?|burgers?|thighs?|breasts?|drumsticks?|wings?|ribs?|tofu|quorn)\b/],
    ['dairy', /\b(milk|cheese|cheddar|mozzarella|parmesan|feta|halloumi|brie|butter|cream|creme fraiche|crème fraîche|yogh?urt|eggs?|custard|mascarpone|ricotta|paneer)\b/],
    ['drinks', /\b(juice|water|squash|cola|lemonade|tea|coffee|beer|wine|cider|smoothie|drink)\b/],
    ['snacks', /\b(crisps|chocolate|biscuits?|sweets|popcorn|nuts|cake|cookies?|ice cream|snacks?|crackers)\b/],
    ['produce', /\b(apples?|bananas?|oranges?|lemons?|limes?|grapes?|berries|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|melon|mango|pineapple|pears?|peach(es)?|plums?|avocados?|tomato(es)?|potato(es)?|onions?|garlic|ginger|carrots?|peppers?|chill(i|ies)|courgettes?|aubergines?|broccoli|cauliflower|cabbage|spinach|lettuce|salad|kale|cucumber|celery|leeks?|mushrooms?|peas|beans|sweet potato(es)?|squash|pumpkin|spring onions?|shallots?|herbs|coriander|parsley|mint|rocket|beetroot|sprouts|asparagus|corn|fruit|veg(etables?)?)\b/],
  ];

  function guessType(text) {
    const t = ` ${text.toLowerCase()} `;
    for (const [type, pattern] of TYPE_KEYWORDS) {
      if (pattern.test(t)) return type;
    }
    return 'other';
  }

  // The type a food item counts as: what the person chose, or a guess from its name.
  function typeOf(item) {
    return TYPE_INFO[item.type] ? item.type : guessType(item.name);
  }

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
          if (!Array.isArray(parsed.members)) parsed.members = [];
          return parsed;
        }
      }
    } catch (e) { /* fall through to defaults */ }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
    pushToHousehold();
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

  // "Use by" is about safety, so it warns; "best before" is only about quality, so it doesn't.
  // Items saved before this choice existed count as use by.
  const isBestBefore = (item) => item.dateKind === 'best';
  const USE_BY_TYPES = ['meat', 'dairy'];
  const defaultDateKind = (type) => (USE_BY_TYPES.includes(type) ? 'useby' : 'best');

  // Days until a use-by date, or null when there's nothing to warn about.
  function warnDays(item) {
    return isBestBefore(item) ? null : daysUntil(item.expiry);
  }

  function shortDate(iso) {
    const date = new Date(iso + 'T00:00:00');
    const opts = { day: 'numeric', month: 'short' };
    if (date.getFullYear() !== today().getFullYear()) opts.year = 'numeric';
    return date.toLocaleDateString(undefined, opts);
  }

  function expiryInfo(item) {
    const days = daysUntil(item.expiry);
    if (days === null) return { days: null, cls: '', text: 'No date' };
    if (isBestBefore(item)) {
      return { days, cls: 'best', text: days < 0 ? `Past best before (${shortDate(item.expiry)})` : `Best before ${shortDate(item.expiry)}` };
    }
    if (days < 0) return { days, cls: 'bad', text: `Gone off ${-days} day${days === -1 ? '' : 's'} ago` };
    if (days === 0) return { days, cls: 'bad', text: 'Goes off today' };
    if (days === 1) return { days, cls: 'warn', text: 'Goes off tomorrow' };
    if (days <= SOON_DAYS) return { days, cls: 'warn', text: `Goes off in ${days} days` };
    return { days, cls: 'ok', text: `Use by ${shortDate(item.expiry)}` };
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
      // Use-by dates first, then best-before dates, then undated items.
      const key = (i) => {
        const d = daysUntil(i.expiry);
        if (d === null) return Infinity;
        return isBestBefore(i) ? 100000 + d : d;
      };
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
    renderProfileButton();
    renderHousehold();
    renderToday();
  }

  function renderStats() {
    let soon = 0, expired = 0, low = 0;
    for (const item of data.items) {
      const d = warnDays(item);
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
      .map((item) => ({ item, days: warnDays(item) }))
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
    const typeFilter = $('#type-filter').value;
    const filtering = query || typeFilter;
    container.replaceChildren();
    $('#places-empty').hidden = data.places.length > 0;

    for (const place of data.places) {
      const all = data.items.filter((i) => i.placeId === place.id);
      const shown = sortItems(all.filter((i) =>
        (!query || i.name.toLowerCase().includes(query) || (i.notes || '').toLowerCase().includes(query))
        && (!typeFilter || typeOf(i) === typeFilter)));
      if (filtering && shown.length === 0) continue;

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
      el('div', { class: 'item-name' }, addedByAvatar(item), item.name,
        item.notes ? el('span', { class: 'item-notes' }, ` – ${item.notes}`) : null),
      el('div', { class: 'item-actions' },
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Use one', 'aria-label': `Use one ${item.name}`, onclick: () => useSome(item) }, '−1'),
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit', 'aria-label': `Edit ${item.name}`, onclick: () => openItemDialog(item) }, '✎'),
      ),
      el('div', { class: 'item-meta' },
        el('span', { class: `badge ${exp.cls}` }, exp.text),
        el('span', { class: `badge ${low ? 'low' : ''}` }, amountText(item)),
        el('span', { class: 'badge type-badge' }, `${TYPE_INFO[typeOf(item)].icon} ${TYPE_INFO[typeOf(item)].label}`),
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
  // Treat singular and plural the same ("pepper" / "peppers", "potato" / "potatoes").
  function singular(text) {
    return text.toLowerCase().replace(/(\w{3,}?)(es|s)\b/g, (word, stem, end) =>
      (end === 'es' && /(o|ch|sh|x|ss)$/.test(stem) ? stem : end === 'es' ? `${stem}e` : stem)).trim();
  }

  function stockFor(line) {
    const name = singular(ingredientName(line));
    const full = singular(line);
    if (name.length < 3) return null;
    const matches = data.items.filter((item) => {
      const food = singular(item.name.trim());
      if (item.qty <= 0 || food.length < 3) return false;
      return full.includes(food) || food.includes(name);
    });
    if (!matches.length) return null;
    return matches.find((i) => { const d = warnDays(i); return d === null || d >= 0; }) || matches[0];
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
    const kind = $('#recipe-kind').value;
    const cat = $('#recipe-cat').value;
    renderCategoryFilter();
    const sort = $('#recipe-sort').value;
    container.replaceChildren();

    let list = data.recipes
      .filter((r) => !level || r.difficulty === level)
      .filter((r) => !kind || kindOf(r) === kind)
      .filter((r) => !cat || (cat === '@season' ? tagsOf(r).includes(currentSeason()) : tagsOf(r).includes(cat)))
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
      .filter((l) => l && !/^(#\w+\s*)+$/.test(l) && !/^https?:\/\//.test(l))
      .map((l) => l.replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '').trim())
      .filter(Boolean);
    const isIngredientsHead = (l) => /^[^a-z0-9]*ingredients?\b[^a-z0-9]*:?\s*$/i.test(l);
    const isMethodHead = (l) => /^[^a-z0-9]*(method|instructions|directions|steps|how to make( it)?|preparation)\b[^a-z0-9]*:?\s*$/i.test(l);
    const looksLikeIngredient = (l) => /^[•●▪◦*·\-–—]/.test(l) ||
      (/^[\d½¼¾⅓⅔]/.test(l) && !/^\d+[.)]\s/.test(l) && l.length <= 70);
    const looksLikeStep = (l) => /^(step\s*)?\d+[.):]\s/i.test(l) || l.length > 70;

    let name = '';
    let labelledName = false;
    let difficulty = null;
    let time = null;
    let tags = [];
    const ingredients = [];
    const method = [];
    let section = null;
    for (const line of lines) {
      const label = line.match(/^(name|recipe|difficulty|(?:total\s+)?time|categories|category|tags)\s*:\s*(.+)$/i);
      if (label && section !== 'method') {
        const key = label[1].toLowerCase();
        if (key === 'name' || key === 'recipe') { name = clean(label[2]); labelledName = true; }
        else if (key === 'difficulty') difficulty = (label[2].match(/easy|medium|hard/i) || [''])[0].toLowerCase() || null;
        else if (/^(categories|category|tags)$/.test(key)) tags = label[2].split(/[,;/]/).map(categoryFor).filter(Boolean);
        else time = parseMinutes(label[2]);
        continue;
      }
      if (isIngredientsHead(line)) { section = 'ingredients'; continue; }
      if (isMethodHead(line)) { section = 'method'; continue; }
      if (section === 'ingredients') ingredients.push(clean(line));
      else if (section === 'method') method.push(line);
      else if (!name && !looksLikeIngredient(line) && !looksLikeStep(line)) name = clean(line);
      else if (looksLikeIngredient(line)) ingredients.push(clean(line));
      else if (looksLikeStep(line)) method.push(line);
    }
    return { name: name.slice(0, 100), labelledName, difficulty, time, tags, ingredients: ingredients.filter(Boolean), method: method.join('\n') };
  }

  // "1 hr 30 min", "45 minutes", "1.5 hours" -> minutes.
  function parseMinutes(text) {
    const hours = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i);
    const mins = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/i);
    let total = (hours ? parseFloat(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
    if (!hours && !mins) total = parseInt(text, 10) || 0;
    return total > 0 ? Math.round(total) : null;
  }

  function renderRecipe(recipe, stock) {
    const allIn = stock.total > 0 && stock.have === stock.total;
    const ingredients = el('ul', { class: 'ingredients' }, stock.lines.map(({ line, item }) => {
      const off = item && warnDays(item) !== null && warnDays(item) < 0;
      return el('li', { class: item ? `have${off ? ' off' : ''}` : '', title: item ? `In stock: ${item.name}` : 'Not in stock' },
        el('span', { class: 'mark', 'aria-label': item ? 'In stock' : 'Not in stock' }, item ? '✓' : '○'),
        el('span', {}, line, off ? el('span', { class: 'muted' }, ' (gone off)') : null));
    }));

    return el('article', { class: 'recipe' },
      el('div', { class: 'recipe-head' },
        el('h3', {}, addedByAvatar(recipe), recipe.name),
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit recipe', 'aria-label': `Edit ${recipe.name}`, onclick: () => openRecipeDialog(recipe) }, '✎'),
      ),
      el('div', { class: 'recipe-meta' },
        kindOf(recipe) !== 'meal' ? el('span', { class: 'badge kind-badge' }, `${KIND_INFO[kindOf(recipe)].icon} ${KIND_INFO[kindOf(recipe)].label}`) : null,
        el('span', { class: `badge ${recipe.difficulty}` }, DIFFICULTY[recipe.difficulty]),
        recipe.time ? el('span', { class: 'badge' }, `⏱ ${timeText(recipe.time)}`) : null,
        stock.total
          ? el('span', { class: `badge ${allIn ? 'have-all' : ''}` },
              allIn ? 'You have everything' : `You have ${stock.have} of ${stock.total} ingredients`)
          : el('span', { class: 'badge' }, 'No ingredients added yet'),
      ),
      tagsOf(recipe).length
        ? el('div', { class: 'cat-chips' },
            tagsOf(recipe).includes(currentSeason()) ? el('span', { class: 'cat-chip in-season' }, 'In season') : null,
            tagsOf(recipe).map((tag) => el('span', { class: 'cat-chip' }, catLabel(tag))))
        : null,
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
    setClaudeStatus('');
    $('#recipe-name').value = recipe?.name ?? shared?.name ?? '';
    $('#recipe-level').value = recipe?.difficulty ?? 'easy';
    $('#recipe-course').value = recipe ? kindOf(recipe) : 'meal';
    pendingTags = new Set(recipe ? tagsOf(recipe) : []);
    $('#cat-custom').value = '';
    $('#cat-picker').open = false;
    renderCategoryPicker();
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
      course: $('#recipe-course').value,
      tags: [...pendingTags],
      time: time > 0 ? time : null,
      ingredients: $('#recipe-ingredients').value.split('\n').map((l) => l.trim()).filter(Boolean),
      method: $('#recipe-method').value.trim(),
    };
    if (!fields.name) return;
    const existing = id && data.recipes.find((r) => r.id === id);
    if (existing) Object.assign(existing, fields);
    else data.recipes.push({ id: uid(), addedBy: myId(), ...fields });
    save();
    renderRecipes();
    renderPlan();
  });

  $('#recipe-delete').addEventListener('click', () => {
    const id = $('#recipe-id').value;
    const recipe = data.recipes.find((r) => r.id === id);
    if (recipe && confirm(`Delete the ${recipe.name} recipe?`)) {
      data.recipes = data.recipes.filter((r) => r.id !== id);
      for (const [date, day] of Object.entries(data.plan)) {
        for (const meal of Object.keys(day)) {
          const left = slotIds(day, meal).filter((x) => x !== id);
          if (left.length) day[meal] = left;
          else delete day[meal];
        }
        if (!Object.keys(day).length) delete data.plan[date];
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
    if (parsed.name && (parsed.labelledName || !$('#recipe-name').value.trim())) $('#recipe-name').value = parsed.name;
    if (parsed.difficulty) $('#recipe-level').value = parsed.difficulty;
    if (parsed.time) $('#recipe-time').value = parsed.time;
    if (parsed.tags.length) {
      parsed.tags.forEach((tag) => pendingTags.add(tag));
      renderCategoryPicker();
    }
    if (parsed.ingredients.length) $('#recipe-ingredients').value = parsed.ingredients.join('\n');
    if (parsed.method) $('#recipe-method').value = parsed.method;
    if (!parsed.ingredients.length && !parsed.method) {
      alert("Couldn't find ingredients or steps in that text. You can still type them in below.");
      return;
    }
    $('#recipe-import').open = false;
    setClaudeStatus('');
    $('#recipe-name').focus();
  });

  // ---------- Ask Claude (free, through the Claude app) ----------

  function setClaudeStatus(text) {
    const box = $('#recipe-claude-status');
    box.textContent = text;
    box.hidden = !text;
  }

  function claudeRequest() {
    const url = firstUrl($('#recipe-source').value);
    const name = $('#recipe-name').value.trim();
    const pasted = $('#recipe-paste-text').value.trim();
    const parts = ['Please write this up as a recipe for my recipe app.'];
    if (url) parts.push(`Link: ${url}`);
    if (name) parts.push(`Title: ${name}`);
    if (pasted) parts.push(`Caption / text from the post:\n${pasted}`);
    parts.push(`Find the creator's actual recipe if you can (the caption, or a recipe page the post links to). If you can't, write a reliable version of the dish and tell me in one line after the method. Use UK measurements (grams, ml, spoons).

Reply with only the recipe in exactly this layout, as plain text with no bold, headings or intro:

Name: <recipe name>
Difficulty: <Easy, Medium or Hard>
Time: <total minutes> minutes
Categories: <the ones that fit, comma separated, from: ${CATEGORY_GROUPS.flatMap(([, cats]) => cats.map(([, , label]) => label)).join(', ')}>
Ingredients:
- <amount and ingredient>
Method:
1. <step>`);
    return parts.join('\n\n');
  }

  $('#recipe-claude').addEventListener('click', async () => {
    const url = firstUrl($('#recipe-source').value);
    if (!url && !$('#recipe-name').value.trim() && !$('#recipe-paste-text').value.trim()) {
      setClaudeStatus('Add the link first (or the recipe name or caption), then tap Copy for Claude.');
      $('#recipe-source').focus();
      return;
    }
    const text = claudeRequest();
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      prompt('Copy this, then paste it into Claude:', text);
    }
    $('#recipe-paste-text').value = '';
    $('#recipe-import').open = true;
    setClaudeStatus('Copied. Open Claude, paste and send. Then copy Claude’s reply, paste it in the box below and tap Fill in from text.');
  });

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
  }
  $('#recipe-search').addEventListener('input', renderRecipes);
  $('#recipe-difficulty').addEventListener('change', renderRecipes);
  $('#recipe-kind').append(...KINDS.map(([id, icon, , plural]) => el('option', { value: id }, `${icon} ${plural}`)));
  $('#recipe-kind').addEventListener('change', renderRecipes);
  $('#recipe-course').replaceChildren(...KINDS.map(([id, icon, label]) => el('option', { value: id }, `${icon} ${label}`)));

  // Category picker in the recipe form.
  let pendingTags = new Set();

  function renderCategoryPicker() {
    const toggle = (tag) => {
      if (pendingTags.has(tag)) pendingTags.delete(tag); else pendingTags.add(tag);
      renderCategoryPicker();
    };
    const chip = (tag, text) => el('button', { type: 'button', class: `cat-option ${pendingTags.has(tag) ? 'selected' : ''}`, 'aria-pressed': String(pendingTags.has(tag)), onclick: () => toggle(tag) }, text);
    const custom = [...new Set([...data.recipes.flatMap(tagsOf), ...pendingTags])].filter((t) => !CATEGORY_INFO[t]).sort();
    $('#cat-groups').replaceChildren(
      ...CATEGORY_GROUPS.flatMap(([group, cats]) => [
        el('p', { class: 'picker-group' }, group),
        el('div', { class: 'cat-options' }, cats.map(([id, icon, label]) => chip(id, `${icon} ${label}`))),
      ]),
      ...(custom.length ? [el('p', { class: 'picker-group' }, 'Your own'), el('div', { class: 'cat-options' }, custom.map((t) => chip(t, `🏷️ ${t}`)))] : []));
    const chosen = [...pendingTags];
    $('#cat-summary').textContent = chosen.length ? chosen.map(catLabel).join('  ') : 'None yet';
  }

  function addCustomCategory() {
    const tag = categoryFor($('#cat-custom').value);
    if (!tag) return;
    pendingTags.add(tag);
    $('#cat-custom').value = '';
    renderCategoryPicker();
  }
  $('#cat-add').addEventListener('click', addCustomCategory);
  $('#cat-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } });

  // Category filter on the Recipes tab (built-in ones, plus any of the household's own in use).
  function renderCategoryFilter() {
    const select = $('#recipe-cat');
    const current = select.value;
    const season = currentSeason();
    const custom = [...new Set(data.recipes.flatMap(tagsOf))].filter((t) => !CATEGORY_INFO[t]).sort();
    select.replaceChildren(
      el('option', { value: '' }, 'All categories'),
      el('option', { value: '@season' }, `${CATEGORY_INFO[season].icon} In season now (${CATEGORY_INFO[season].label})`),
      ...CATEGORY_GROUPS.map(([group, cats]) => el('optgroup', { label: group }, cats.map(([id, icon, label]) => el('option', { value: id }, `${icon} ${label}`)))),
      custom.length ? el('optgroup', { label: 'Your own' }, custom.map((t) => el('option', { value: t }, `🏷️ ${t}`))) : null);
    select.value = [...select.options].some((o) => o.value === current) ? current : '';
  }
  $('#recipe-cat').addEventListener('change', renderRecipes);
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

  // A meal slot holds a list of recipe ids (a full meal, or several parts like a main and
  // sides). Plans saved before this held a single id, which reads as a list of one.
  function slotIds(day, meal) {
    const value = day && day[meal];
    return Array.isArray(value) ? value : value ? [value] : [];
  }

  function plannedRecipes() {
    const list = [];
    for (const d of weekDays()) {
      const day = data.plan[isoDate(d)] || {};
      for (const [meal] of MEALS) {
        for (const id of slotIds(day, meal)) {
          const recipe = data.recipes.find((r) => r.id === id);
          if (recipe) list.push(recipe);
        }
      }
    }
    return list;
  }

  function setSlot(date, meal, ids) {
    const day = data.plan[date] || (data.plan[date] = {});
    if (ids.length) day[meal] = ids;
    else delete day[meal];
    if (!Object.keys(day).length) delete data.plan[date];
    save();
    renderPlan();
  }

  function addDish(date, meal, recipeId) {
    const ids = slotIds(data.plan[date], meal);
    if (recipeId && !ids.includes(recipeId)) setSlot(date, meal, [...ids, recipeId]);
    else renderPlan();
  }

  function removeDish(date, meal, recipeId) {
    setSlot(date, meal, slotIds(data.plan[date], meal).filter((id) => id !== recipeId));
  }

  // Picker of saved recipes, grouped by kind, leaving out what's already in the slot.
  function dishPicker(id, chosenIds, onPick) {
    const groups = KINDS.map(([kind, icon, , plural]) => {
      const options = data.recipes.filter((r) => kindOf(r) === kind && !chosenIds.includes(r.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      return options.length
        ? el('optgroup', { label: `${icon} ${plural}` }, options.map((r) => el('option', { value: r.id }, r.name)))
        : null;
    }).filter(Boolean);
    const placeholder = !data.recipes.length ? 'No recipes saved'
      : chosenIds.length ? '+ Add another part…' : 'Choose a meal…';
    const select = el('select', { id, class: `dish-picker ${chosenIds.length ? 'more' : 'empty'}`, onchange: (e) => onPick(e.target.value) },
      el('option', { value: '' }, placeholder), groups);
    select.value = '';
    if (!groups.length && chosenIds.length) select.hidden = true;
    return select;
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
        const chosenIds = slotIds(day, meal).filter((rid) => recipes.some((r) => r.id === rid));
        const dishes = chosenIds.map((rid) => {
          const recipe = recipes.find((r) => r.id === rid);
          const stock = recipeStock(recipe);
          const kind = kindOf(recipe);
          return el('li', { class: 'dish' },
            el('div', { class: 'dish-main' },
              el('span', { class: 'dish-name' }, recipe.name),
              el('div', { class: 'slot-meta' },
                kind !== 'meal' ? el('span', { class: 'badge kind-badge' }, `${KIND_INFO[kind].icon} ${KIND_INFO[kind].label}`) : null,
                el('span', { class: `badge ${recipe.difficulty}` }, DIFFICULTY[recipe.difficulty]),
                recipe.time ? el('span', { class: 'badge' }, `⏱ ${timeText(recipe.time)}`) : null,
                stock.total ? el('span', { class: `badge ${stock.have === stock.total ? 'have-all' : ''}` }, `${stock.have}/${stock.total} in stock`) : null)),
            el('button', { type: 'button', class: 'btn btn-icon dish-remove', title: `Remove ${recipe.name}`, 'aria-label': `Remove ${recipe.name} from ${label.toLowerCase()}`, onclick: () => removeDish(date, meal, rid) }, '×'));
        });
        return el('div', { class: 'slot' },
          el('label', { for: id }, label),
          dishes.length ? el('ul', { class: 'dishes' }, dishes) : null,
          dishPicker(id, chosenIds, (rid) => addDish(date, meal, rid)));
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

  // Ingredients for the given meals (this week's by default) that aren't in stock, merged by line.
  function shoppingList(recipes = plannedRecipes()) {
    const needed = new Map();
    for (const recipe of recipes) {
      for (const line of recipe.ingredients) {
        if (stockFor(line)) continue;
        const key = line.toLowerCase();
        if (!needed.has(key)) needed.set(key, { line, type: guessType(line), recipes: new Set() });
        needed.get(key).recipes.add(recipe.name);
      }
    }
    const order = FOOD_TYPES.map(([id]) => id);
    return [...needed.values()].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  function shoppingByType(list) {
    return FOOD_TYPES.map(([id, icon, label]) => ({ icon, label, lines: list.filter((x) => x.type === id) }))
      .filter((group) => group.lines.length);
  }

  function renderShopping() {
    const list = shoppingList();
    const planned = plannedRecipes().length;
    $('#shopping').replaceChildren(...shoppingByType(list).map(({ icon, label, lines }) =>
      el('li', { class: 'shopping-group' },
        el('h3', {}, `${icon} ${label}`),
        el('ul', {}, lines.map(({ line, recipes }) =>
          el('li', {}, line, el('span', { class: 'for' }, ` · for ${[...recipes].join(', ')}`)))))));
    $('#shopping-empty').hidden = list.length > 0;
    $('#shopping-empty').textContent = planned
      ? 'You already have everything for this week’s meals.'
      : 'Pick some meals above and anything you don’t have in stock will be listed here.';
    $('#copy-shopping').hidden = list.length === 0;
  }

  $('#copy-shopping').addEventListener('click', async () => {
    const text = shoppingByType(shoppingList())
      .map(({ icon, label, lines }) => `${icon} ${label}\n${lines.map(({ line }) => `- ${line}`).join('\n')}`)
      .join('\n\n');
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

  // ---------- Today (dashboard) ----------

  const TICKS_KEY = 'wdywfd-shopping-ticks';
  let dashOffset = 1;   // which day the day-by-day card shows, in days from today

  function addDays(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function dayRecipes(date, meal) {
    return slotIds(data.plan[isoDate(date)], meal)
      .map((id) => data.recipes.find((r) => r.id === id))
      .filter(Boolean);
  }

  function dayLabel(offset, date) {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  // One meal (breakfast, lunch or dinner) with its dishes, or a prompt to plan it.
  function mealBlock(date, meal, label, highlight) {
    const dishes = dayRecipes(date, meal);
    return el('div', { class: `dash-meal ${highlight ? 'next' : ''} ${dishes.length ? '' : 'empty'}` },
      el('div', { class: 'dash-meal-head' },
        el('span', { class: 'dash-meal-label' }, label),
        highlight ? el('span', { class: 'next-tag' }, 'Next up') : null),
      dishes.length
        ? el('ul', { class: 'dash-dishes' }, dishes.map((r) => {
            const stock = recipeStock(r);
            const kind = kindOf(r);
            return el('li', {},
              el('button', { type: 'button', class: 'dash-dish', onclick: () => openRecipeView(r) },
                el('span', { class: 'dash-dish-name' }, kind !== 'meal' ? `${KIND_INFO[kind].icon} ` : '', r.name),
                el('span', { class: 'dash-dish-meta' },
                  r.time ? `⏱ ${timeText(r.time)}` : '',
                  stock.total ? el('span', { class: stock.have === stock.total ? 'ok-text' : '' },
                    `${r.time ? ' · ' : ''}${stock.have === stock.total ? 'All in stock' : `${stock.have}/${stock.total} in stock`}`) : null)));
          }))
        : el('button', { type: 'button', class: 'btn btn-small', onclick: () => { weekStart = mondayOf(date); showTab('plan'); renderPlan(); } }, 'Plan it'));
  }

  function renderToday() {
    const now = new Date();
    const hour = now.getHours();
    // After 9pm the "today" card looks ahead to tomorrow.
    const lateEvening = hour >= 21;
    const day = lateEvening ? addDays(now, 1) : addDays(now, 0);
    const nextMeal = lateEvening || hour < 10 ? 'breakfast' : hour < 15 ? 'lunch' : 'dinner';
    $('#today-title').textContent = lateEvening ? 'Tomorrow’s meals' : 'Today’s meals';
    $('#today-date').textContent = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const nextIndex = MEALS.findIndex(([m]) => m === nextMeal);
    $('#today-meals').replaceChildren(...MEALS.map(([meal, label], i) =>
      i < nextIndex && !lateEvening
        ? null
        : mealBlock(day, meal, label, meal === nextMeal)).filter(Boolean));
    $('#today-earlier').hidden = lateEvening || nextIndex === 0;
    $('#today-earlier').textContent = nextIndex === 1 ? 'Breakfast is done for today.' : 'Breakfast and lunch are done for today.';

    renderDayByDay();
    renderWarnings();
    renderDashShopping();
  }

  function renderDayByDay() {
    const base = addDays(new Date(), 0);
    const weekFirst = Math.floor(dashOffset / 7) * 7;
    $('#dash-days').replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const offset = weekFirst + i;
      const date = addDays(base, offset);
      const planned = MEALS.some(([meal]) => dayRecipes(date, meal).length);
      return el('button', { type: 'button', class: `day-chip ${offset === dashOffset ? 'selected' : ''}`, 'aria-pressed': String(offset === dashOffset), onclick: () => { dashOffset = offset; renderDayByDay(); } },
        el('span', { class: 'day-chip-name' }, offset === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' })),
        el('span', { class: 'day-chip-date' }, date.getDate()),
        el('span', { class: `day-chip-dot ${planned ? 'on' : ''}`, 'aria-label': planned ? 'Meals planned' : 'Nothing planned' }));
    }));
    $('#dash-prev').disabled = weekFirst <= 0;
    const date = addDays(base, dashOffset);
    $('#dash-day-title').textContent = dayLabel(dashOffset, date);
    $('#dash-day-meals').replaceChildren(...MEALS.map(([meal, label]) => mealBlock(date, meal, label, false)));
  }

  $('#dash-prev').addEventListener('click', () => { dashOffset = Math.max(0, Math.floor(dashOffset / 7) * 7 - 7); renderDayByDay(); });
  $('#dash-next').addEventListener('click', () => { dashOffset = Math.floor(dashOffset / 7) * 7 + 7; renderDayByDay(); });

  function renderWarnings() {
    const urgent = data.items
      .map((item) => ({ item, days: warnDays(item) }))
      .filter((x) => x.days !== null && x.days <= SOON_DAYS)
      .sort((a, b) => a.days - b.days);
    $('#dash-warnings').replaceChildren(...urgent.map(({ item, days }) => {
      const place = data.places.find((p) => p.id === item.placeId);
      const exp = expiryInfo(item);
      return el('li', { class: `warn-row ${days < 0 ? 'gone' : ''}` },
        el('div', { class: 'warn-info' },
          el('span', { class: 'warn-name' }, item.name),
          el('span', { class: 'muted warn-where' }, `${place ? place.name : ''}${place ? ' · ' : ''}${amountText(item)}`)),
        el('span', { class: `badge ${exp.cls}` }, exp.text),
        el('button', { type: 'button', class: 'btn btn-small', title: `Remove ${item.name}`, onclick: () => {
          if (!confirm(`Remove ${item.name} from your food?`)) return;
          data.items = data.items.filter((i) => i.id !== item.id);
          save();
          render();
        } }, days < 0 ? 'Bin it' : 'Used it'));
    }));
    $('#dash-warnings-empty').hidden = urgent.length > 0;
    $('#dash-warn-count').textContent = urgent.length ? String(urgent.length) : '';
    $('#dash-warn-count').hidden = !urgent.length;

    const low = data.items.filter(isLow);
    $('#dash-low-wrap').hidden = low.length === 0;
    $('#dash-low').replaceChildren(...low.map((item) => el('li', {}, item.name, el('span', { class: 'muted' }, ` · ${amountText(item)}`))));
  }

  function loadTicks() {
    try { return JSON.parse(localStorage.getItem(TICKS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveTicks(ticks) {
    try { localStorage.setItem(TICKS_KEY, JSON.stringify(ticks)); } catch (e) { /* storage unavailable */ }
  }

  // Shopping for the next 7 days of planned meals.
  function upcomingShopping() {
    const recipes = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(new Date(), i);
      for (const [meal] of MEALS) recipes.push(...dayRecipes(date, meal));
    }
    return { list: shoppingList(recipes), planned: recipes.length };
  }

  function renderDashShopping() {
    const { list, planned } = upcomingShopping();
    const ticks = loadTicks();
    // Forget ticks for things no longer on the list.
    const keys = new Set(list.map(({ line }) => line.toLowerCase()));
    for (const key of Object.keys(ticks)) if (!keys.has(key)) delete ticks[key];
    saveTicks(ticks);

    const left = list.filter(({ line }) => !ticks[line.toLowerCase()]).length;
    $('#dash-shop-count').textContent = list.length ? `${left} to get` : '';
    $('#dash-shopping').replaceChildren(...shoppingByType(list).map(({ icon, label, lines }) =>
      el('li', { class: 'shopping-group' },
        el('h4', {}, `${icon} ${label}`),
        el('ul', { class: 'tick-list' }, lines.map(({ line, recipes }) => {
          const key = line.toLowerCase();
          const id = `tick-${key.replace(/[^a-z0-9]+/g, '-')}`;
          return el('li', { class: ticks[key] ? 'done' : '' },
            el('input', { type: 'checkbox', id, checked: ticks[key] ? 'checked' : null, onchange: (e) => {
              const now = loadTicks();
              if (e.target.checked) now[key] = true; else delete now[key];
              saveTicks(now);
              renderDashShopping();
            } }),
            el('label', { for: id }, line, el('span', { class: 'for' }, ` · ${[...recipes].join(', ')}`)));
        })))));
    $('#dash-shopping-empty').hidden = list.length > 0;
    $('#dash-shopping-empty').textContent = planned
      ? 'You already have everything for the next 7 days of meals.'
      : 'Plan some meals and anything you need for the next 7 days will show up here.';
    $('#dash-copy').hidden = left === 0;
  }

  $('#dash-copy').addEventListener('click', async () => {
    const ticks = loadTicks();
    const list = upcomingShopping().list.filter(({ line }) => !ticks[line.toLowerCase()]);
    const text = shoppingByType(list)
      .map(({ icon, label, lines }) => `${icon} ${label}\n${lines.map(({ line }) => `- ${line}`).join('\n')}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      $('#dash-copy').textContent = 'Copied';
      setTimeout(() => { $('#dash-copy').textContent = 'Copy list'; }, 1500);
    } catch (e) {
      prompt('Copy your shopping list:', text);
    }
  });

  // Read-only recipe, opened from the dashboard (handy while cooking).
  const recipeView = $('#recipe-view');
  let viewing = null;

  function openRecipeView(recipe) {
    viewing = recipe;
    const card = renderRecipe(recipe, recipeStock(recipe));
    const details = card.querySelector('details');
    if (details) details.open = true;
    card.querySelector('.recipe-head button')?.remove();
    $('#recipe-view-body').replaceChildren(card);
    recipeView.showModal();
  }

  $('#recipe-view-edit').addEventListener('click', () => {
    recipeView.close();
    if (viewing) openRecipeDialog(viewing);
  });

  // ---------- Tabs ----------

  const TABS = ['today', 'food', 'recipes', 'plan', 'home'];

  function showTab(name) {
    for (const tab of TABS) {
      $(`#tab-${tab}`).setAttribute('aria-selected', String(tab === name));
      $(`#${tab}-view`).hidden = tab !== name;
    }
    if (name === 'home') renderHousehold();
  }

  // The app always opens on Today, the dashboard.
  for (const tab of TABS) $(`#tab-${tab}`).addEventListener('click', () => showTab(tab));

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
    // A new item's type follows the name until the person picks one themselves.
    typeChosen = !!(item && TYPE_INFO[item.type]);
    $('#item-type').value = item ? typeOf(item) : 'other';
    $('#item-place').value = item?.placeId ?? placeId ?? data.places[0].id;
    $('#item-expiry').value = item?.expiry ?? '';
    // A new item's date type follows its food type until the person picks one.
    dateKindChosen = !!item;
    $('#item-datekind').value = item ? (isBestBefore(item) ? 'best' : 'useby') : defaultDateKind($('#item-type').value);
    $('#item-qty').value = item ? fmtNum(item.qty) : '1';
    $('#item-unit').value = item?.unit ?? '';
    $('#item-full').value = item?.full ? fmtNum(item.full) : '';
    $('#item-notes').value = item?.notes ?? '';
    $('#item-delete').hidden = !item;
    itemDialog.showModal();
    $('#item-name').focus();
  }

  let typeChosen = false;
  $('#item-type').replaceChildren(...FOOD_TYPES.map(([id, icon, label]) => el('option', { value: id }, `${icon} ${label}`)));
  let dateKindChosen = false;
  const followType = () => { if (!dateKindChosen) $('#item-datekind').value = defaultDateKind($('#item-type').value); };
  $('#item-type').addEventListener('change', () => { typeChosen = true; followType(); });
  $('#item-datekind').addEventListener('change', () => { dateKindChosen = true; });
  $('#item-name').addEventListener('input', () => {
    if (!typeChosen) $('#item-type').value = guessType($('#item-name').value);
    followType();
  });

  $('#item-form').addEventListener('submit', () => {
    const id = $('#item-id').value;
    const full = parseFloat($('#item-full').value);
    const fields = {
      name: $('#item-name').value.trim(),
      type: $('#item-type').value,
      placeId: $('#item-place').value,
      expiry: $('#item-expiry').value || null,
      dateKind: $('#item-datekind').value,
      qty: Math.max(0, parseFloat($('#item-qty').value) || 0),
      unit: $('#item-unit').value.trim(),
      full: full > 0 ? full : null,
      notes: $('#item-notes').value.trim(),
    };
    if (!fields.name) return;
    if (id) Object.assign(data.items.find((i) => i.id === id), fields);
    else data.items.push({ id: uid(), addedBy: myId(), ...fields });
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
  $('#type-filter').append(...FOOD_TYPES.map(([id, icon, label]) => el('option', { value: id }, `${icon} ${label}`)));
  $('#type-filter').addEventListener('change', renderPlaces);

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
      if (!Array.isArray(parsed.members)) parsed.members = [];
      if (!confirm('Replace your current food list, recipes and meal plan with the imported ones?')) return;
      data = parsed;
      save();
      render();
    } catch (err) {
      alert('That file could not be imported.');
    }
  });

  // ---------- Profiles ----------
  //
  // Everyone in the household has a profile (name, photo) in data.members. Which profile is
  // "me" is remembered per device, so each phone can pick its owner.

  const ME_KEY = 'wdywfd-me';
  const AVATAR_COLOURS = ['#2f7a4f', '#3a6ea5', '#b7791f', '#b83232', '#7a4fa0', '#1f8a8a', '#a0527a', '#5a6b2f'];

  function myId() {
    try { return localStorage.getItem(ME_KEY) || null; } catch (e) { return null; }
  }

  function me() {
    const id = myId();
    return id ? data.members.find((m) => m.id === id) || null : null;
  }

  function setMe(id) {
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  }

  function colourFor(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
  }

  function avatar(member, size) {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${colourFor(member.id)}`;
    return member.photo
      ? el('img', { class: 'avatar', src: member.photo, alt: '', style })
      : el('span', { class: 'avatar', style, 'aria-hidden': 'true' }, initials(member.name));
  }

  function addedByAvatar(entry) {
    const member = entry.addedBy && data.members.find((m) => m.id === entry.addedBy);
    if (!member) return null;
    return el('span', { class: 'added-by', title: `Added by ${member.name}`, 'aria-label': `Added by ${member.name}` }, avatar(member, 20));
  }

  function renderProfileButton() {
    const btn = $('#profile-btn');
    const mine = me();
    btn.replaceChildren(...(mine
      ? [avatar(mine, 26), el('span', {}, mine.name)]
      : [el('span', { class: 'avatar avatar-empty', style: 'width:26px;height:26px' }, '?'), el('span', {}, 'Who are you?')]));
  }

  const whoDialog = $('#who-dialog');

  function renderWhoList() {
    const list = $('#who-list');
    const mineId = myId();
    list.replaceChildren(...data.members.map((m) =>
      el('li', {},
        el('button', { type: 'button', class: `who-person ${m.id === mineId ? 'selected' : ''}`, 'aria-pressed': String(m.id === mineId), onclick: () => { setMe(m.id); render(); whoDialog.close(); } },
          avatar(m, 56), el('span', { class: 'who-name' }, m.name), m.id === mineId ? el('span', { class: 'who-me' }, 'This is you') : null),
        el('button', { type: 'button', class: 'btn btn-icon who-edit', title: `Edit ${m.name}`, 'aria-label': `Edit ${m.name}`, onclick: () => openProfileForm(m) }, '✎'))));
    $('#who-empty').hidden = data.members.length > 0;
  }

  function openWhoDialog() {
    renderWhoList();
    if (!whoDialog.open) whoDialog.showModal();
  }

  const profileDialog = $('#profile-dialog');
  let pendingPhoto;   // undefined = unchanged, null = removed, string = new photo

  function showPhotoPreview(member) {
    const stand = {
      id: member?.id || 'new',
      name: $('#profile-name').value || member?.name || '?',
      photo: pendingPhoto === undefined ? member?.photo : pendingPhoto,
    };
    $('#profile-photo-preview').replaceChildren(avatar(stand, 72));
    $('#profile-photo-remove').hidden = !stand.photo;
    for (const btn of document.querySelectorAll('#avatar-picker button')) {
      const chosen = btn.dataset.url === stand.photo;
      btn.classList.toggle('selected', chosen);
      btn.setAttribute('aria-pressed', String(chosen));
    }
  }

  // The built-in food characters (avatars.js), stored like any other photo once picked.
  const CHARACTERS = window.DEFAULT_AVATARS || [];

  const characterGroups = [...new Set(CHARACTERS.map((c) => c.group || 'Characters'))];
  $('#avatar-picker').replaceChildren(...characterGroups.flatMap((group) => [
    el('p', { class: 'picker-group' }, group),
    el('div', { class: 'avatar-grid', role: 'group', 'aria-label': group },
      CHARACTERS.filter((c) => (c.group || 'Characters') === group).map((c) =>
        el('button', { type: 'button', class: 'avatar-option', 'data-url': c.url, title: c.name, 'aria-label': c.name, 'aria-pressed': 'false',
          onclick: () => { pendingPhoto = c.url; showPhotoPreview(editingMember()); } },
          el('img', { src: c.url, alt: '' })))),
  ]));
  $('#avatar-picker').hidden = CHARACTERS.length === 0;

  function openProfileForm(member) {
    $('#profile-dialog-title').textContent = member ? `Edit ${member.name}` : 'Add a person';
    $('#profile-id').value = member?.id ?? '';
    $('#profile-name').value = member?.name ?? '';
    $('#profile-delete').hidden = !member;
    $('#profile-photo-status').hidden = true;
    // Someone new starts with a random character; they can pick another, a photo or initials.
    pendingPhoto = member || !CHARACTERS.length ? undefined : CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].url;
    showPhotoPreview(member);
    profileDialog.showModal();
    $('#profile-name').focus();
  }

  const editingMember = () => data.members.find((m) => m.id === $('#profile-id').value);

  // Shrink a photo to a small square so it can be stored with the rest of the data.
  function photoToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img,
          (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  $('#profile-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      pendingPhoto = await photoToDataUrl(file);
      $('#profile-photo-status').hidden = true;
    } catch (err) {
      $('#profile-photo-status').textContent = 'That picture couldn’t be opened. Try a different photo.';
      $('#profile-photo-status').hidden = false;
    }
    showPhotoPreview(editingMember());
  });

  $('#profile-photo-remove').addEventListener('click', () => {
    pendingPhoto = null;
    showPhotoPreview(editingMember());
  });

  $('#profile-name').addEventListener('input', () => showPhotoPreview(editingMember()));

  $('#profile-form').addEventListener('submit', () => {
    const name = $('#profile-name').value.trim();
    if (!name) return;
    const existing = editingMember();
    if (existing) {
      existing.name = name;
      if (pendingPhoto !== undefined) existing.photo = pendingPhoto;
    } else {
      const person = { id: uid(), name, photo: pendingPhoto || null };
      data.members.push(person);
      if (!me()) setMe(person.id);
    }
    save();
    render();
    if (whoDialog.open) renderWhoList();
  });

  $('#profile-delete').addEventListener('click', () => {
    const member = editingMember();
    if (!member || !confirm(`Remove ${member.name} from the household? Things they added stay.`)) return;
    data.members = data.members.filter((m) => m.id !== member.id);
    if (myId() === member.id) setMe(null);
    save();
    profileDialog.close();
    render();
    if (whoDialog.open) renderWhoList();
  });

  $('#profile-btn').addEventListener('click', openWhoDialog);
  $('#who-add').addEventListener('click', () => openProfileForm(null));

  // ---------- Household sharing ----------
  //
  // Each household is households/<code> in Firestore, with one document per place, item,
  // recipe and planned day in the subcollections below. The phone keeps working from its own
  // copy; save() sends only what changed, and changes from other phones arrive as snapshots.

  const HOUSEHOLD_KEY = 'wdywfd-household';
  const COLLECTIONS = ['places', 'items', 'recipes', 'plan', 'members'];
  const CODE_WORDS = ['APPLE', 'BASIL', 'BEAN', 'BERRY', 'BREAD', 'BROTH', 'BUTTER', 'CAKE', 'CARROT', 'CELERY',
    'CHEESE', 'CHERRY', 'CHILLI', 'CLOVE', 'COCOA', 'COCONUT', 'CORN', 'CREAM', 'CRUMB', 'CURRY', 'DATE', 'DILL',
    'DUMPLING', 'FENNEL', 'FUDGE', 'GARLIC', 'GINGER', 'GRAPE', 'GRAVY', 'HAZEL', 'HONEY', 'JAM', 'KALE', 'KIWI',
    'LEEK', 'LEMON', 'LENTIL', 'LIME', 'MANGO', 'MAPLE', 'MELON', 'MINT', 'MUFFIN', 'NOODLE', 'NUTMEG', 'OLIVE',
    'ONION', 'ORANGE', 'PANCAKE', 'PAPRIKA', 'PASTA', 'PEACH', 'PEAR', 'PECAN', 'PEPPER', 'PICKLE', 'PLUM', 'POTATO',
    'PRAWN', 'PUMPKIN', 'RADISH', 'RAISIN', 'RHUBARB', 'RICE', 'SAFFRON', 'SAGE', 'SALSA', 'SCONE', 'SESAME', 'SPROUT',
    'SQUASH', 'SUGAR', 'SWEDE', 'TOAST', 'TOFFEE', 'TOMATO', 'TRUFFLE', 'TURNIP', 'VANILLA', 'WAFFLE', 'WALNUT',
    'YOGURT', 'ACORN', 'BADGER', 'BIRCH', 'BRAMBLE', 'CEDAR', 'CLOVER', 'COMET', 'CORAL', 'DAISY', 'EMBER', 'FERN',
    'FINCH', 'FOX', 'GLADE', 'HARBOUR', 'HERON', 'HOLLY', 'IVY', 'JUNIPER', 'LARK', 'MAGPIE', 'MEADOW', 'MOSS',
    'OTTER', 'PEBBLE', 'PINE', 'POPPY', 'QUAIL', 'RAVEN', 'RIVER', 'ROBIN', 'ROWAN', 'SPARROW', 'STONE', 'THISTLE',
    'TIGER', 'TULIP', 'WILLOW', 'WREN', 'BEACON', 'CANDLE', 'HARP', 'LANTERN', 'MARBLE', 'ORBIT', 'QUILL', 'VELVET'];

  let household = null;       // { code } while sharing
  let fb = null;              // { mod, db, auth } once Firebase has loaded
  let unsubscribers = [];
  let ready = new Set();      // collections that have had their first snapshot
  let synced = {};            // collection -> { id: JSON of the last version seen in Firestore }

  try { household = JSON.parse(localStorage.getItem(HOUSEHOLD_KEY) || 'null'); } catch (e) { household = null; }

  // Stable JSON so the same object always compares equal, whatever order Firestore returns fields in.
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  // Local data -> { docId: fields } for one collection.
  function localDocs(name) {
    const docs = {};
    if (name === 'plan') {
      for (const [date, day] of Object.entries(data.plan)) docs[date] = { ...day };
    } else {
      data[name].forEach((entry, pos) => {
        docs[entry.id] = name === 'places' ? { ...entry, pos } : { ...entry };
      });
    }
    return docs;
  }

  // Firestore documents -> local data for one collection.
  function applyDocs(name, docs) {
    if (name === 'plan') {
      data.plan = docs;
    } else if (name === 'places') {
      data.places = Object.values(docs).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
        .map(({ pos, ...place }) => place);
    } else {
      data[name] = Object.values(docs);
    }
  }

  function pushToHousehold() {
    if (!household || !fb || ready.size < COLLECTIONS.length) return;
    const { mod, db } = fb;
    const writes = [];
    for (const name of COLLECTIONS) {
      const docs = localDocs(name);
      const known = synced[name] || {};
      for (const [id, fields] of Object.entries(docs)) {
        const json = stable(fields);
        if (known[id] !== json) writes.push(['set', name, id, fields, json]);
      }
      for (const id of Object.keys(known)) {
        if (!(id in docs)) writes.push(['delete', name, id]);
      }
    }
    // One batch per collection (Firestore takes up to 500 writes each), so a refused write
    // in one list doesn't hold up the others. A refused write is forgotten so it's retried.
    for (const name of COLLECTIONS) {
      const mine = writes.filter((w) => w[1] === name);
      for (let i = 0; i < mine.length; i += 450) {
        const chunk = mine.slice(i, i + 450);
        const batch = mod.writeBatch(db);
        const before = { ...(synced[name] || {}) };
        synced[name] = synced[name] || {};
        for (const [op, , id, fields, json] of chunk) {
          const ref = mod.doc(db, 'households', household.code, name, id);
          if (op === 'set') { batch.set(ref, fields); synced[name][id] = json; }
          else { batch.delete(ref); delete synced[name][id]; }
        }
        batch.commit().catch(() => {
          for (const [, , id] of chunk) {
            if (id in before) synced[name][id] = before[id];
            else delete synced[name][id];
          }
          setHouseholdChip(name === 'members' ? 'profiles not shared yet' : 'couldn’t sync your last change');
        });
      }
    }
  }

  async function loadFirebase() {
    if (fb) return fb;
    if (!window.FIREBASE_CONFIG) throw new Error('not-configured');
    const mod = await import('./vendor/firebase.mjs');
    const app = mod.initializeApp(window.FIREBASE_CONFIG);
    const db = mod.initializeFirestore(app, {
      localCache: mod.persistentLocalCache({ tabManager: mod.persistentMultipleTabManager() }),
    });
    const auth = mod.getAuth(app);
    if (window.FIREBASE_CONFIG.useEmulator) {
      // Only for testing on a computer with the Firebase emulators running.
      mod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      mod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    fb = { mod, db, auth };
    return fb;
  }

  // Signs this phone in anonymously (no account needed); remembered after the first time.
  async function ensureSignedIn() {
    const { mod, auth } = await loadFirebase();
    await auth.authStateReady();
    if (!auth.currentUser) await mod.signInAnonymously(auth);
  }

  let householdState = '';

  function setHouseholdChip(state) {
    householdState = household ? (state || householdState) : '';
    if (!$('#home-view').hidden) renderHousehold();
    const chip = $('#household-btn');
    chip.classList.toggle('on', !!household);
    chip.textContent = household ? `🏠 Shared with your household${state ? ` · ${state}` : ''}` : '🏠 Share with your household';
    $('#saved-where').textContent = household
      ? 'Shared with your household, and saved on this device for when you’re offline.'
      : 'Everything is saved on this device.';
  }

  function stopListening() {
    unsubscribers.forEach((stop) => stop());
    unsubscribers = [];
    ready = new Set();
  }

  function startListening() {
    const { mod, db } = fb;
    stopListening();
    for (const name of COLLECTIONS) {
      const ref = mod.collection(db, 'households', household.code, name);
      unsubscribers.push(mod.onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
        // Profiles were added later, so an empty cached copy may just mean the server hasn't
        // answered (or older rules refuse them). Keep this phone's profiles until it does.
        if (name === 'members' && snap.empty && snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
        const docs = {};
        const seen = {};
        snap.forEach((d) => { docs[d.id] = d.data(); seen[d.id] = stable(d.data()); });
        synced[name] = seen;
        applyDocs(name, docs);
        ready.add(name);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
        render();
        setHouseholdChip(snap.metadata.hasPendingWrites || snap.metadata.fromCache ? 'waiting for signal' : 'up to date');
      }, () => {
        // Still let the other lists sync if this one is refused (e.g. older security rules).
        ready.add(name);
        setHouseholdChip(name === 'members' ? 'profiles not shared yet' : 'can’t reach the household');
      }));
    }
  }

  async function connectHousehold() {
    if (!household) return;
    setHouseholdChip('connecting');
    try {
      await loadFirebase();
      ensureSignedIn().catch(() => setHouseholdChip('waiting for signal'));
      startListening();
    } catch (e) {
      setHouseholdChip(e.message === 'not-configured' ? 'not set up' : 'waiting for signal');
    }
  }

  function newCode() {
    const words = [];
    const random = new Uint32Array(5);
    crypto.getRandomValues(random);
    for (let i = 0; i < 4; i++) words.push(CODE_WORDS[random[i] % CODE_WORDS.length]);
    return `${words.join('-')}-${10 + (random[4] % 90)}`;
  }

  function normaliseCode(text) {
    return text.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function setHouseholdStatus(text, isError) {
    const box = $('#household-status');
    box.textContent = text;
    box.className = `ai-status ${isError ? 'error' : ''}`;
    box.hidden = !text;
  }

  function showHouseholdDialog(prefillCode) {
    const configured = !!window.FIREBASE_CONFIG;
    $('#household-off').hidden = configured;
    $('#household-none').hidden = !configured || !!household;
    $('#household-in').hidden = !configured || !household;
    if (household) $('#household-code-show').textContent = household.code;
    $('#household-code').value = prefillCode || '';
    setHouseholdStatus('');
    const dialog = $('#household-dialog');
    if (!dialog.open) dialog.showModal();
  }

  function rememberHousehold(code) {
    household = { code };
    try { localStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(household)); } catch (e) { /* storage unavailable */ }
  }

  $('#household-btn').addEventListener('click', () => showHouseholdDialog());

  $('#household-create').addEventListener('click', async () => {
    setHouseholdStatus('Creating your household…');
    try {
      await ensureSignedIn();
      const { mod, db } = fb;
      let code = newCode();
      while ((await mod.getDoc(mod.doc(db, 'households', code))).exists()) code = newCode();
      await mod.setDoc(mod.doc(db, 'households', code), { created: mod.serverTimestamp() });
      rememberHousehold(code);
      // Upload what's on this phone first, so the household starts with it.
      synced = {};
      COLLECTIONS.forEach((name) => ready.add(name));
      pushToHousehold();
      startListening();
      setHouseholdChip('up to date');
      showHouseholdDialog();
      setHouseholdStatus('Household created. Send the invite link to everyone you live with.');
      if (!me()) setTimeout(() => openWhoDialog(), 300);
    } catch (e) {
      setHouseholdStatus('Couldn’t create the household. Check you have signal and try again.', true);
    }
  });

  $('#household-join').addEventListener('click', async () => {
    const code = normaliseCode($('#household-code').value);
    if (code.length < 16) {
      setHouseholdStatus('Type the whole code, like PLUM-TIGER-RIVER-MANGO-42.', true);
      return;
    }
    setHouseholdStatus('Checking the code…');
    try {
      await ensureSignedIn();
      const { mod, db } = fb;
      if (!(await mod.getDoc(mod.doc(db, 'households', code))).exists()) {
        setHouseholdStatus('There’s no household with that code. Check it and try again.', true);
        return;
      }
      if (!confirm('Joining replaces the food, recipes and meal plan on this phone with the household’s. Join?')) {
        setHouseholdStatus('');
        return;
      }
      rememberHousehold(code);
      synced = {};
      startListening();
      showHouseholdDialog();
      setHouseholdStatus('You’ve joined. Everything you change now is shared.');
      setTimeout(() => { $('#household-dialog').close(); if (!me()) openWhoDialog(); }, 1500);
    } catch (e) {
      setHouseholdStatus('Couldn’t join. Check you have signal and try again.', true);
    }
  });

  function inviteLink() {
    return `${location.origin}${location.pathname}#join=${household.code}`;
  }

  // These are used by both the household dialog and the Household tab; `say` shows a message
  // in whichever one the button was in.
  async function sendInvite(say) {
    const text = `Join our household on What do you want for dinner? Open this link, or tap 🏠 and enter the code ${household.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'What do you want for dinner?', text, url: inviteLink() }); return; }
      await navigator.clipboard.writeText(`${text}\n${inviteLink()}`);
      say('Invite link copied. Paste it into a message.');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      prompt('Copy this invite link:', inviteLink());
    }
  }

  async function copyCode(say) {
    try {
      await navigator.clipboard.writeText(household.code);
      say('Code copied.');
    } catch (e) {
      prompt('Copy this code:', household.code);
    }
  }

  function leaveHousehold() {
    if (!confirm('Stop sharing on this phone? It keeps a copy of everything as it is now, and the others keep the household.')) return false;
    stopListening();
    household = null;
    synced = {};
    try { localStorage.removeItem(HOUSEHOLD_KEY); } catch (e) { /* storage unavailable */ }
    setHouseholdChip();
    return true;
  }

  $('#household-invite').addEventListener('click', () => sendInvite(setHouseholdStatus));
  $('#household-copy').addEventListener('click', () => copyCode(setHouseholdStatus));
  $('#household-leave').addEventListener('click', () => { if (leaveHousehold()) showHouseholdDialog(); });

  // ---------- Household tab ----------

  function setHomeStatus(text) {
    const box = $('#home-status');
    box.textContent = text;
    box.hidden = !text;
  }

  function mealsPlannedThisWeek() {
    const monday = mondayOf(new Date());
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const day = data.plan[isoDate(d)] || {};
      count += MEALS.filter(([meal]) => slotIds(day, meal).some((id) => data.recipes.some((r) => r.id === id))).length;
    }
    return count;
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function renderHousehold() {
    const shared = !!household;
    $('#home-shared').hidden = !shared;
    $('#home-local').hidden = shared;
    $('#home-sync').textContent = shared ? (householdState || 'connecting') : 'Only on this phone';
    $('#home-sync').className = `badge ${shared && householdState === 'up to date' ? 'ok' : ''}`;
    if (shared) $('#home-code').textContent = household.code;

    const mineId = myId();
    const people = [...data.members].sort((a, b) => (b.id === mineId) - (a.id === mineId) || a.name.localeCompare(b.name));
    $('#home-people').replaceChildren(...people.map((m) => {
      const foods = data.items.filter((i) => i.addedBy === m.id).length;
      const recipes = data.recipes.filter((r) => r.addedBy === m.id).length;
      const isMe = m.id === mineId;
      return el('li', { class: `person ${isMe ? 'me' : ''}` },
        avatar(m, 56),
        el('div', { class: 'person-info' },
          el('div', { class: 'person-name' }, m.name, isMe ? el('span', { class: 'you-tag' }, 'You') : null),
          el('div', { class: 'muted person-stats' }, `Added ${plural(foods, 'food', 'foods')} · ${plural(recipes, 'recipe', 'recipes')}`)),
        el('div', { class: 'person-actions' },
          isMe ? null : el('button', { type: 'button', class: 'btn btn-small', onclick: () => { setMe(m.id); render(); } }, 'This is me'),
          el('button', { type: 'button', class: 'btn btn-icon', title: `Edit ${m.name}`, 'aria-label': `Edit ${m.name}`, onclick: () => openProfileForm(m) }, '✎')));
    }));
    $('#home-people-empty').hidden = data.members.length > 0;

    const glance = [
      [data.items.length, 'Food in stock', 'Foods in stock'],
      [data.recipes.length, 'Recipe saved', 'Recipes saved'],
      [mealsPlannedThisWeek(), 'Meal planned this week', 'Meals planned this week'],
      [data.places.length, 'Storage place', 'Storage places'],
    ];
    $('#home-glance').replaceChildren(...glance.map(([n, one, many]) =>
      el('div', { class: 'stat' }, el('span', { class: 'stat-value' }, n), el('span', { class: 'stat-label' }, n === 1 ? one : many))));
  }

  $('#home-invite').addEventListener('click', () => sendInvite(setHomeStatus));
  $('#home-copy').addEventListener('click', () => copyCode(setHomeStatus));
  $('#home-leave').addEventListener('click', () => { if (leaveHousehold()) setHomeStatus('This phone has left the household. Everything is still saved here.'); });
  $('#home-start').addEventListener('click', () => showHouseholdDialog());
  $('#home-add-person').addEventListener('click', () => openProfileForm(null));

  // Opened from an invite link: #join=CODE
  function handleInvite() {
    const match = location.hash.match(/^#join=([A-Za-z0-9-]+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    const code = normaliseCode(match[1]);
    if (household && household.code === code) return;
    if (household) {
      showHouseholdDialog();
      setHouseholdStatus(`To join ${code}, leave this household first.`, true);
      return;
    }
    showHouseholdDialog(code);
  }

  window.addEventListener('hashchange', handleInvite);
  window.addEventListener('online', () => {
    if (household && fb) ensureSignedIn().catch(() => {});
  });

  render();
  setHouseholdChip();
  connectHousehold();
  handleShare();
  handleInvite();

  // Offline support and asking the browser not to clear our saved data.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
