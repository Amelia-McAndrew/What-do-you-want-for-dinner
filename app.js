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
    shopping: [],
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

  // Ready-made food: bought and just cooked or served (oven chips, garlic bread). Stored as a
  // recipe whose one ingredient is itself, so stock, shopping and the meal plan all work.
  const PREMADE_SUGGESTIONS = [
    ['Oven chips', 25], ['Potato waffles', 15], ['Hash browns', 20], ['Garlic bread', 12], ['Coleslaw', 0],
    ['Fish fingers', 15], ['Chicken nuggets', 20], ['Chicken kievs', 30], ['Frozen peas', 5], ['Sweetcorn', 5],
    ['Yorkshire puddings', 5], ['Naan bread', 5], ['Microwave rice', 2], ['Onion rings', 15], ['Frozen pizza', 15],
    ['Ready meal', 8], ['Instant mash', 5], ['Bagged salad', 0], ['Gravy granules', 2], ['Spring rolls', 20],
    ['Onion bhajis', 15], ['Ice cream', 0], ['Cheesecake', 0], ['Apple pie', 25],
  ];

  // "2/4 in stock" for recipes; just "In stock" / "Not in stock" for ready-made food.
  function stockLabel(recipe, stock, long = false) {
    if (recipe.premade) return stock.have ? 'In stock' : 'Not in stock';
    return `${stock.have}/${stock.total} ${long ? 'ingredients ' : ''}in stock`;
  }

  function premadeKind(name) {
    const n = name.toLowerCase();
    if (/yorkshire/.test(n)) return 'side';
    if (/\b(ice cream|cheesecake|gateau|tart|cake|trifle|sponge|apple pie|crumble|pudding|brownies?|cookies?)\b/.test(n)) return 'dessert';
    if (/\b(gravy|sauce|dip|houmous|hummus|salsa|mayo|ketchup|chutney|pesto)\b/.test(n)) return 'sauce';
    if (/\b(spring rolls?|bhajis?|samosas?|prawn toast|soup)\b/.test(n)) return 'starter';
    if (/\b(pizza|ready meal|lasagne|meal for one|pie|curry|cottage pie|shepherd)\b/.test(n)) return 'meal';
    if (/\b(fish fingers|nuggets|kievs?|burgers?|sausages?|fishcakes?|goujons|breaded|scampi)\b/.test(n)) return 'main';
    if (/\b(juice|squash|lemonade|cola)\b/.test(n)) return 'drink';
    return 'side';
  }

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

  // Suggest categories from a recipe's name, ingredients, method, time and kind. Rules, not AI,
  // so it's free, instant and works offline; people can always change what it picks.
  const CATEGORY_RULES = [
    ['asian', /\b(soy|gochujang|miso|teriyaki|katsu|ramen|noodles?|stir.?fry|sesame oil|fish sauce|sriracha|kimchi|pak choi|bok choy|rice vinegar|hoisin|satay|thai|chinese|japanese|korean|vietnamese|pho|sushi|dumplings?|gyoza|wok|lemongrass|green curry|red curry|curry paste|chow mein|fried rice|bao|bibimbap|bulgogi|sweet and sour|five spice)\b/],
    ['indian', /\b(tikka|masala|korma|dh?al|biryani|naan|paneer|garam masala|bhaji|samosa|tandoori|chana|saag|vindaloo|madras|jalfrezi|rogan josh|balti|pilau|chapati|raita)\b/],
    ['italian', /\b(pasta|spaghetti|penne|fusilli|linguine|tagliatelle|lasagne|risotto|pizza|parmesan|mozzarella|pesto|gnocchi|bolognese|carbonara|ciabatta|focaccia|arrabbiata|puttanesca|tiramisu|bruschetta|prosciutto|orzo)\b/],
    ['mexican', /\b(tacos?|tortillas?|burritos?|fajitas?|enchiladas?|quesadillas?|salsa|guacamole|chipotle|jalapeños?|jalapenos?|nachos|chilli con carne|refried|mexican)\b/],
    ['british', /\b(roast|shepherd'?s pie|cottage pie|toad in the hole|yorkshire|bangers|mash|fish and chips|crumble|scones?|stuffing|gravy|full english|jacket potato|pork rolls?|hotpot|pasty|scotch egg|bubble and squeak|trifle|sticky toffee|pie and)\b/],
    ['mediterranean', /\b(feta|halloumi|olives|greek|tzatziki|souvlaki|moussaka|paella|chorizo|gazpacho|orzo|sun.?dried)\b/],
    ['american', /\b(burgers?|mac and cheese|mac ?n ?cheese|pancakes|hot ?dogs?|buffalo|pulled pork|brownies?|cornbread|cajun|sloppy joe|ribs|coleslaw|meatloaf)\b/],
    ['middle-eastern', /\b(hummus|falafel|shawarma|tahini|za'?atar|sumac|harissa|tagine|pittas?|kebabs?|shakshuka|freekeh|baba ganoush|kofta)\b/],
    ['french', /\b(croissants?|ratatouille|coq au vin|bourguignon|quiche|cr[eê]pes?|gratin|dauphinoise|brioche|b[eé]arnaise|cassoulet|tartiflette|crème brûlée|creme brulee|french)\b/],
    ['winter', /\b(stew|casserole|soup|hotpot|crumble|mulled|dumplings|braised|chilli con carne|root veg|swede|parsnips?|slow.?cook)/],
    ['autumn', /\b(pumpkin|squash|apples?(?! sauce)|mushrooms?|parsnips?|blackberr(y|ies)|sweet potato(es)?|chestnuts?|plums?|pears?|cinnamon)\b/],
    ['summer', /\b(salad|bbq|barbecue|strawberr(y|ies)|grilled|ice cream|gazpacho|courgettes?|sweetcorn|corn on the cob|watermelon|peach(es)?|tomato salad|kebabs?|halloumi)\b/],
    ['spring', /\b(asparagus|peas|lamb|wild garlic|rhubarb|new potato(es)?|spring onions?|radish(es)?|broad beans|watercress)\b/],
    ['christmas', /\b(turkey|sprouts|cranberr(y|ies)|mince pies?|gingerbread|christmas|pigs in blankets|yule|mulled wine|bread sauce|stollen)\b/],
    ['healthy', /\b(salad|healthy|light|low.?cal(orie)?|high.?protein|protein|poke|buddha bowl|steamed|quinoa|lentils?|chickpeas?|veggie bowl)\b/],
    ['slow-cooker', /\b(slow.?cook(er|ed)?|crock.?pot)\b/],
    ['batch', /\b(batch|freezes? well|meal prep|freeze (it|leftovers|portions))\b/],
    ['bbq', /\b(bbq|barbecue|chargrill(ed)?)\b/],
    ['roast', /\broast (chicken|beef|pork|lamb|turkey|dinner)\b|\bsunday roast\b|\byorkshire pudding/],
    ['fakeaway', /\b(katsu|sweet and sour|kebabs?|fakeaway|takeaway|crispy chilli|salt and pepper|chow mein|fried rice|doner|pizza|tikka masala|korma|bhaji|burgers?|nuggets|wings)\b/],
    ['comfort', /\b(pies?|mac and cheese|stew|lasagne|mash|crumble|casserole|hotpot|pasta bake|cottage|shepherd'?s|toad in the hole|dumplings|sticky toffee|risotto|cheesy)\b/],
    ['kids', /\b(fish fingers|nuggets|pizza|pasta bake|mac and cheese|sausages?|hot ?dogs?|fajitas|wraps?|pancakes|spaghetti bolognese)\b/],
  ];
  const MEAT_OR_FISH = /\b(chicken|beef|pork|lamb|turkey|duck|mince|steak|bacon|ham|sausages?|chorizo|salami|pepperoni|gammon|fish|salmon|cod|haddock|tuna|prawns?|shrimp|mackerel|sardines|anchov(y|ies)|seafood|mussels|squid|meat|veal|venison|thighs?|breasts?|wings?|drumsticks?|stock cubes?|chicken stock|beef stock|gelatine|fish sauce|worcestershire)\b/;
  const ANIMAL_PRODUCTS = /\b(milk|cheese|cheddar|mozzarella|parmesan|feta|halloumi|butter|cream|yogh?urt|eggs?|honey|mayo(nnaise)?|custard|ghee|paneer|creme fraiche|crème fraîche|mascarpone|ricotta)\b/;
  const PLANT_MILK = /\b(oat|soya?|almond|coconut|plant|vegan) (milk|cream|yogh?urt|butter|cheese)\b/g;

  function suggestCategories(recipe) {
    const ingredients = (recipe.ingredients || []).join('\n').toLowerCase();
    const text = `${recipe.name || ''}\n${ingredients}\n${recipe.method || ''}`.toLowerCase();
    const found = new Set();
    for (const [id, pattern] of CATEGORY_RULES) if (pattern.test(text)) found.add(id);
    // "Curry" on its own is usually Indian, unless it's clearly a katsu or Thai curry.
    if (/\bcurry\b/.test(text) && !found.has('asian')) found.add('indian');
    if (recipe.time && recipe.time <= 30) found.add('quick');
    if (recipe.time && recipe.time >= 240 && /slow/.test(text)) found.add('slow-cooker');
    // Diet only when there's an ingredient list to judge by.
    if (ingredients.trim() && !MEAT_OR_FISH.test(`${recipe.name || ''}\n${ingredients}`.toLowerCase())) {
      found.add('vegetarian');
      if (!ANIMAL_PRODUCTS.test(ingredients.replace(PLANT_MILK, ''))) found.add('vegan');
    }
    // Dessert and drink recipes aren't fakeaways or roasts.
    if (['dessert', 'drink'].includes(recipe.course)) { found.delete('fakeaway'); found.delete('roast'); found.delete('kids'); }
    // Keep the list in the same order as the picker.
    const order = CATEGORY_GROUPS.flatMap(([, cats]) => cats.map(([id]) => id));
    return order.filter((id) => found.has(id));
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
          if (!Array.isArray(parsed.shopping)) parsed.shopping = [];
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
    renderShopTab();
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
      .filter((r) => !kind || (kind === '@premade' ? r.premade : kindOf(r) === kind))
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
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Share recipe', 'aria-label': `Share ${recipe.name}`, onclick: () => openShareRecipe(recipe) }, '↗'),
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Edit recipe', 'aria-label': `Edit ${recipe.name}`, onclick: () => openRecipeDialog(recipe) }, '✎'),
      ),
      el('div', { class: 'recipe-meta' },
        recipe.premade ? el('span', { class: 'badge premade-badge' }, '📦 Ready-made') : null,
        kindOf(recipe) !== 'meal' ? el('span', { class: 'badge kind-badge' }, `${KIND_INFO[kindOf(recipe)].icon} ${KIND_INFO[kindOf(recipe)].label}`) : null,
        recipe.premade ? null : el('span', { class: `badge ${recipe.difficulty}` }, DIFFICULTY[recipe.difficulty]),
        recipe.time ? el('span', { class: 'badge' }, `⏱ ${timeText(recipe.time)}`) : null,
        recipe.premade
          ? el('span', { class: `badge ${allIn ? 'have-all' : ''}` }, allIn ? 'In stock' : 'Not in stock')
          : stock.total
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
      recipe.premade
        ? (recipe.method ? el('details', {}, el('summary', {}, 'How to cook it'), el('p', { class: 'method' }, recipe.method)) : null)
        : el('details', {},
            el('summary', {}, recipe.method ? 'Ingredients and method' : 'Ingredients'),
            el('h4', {}, 'Ingredients'),
            ingredients,
            recipe.method ? [el('h4', {}, 'Method'), el('p', { class: 'method' }, recipe.method)] : null,
          ),
    );
  }

  const recipeDialog = $('#recipe-dialog');

  let premadeMode = false;
  let courseChosen = false;

  function openRecipeDialog(recipe, shared, asPremade = false) {
    premadeMode = recipe ? !!recipe.premade : asPremade;
    courseChosen = !!recipe;
    recipeDialog.classList.toggle('premade', premadeMode);
    $('#recipe-dialog-title').textContent = premadeMode
      ? (recipe ? 'Edit ready-made food' : 'Add ready-made food')
      : (recipe ? 'Edit recipe' : 'Add recipe');
    $('#recipe-name-label').textContent = premadeMode ? 'Name' : 'Recipe name';
    $('#recipe-name').placeholder = premadeMode ? 'e.g. Oven chips' : 'e.g. Chicken stir fry';
    if (premadeMode) $('#recipe-name').setAttribute('list', 'premade-options'); else $('#recipe-name').removeAttribute('list');
    $('#recipe-time-label').textContent = premadeMode ? 'Cooking time (minutes)' : 'Total time (minutes)';
    $('#recipe-method-label').textContent = premadeMode ? 'How to cook it' : 'Method';
    $('#recipe-method').placeholder = premadeMode ? 'e.g. Oven, 200°C, 20–25 minutes, turning halfway' : '1. Slice the chicken…';
    $('#recipe-id').value = recipe?.id ?? '';
    $('#recipe-source').value = recipe?.source ?? shared?.url ?? '';
    $('#recipe-paste-text').value = shared?.text ?? '';
    $('#recipe-import').open = !!shared?.text;
    setClaudeStatus('');
    $('#recipe-name').value = recipe?.name ?? shared?.name ?? '';
    $('#recipe-level').value = recipe?.difficulty ?? 'easy';
    $('#recipe-course').value = recipe ? kindOf(recipe) : premadeMode ? 'side' : 'meal';
    pendingTags = new Set(recipe ? tagsOf(recipe) : []);
    $('#cat-custom').value = '';
    $('#cat-picker').open = false;
    $('#cat-suggest-status').hidden = true;
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
      premade: premadeMode,
      source: firstUrl($('#recipe-source').value) || null,
      difficulty: $('#recipe-level').value,
      course: $('#recipe-course').value,
      tags: [...pendingTags],
      time: time > 0 ? time : null,
      ingredients: $('#recipe-ingredients').value.split('\n').map((l) => l.trim()).filter(Boolean),
      method: $('#recipe-method').value.trim(),
    };
    if (!fields.name) return;
    if (premadeMode) {
      // Its one "ingredient" is itself, so it shows as in stock or goes on the shopping list.
      fields.ingredients = [fields.name];
      fields.difficulty = 'easy';
      fields.source = null;
    }
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
  $('#recipe-course').addEventListener('change', () => { courseChosen = true; });
  $('#premade-options').replaceChildren(...PREMADE_SUGGESTIONS.map(([name]) => el('option', { value: name })));
  // For ready-made food, pick a sensible kind and cooking time from the name as it's typed.
  $('#recipe-name').addEventListener('input', () => {
    if (!premadeMode) return;
    const name = $('#recipe-name').value.trim();
    if (!courseChosen) $('#recipe-course').value = premadeKind(name);
    const known = PREMADE_SUGGESTIONS.find(([n]) => n.toLowerCase() === name.toLowerCase());
    if (known && !$('#recipe-time').value && known[1]) $('#recipe-time').value = known[1];
  });
  $('#add-premade-btn').addEventListener('click', () => openRecipeDialog(null, null, true));
  $('#recipe-kind').append(el('option', { value: '@premade' }, '📦 Ready-made'));
  $('#finder-kind').append(el('option', { value: '@premade' }, '📦 Ready-made'));

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

  // "Suggest" in the recipe form: add what the rules find to what's already picked.
  $('#cat-suggest').addEventListener('click', () => {
    const time = parseInt($('#recipe-time').value, 10);
    const found = suggestCategories({
      name: $('#recipe-name').value,
      ingredients: $('#recipe-ingredients').value.split('\n'),
      method: $('#recipe-method').value,
      time: time > 0 ? time : null,
      course: $('#recipe-course').value,
    });
    const added = found.filter((tag) => !pendingTags.has(tag));
    added.forEach((tag) => pendingTags.add(tag));
    $('#cat-picker').open = true;
    renderCategoryPicker();
    $('#cat-suggest-status').textContent = added.length
      ? `Added ${added.map(catLabel).join(', ')}. Tap any you don’t want to remove it.`
      : found.length ? 'Those all match what’s already picked.' : 'Couldn’t suggest any. Add some ingredients first, or pick them yourself.';
    $('#cat-suggest-status').hidden = false;
  });

  // "Auto-categorise" on the Recipes tab: only recipes with no categories yet.
  $('#auto-cat-btn').addEventListener('click', () => {
    const todo = data.recipes.filter((r) => !tagsOf(r).length);
    const say = (text) => { $('#auto-cat-status').textContent = text; $('#auto-cat-status').hidden = false; };
    if (!todo.length) { say('Every recipe already has categories. To change one, tap ✎ on it.'); return; }
    let changed = 0;
    for (const recipe of todo) {
      const tags = suggestCategories(recipe);
      if (tags.length) { recipe.tags = tags; changed++; }
    }
    if (!changed) { say(`Couldn’t suggest categories for the ${todo.length === 1 ? 'recipe' : `${todo.length} recipes`} without any. Add ingredients, or pick them by tapping ✎.`); return; }
    save();
    renderRecipes();
    const skipped = todo.length - changed;
    say(`Added categories to ${changed} recipe${changed === 1 ? '' : 's'}${skipped ? ` (${skipped} had nothing to go on)` : ''}. Recipes that already had categories weren’t changed.`);
  });

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
      ...(custom.length ? [el('optgroup', { label: 'Your own' }, custom.map((t) => el('option', { value: t }, `🏷️ ${t}`)))] : []));
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
    if (recipeId && !ids.includes(recipeId)) {
      setSlot(date, meal, [...ids, recipeId]);
      const recipe = data.recipes.find((r) => r.id === recipeId);
      if (recipe) askAboutMissing(recipe);
    } else {
      renderPlan();
    }
  }

  function removeDish(date, meal, recipeId) {
    setSlot(date, meal, slotIds(data.plan[date], meal).filter((id) => id !== recipeId));
  }

  // Picker of saved recipes, grouped by kind, leaving out what's already in the slot.
  function dishPicker(id, chosenIds, onPick) {
    const group = (label, list) => (list.length
      ? el('optgroup', { label }, list.sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('option', { value: r.id }, r.name)))
      : null);
    const available = data.recipes.filter((r) => !chosenIds.includes(r.id));
    // Ready-made food gets its own group, after the mains, ready to go alongside them.
    const groups = KINDS.flatMap(([kind, icon, , plural]) => [
      group(`${icon} ${plural}`, available.filter((r) => !r.premade && kindOf(r) === kind)),
      kind === 'main' ? group('📦 Ready-made', available.filter((r) => r.premade)) : null,
    ]).filter(Boolean);
    const placeholder = !data.recipes.length ? 'No recipes saved'
      : chosenIds.length ? '+ Add another part…' : 'Choose a meal…';
    const select = el('select', { id, class: `dish-picker ${chosenIds.length ? 'more' : 'empty'}`, onchange: (e) => onPick(e.target.value) },
      el('option', { value: '' }, placeholder), groups);
    select.value = '';
    if (!groups.length && chosenIds.length) select.hidden = true;
    return select;
  }

  // ---------- Find a meal (filters + spinning wheel) ----------

  const finder = { words: [], tags: new Set(), kind: '', stock: false };

  function finderMatches() {
    const season = currentSeason();
    return data.recipes.filter((r) => {
      const ingredients = singular(r.ingredients.join(' \n '));
      if (!finder.words.every((w) => ingredients.includes(w) || singular(r.name).includes(w))) return false;
      for (const tag of finder.tags) {
        if (tag === '@season' ? !tagsOf(r).includes(season) : !tagsOf(r).includes(tag)) return false;
      }
      if (finder.kind && (finder.kind === '@premade' ? !r.premade : kindOf(r) !== finder.kind)) return false;
      if (finder.stock) {
        const stock = recipeStock(r);
        if (!stock.total || stock.have * 2 < stock.total) return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderFinder() {
    const season = currentSeason();
    const used = new Set(data.recipes.flatMap(tagsOf));
    const order = CATEGORY_GROUPS.flatMap(([, cats]) => cats.map(([id]) => id));
    const themes = ['@season', ...order.filter((id) => used.has(id)), ...[...used].filter((t) => !CATEGORY_INFO[t]).sort()];
    $('#finder-themes').replaceChildren(...themes.map((tag) => el('button', {
      type: 'button',
      class: `cat-option ${finder.tags.has(tag) ? 'selected' : ''}`,
      'aria-pressed': String(finder.tags.has(tag)),
      onclick: () => { if (finder.tags.has(tag)) finder.tags.delete(tag); else finder.tags.add(tag); renderFinder(); },
    }, tag === '@season' ? `${CATEGORY_INFO[season].icon} In season` : catLabel(tag))));

    const matches = finderMatches();
    const filtering = finder.words.length || finder.tags.size || finder.kind || finder.stock;
    $('#finder-count').textContent = data.recipes.length
      ? `${matches.length} of ${data.recipes.length} recipe${data.recipes.length === 1 ? '' : 's'}`
      : '';
    $('#finder-clear').hidden = !filtering;
    $('#finder-spin').disabled = matches.length < 2;
    $('#finder-spin').title = matches.length < 2 ? 'Needs at least 2 matching recipes' : '';
    $('#finder-list').replaceChildren(...matches.map((r) => {
      const stock = recipeStock(r);
      const kind = kindOf(r);
      return el('li', { class: 'finder-row' },
        el('button', { type: 'button', class: 'finder-name', onclick: () => openRecipeView(r) },
          el('span', { class: 'dash-dish-name' }, kind !== 'meal' ? `${KIND_INFO[kind].icon} ` : '', r.name),
          el('span', { class: 'dash-dish-meta' },
            [r.time ? `⏱ ${timeText(r.time)}` : null, stock.total ? stockLabel(r, stock) : null,
              tagsOf(r).slice(0, 3).map(catLabel).join(' ')].filter(Boolean).join(' · '))),
        el('button', { type: 'button', class: 'btn btn-small', onclick: () => openAddToPlan(r) }, '+ Add'));
    }));
    $('#finder-empty').hidden = matches.length > 0;
    $('#finder-empty').textContent = data.recipes.length
      ? 'No recipes match those filters. Try removing one.'
      : 'Add some recipes in the Recipes tab to search them here.';
  }

  $('#finder-ingredients').addEventListener('input', (e) => {
    finder.words = e.target.value.split(',').map((w) => singular(w.trim())).filter((w) => w.length >= 2);
    renderFinder();
  });
  $('#finder-kind').append(...KINDS.map(([id, icon, , plural]) => el('option', { value: id }, `${icon} ${plural}`)));
  $('#finder-kind').addEventListener('change', (e) => { finder.kind = e.target.value; renderFinder(); });
  $('#finder-stock').addEventListener('change', (e) => { finder.stock = e.target.checked; renderFinder(); });
  $('#finder-clear').addEventListener('click', () => {
    finder.words = []; finder.tags.clear(); finder.kind = ''; finder.stock = false;
    $('#finder-ingredients').value = ''; $('#finder-kind').value = ''; $('#finder-stock').checked = false;
    renderFinder();
  });

  // "Add to plan": pick a day of the week being viewed, and a meal.
  const addPlanDialog = $('#add-plan-dialog');
  let addingRecipe = null;

  function openAddToPlan(recipe) {
    addingRecipe = recipe;
    $('#add-plan-title').textContent = `Add ${recipe.name}`;
    const todayIso = isoDate(new Date());
    $('#add-plan-day').replaceChildren(...weekDays().map((d) => el('option', { value: isoDate(d) },
      `${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}${isoDate(d) === todayIso ? ' (today)' : ''}`)));
    const days = weekDays().map(isoDate);
    $('#add-plan-day').value = days.includes(todayIso) ? todayIso : days[0];
    $('#add-plan-meal').value = new Date().getHours() < 10 ? 'breakfast' : new Date().getHours() < 15 ? 'lunch' : 'dinner';
    if (kindOf(recipe) === 'meal' || kindOf(recipe) === 'main') $('#add-plan-meal').value = 'dinner';
    addPlanDialog.showModal();
  }

  $('#add-plan-form').addEventListener('submit', () => {
    if (!addingRecipe) return;
    addDish($('#add-plan-day').value, $('#add-plan-meal').value, addingRecipe.id);
  });

  // The spinning wheel.
  const wheelDialog = $('#wheel-dialog');
  const WHEEL_COLOURS = ['#2f7a4f', '#e2683c', '#3a6ea5', '#d9a12b', '#a0527a', '#1f8a8a', '#7a4fa0', '#b83232', '#5a8f2f', '#c46a1f', '#4a5bb0', '#8a6b3a'];
  const WHEEL_MAX = 16;
  let wheelRecipes = [];
  let wheelAngle = 0;
  let spinning = false;

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function drawWheel() {
    const canvas = $('#wheel');
    const ratio = window.devicePixelRatio || 1;
    const size = canvas.clientWidth || 300;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    const r = size / 2;
    const n = wheelRecipes.length;
    const slice = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(wheelAngle);
    wheelRecipes.forEach((recipe, i) => {
      // Slice i is centred straight up when wheelAngle = -i * slice.
      const start = -Math.PI / 2 + i * slice - slice / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 4, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLOURS[i % WHEEL_COLOURS.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.rotate(start + slice / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${n > 10 ? 11 : 13}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      let label = recipe.name;
      const maxWidth = r - 34;
      while (label.length > 3 && ctx.measureText(label).width > maxWidth) label = `${label.slice(0, -2)}…`;
      ctx.fillText(label, r - 14, 0);
      ctx.restore();
    });
    ctx.restore();
    // Hub
    ctx.beginPath();
    ctx.arc(r, r, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b2622';
    ctx.stroke();
  }

  function openWheel() {
    const matches = finderMatches();
    if (matches.length < 2) return;
    wheelRecipes = matches.length > WHEEL_MAX ? shuffle(matches).slice(0, WHEEL_MAX) : shuffle(matches);
    wheelAngle = 0;
    $('#wheel-note').textContent = matches.length > WHEEL_MAX
      ? `${WHEEL_MAX} of your ${matches.length} matching recipes, picked at random.`
      : `${matches.length} recipes on the wheel.`;
    $('#wheel-result').hidden = true;
    wheelDialog.showModal();
    drawWheel();
  }

  function spinWheel() {
    if (spinning) return;
    spinning = true;
    $('#wheel-result').hidden = true;
    $('#wheel-spin').disabled = true;
    const n = wheelRecipes.length;
    const slice = (Math.PI * 2) / n;
    const winner = Math.floor(Math.random() * n);
    // Land the winner under the pointer at the top, a little off-centre so it feels natural.
    const wobble = (Math.random() - 0.5) * slice * 0.6;
    const base = wheelAngle % (Math.PI * 2);
    const target = -winner * slice + wobble;
    const turns = 5 + Math.floor(Math.random() * 3);
    const from = wheelAngle;
    let delta = target - base;
    while (delta < 0) delta += Math.PI * 2;
    const to = from + delta + turns * Math.PI * 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 300 : 4200;
    const startTime = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      wheelAngle = from + (to - from) * ease(t);
      drawWheel();
      if (t < 1) { requestAnimationFrame(step); return; }
      spinning = false;
      $('#wheel-spin').disabled = false;
      $('#wheel-spin').textContent = 'Spin again';
      showWheelResult(wheelRecipes[winner]);
    };
    requestAnimationFrame(step);
  }

  let wheelWinner = null;
  function showWheelResult(recipe) {
    wheelWinner = recipe;
    const stock = recipeStock(recipe);
    $('#wheel-result-name').textContent = recipe.name;
    $('#wheel-result-meta').textContent = [recipe.time ? `⏱ ${timeText(recipe.time)}` : null,
      recipe.premade ? '📦 Ready-made' : DIFFICULTY[recipe.difficulty], stock.total ? stockLabel(recipe, stock, true) : null].filter(Boolean).join(' · ');
    $('#wheel-result').hidden = false;
  }

  $('#finder-spin').addEventListener('click', openWheel);
  $('#wheel-spin').addEventListener('click', spinWheel);
  $('#wheel').addEventListener('click', spinWheel);
  $('#wheel-add').addEventListener('click', () => { if (wheelWinner) { wheelDialog.close(); openAddToPlan(wheelWinner); } });
  $('#wheel-view').addEventListener('click', () => { if (wheelWinner) { wheelDialog.close(); openRecipeView(wheelWinner); } });
  wheelDialog.addEventListener('close', () => { $('#wheel-spin').textContent = 'Spin'; });

  function renderPlan() {
    renderFinder();
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
                recipe.premade ? el('span', { class: 'badge premade-badge' }, '📦 Ready-made') : null,
                kind !== 'meal' ? el('span', { class: 'badge kind-badge' }, `${KIND_INFO[kind].icon} ${KIND_INFO[kind].label}`) : null,
                recipe.premade ? null : el('span', { class: `badge ${recipe.difficulty}` }, DIFFICULTY[recipe.difficulty]),
                recipe.time ? el('span', { class: 'badge' }, `⏱ ${timeText(recipe.time)}`) : null,
                stock.total ? el('span', { class: `badge ${stock.have === stock.total ? 'have-all' : ''}` }, stockLabel(recipe, stock)) : null)),
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

  // ---------- Ingredient amounts ----------
  //
  // Reads "200g egg noodles", "2 tbsp soy sauce", "1 tin chopped tomatoes", "4 chicken thighs"
  // into an amount, a unit and the ingredient, so the shopping list can add up what several
  // meals need and take off what's already in stock.

  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  // unit word -> [family, how many base units one of it is]
  const UNITS = {
    g: ['g', 1], gram: ['g', 1], grams: ['g', 1], kg: ['g', 1000], kilo: ['g', 1000], kilos: ['g', 1000], oz: ['g', 28.35], lb: ['g', 453.6], lbs: ['g', 453.6],
    ml: ['ml', 1], millilitre: ['ml', 1], millilitres: ['ml', 1], cl: ['ml', 10], l: ['ml', 1000], litre: ['ml', 1000], litres: ['ml', 1000], liter: ['ml', 1000], liters: ['ml', 1000],
    tsp: ['tsp', 1], teaspoon: ['tsp', 1], teaspoons: ['tsp', 1], tbsp: ['tsp', 3], tablespoon: ['tsp', 3], tablespoons: ['tsp', 3],
    cup: ['cup', 1], cups: ['cup', 1],
    tin: ['tin', 1], tins: ['tin', 1], can: ['tin', 1], cans: ['tin', 1],
    pack: ['pack', 1], packs: ['pack', 1], packet: ['pack', 1], packets: ['pack', 1],
    jar: ['jar', 1], jars: ['jar', 1], bottle: ['bottle', 1], bottles: ['bottle', 1], bag: ['bag', 1], bags: ['bag', 1],
    bunch: ['bunch', 1], bunches: ['bunch', 1], handful: ['handful', 1], handfuls: ['handful', 1],
    slice: ['slice', 1], slices: ['slice', 1], clove: ['clove', 1], cloves: ['clove', 1], pinch: ['pinch', 1], pinches: ['pinch', 1],
    sprig: ['sprig', 1], sprigs: ['sprig', 1], sachet: ['sachet', 1], sachets: ['sachet', 1], stick: ['stick', 1], sticks: ['stick', 1],
  };
  const UNIT_WORDS = Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|');
  const SIZE_WORDS = /\b(large|small|medium|big|fresh|ripe|free.range|organic|skinless|boneless|good.quality|heaped|level|rounded)\b/g;

  function readNumber(text) {
    const t = text.trim();
    if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
    const mixed = t.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/) || t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + (mixed[3] ? Number(mixed[2]) / Number(mixed[3]) : FRACTIONS[mixed[2]]);
    const frac = t.match(/^(\d+)\/(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const n = parseFloat(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const NUMBER = '(\\d+\\s+\\d+\\/\\d+|\\d+\\s*[½¼¾⅓⅔⅛]|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔⅛])';
  const AMOUNT_RE = new RegExp(`^${NUMBER}(?:\\s*(?:-|–|to)\\s*${NUMBER})?\\s*(?:(${UNIT_WORDS})\\b\\.?)?\\s*`, 'i');

  function parseIngredient(line) {
    let rest = line.trim().replace(/^[\s•●▪◦*·\-–—]+/, '');
    let qty = null;
    let unit = null;
    let countBeforeSize = null;
    const first = rest.match(AMOUNT_RE);
    if (first) {
      qty = readNumber(first[2] || first[1]);   // "2-3" counts as 3
      unit = first[3] ? first[3].toLowerCase() : null;
      rest = rest.slice(first[0].length);
      // "2 x 400g tins of tomatoes": multiply out.
      const times = rest.match(new RegExp(`^(?:x|×)\\s*${NUMBER}\\s*(?:(${UNIT_WORDS})\\b\\.?)?\\s*`, 'i'));
      if (times && !unit) {
        countBeforeSize = qty;
        qty *= readNumber(times[1]);
        unit = times[2] ? times[2].toLowerCase() : null;
        rest = rest.slice(times[0].length);
      }
    }
    // "400g tin of tomatoes" or "2 x 400g tins": count the tins, packs or jars, as you'd buy them.
    const container = first && rest.match(/^(tins?|cans?|packs?|packets?|jars?|bottles?|bags?)\b\s*/i);
    if (container && unit && UNITS[unit] && ['g', 'ml'].includes(UNITS[unit][0])) {
      qty = countBeforeSize !== null ? countBeforeSize : 1;
      unit = container[1].toLowerCase();
      rest = rest.slice(container[0].length);
    }
    rest = rest.replace(/^of\s+/i, '');
    let name = rest.split(/,|\s\(|;/)[0].trim().replace(/\s+(to serve|optional)$/i, '');
    // "2 garlic cloves": the unit comes after the name.
    const after = !unit && name.match(/^(.*?)\s+(cloves?|slices?|sprigs?)$/i);
    if (after) { name = after[1]; unit = after[2].toLowerCase(); }
    const [family, factor] = unit && UNITS[unit] ? UNITS[unit] : ['each', 1];
    const base = qty === null ? null : qty * factor;
    const key = singular(name.toLowerCase().replace(SIZE_WORDS, ' ').replace(/\s+/g, ' ').trim());
    return { name: name || line.trim(), key, family, amount: base };
  }

  const keysMatch = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));

  function trimNumber(n) {
    return String(Math.round(n * 100) / 100);
  }

  function pluralWord(word, n) {
    if (n === 1 || /s$/i.test(word)) return word;
    if (/(ch|sh|x)$/i.test(word)) return `${word}es`;
    if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
    if (/(tomato|potato|mango)$/i.test(word)) return `${word}es`;
    return `${word}s`;
  }

  // One family's total, written the way a shopping list would: "1.2kg", "2 tbsp", "3 tins".
  function totalText(family, total, name) {
    if (family === 'g') return total >= 1000 ? `${trimNumber(total / 1000)}kg ${name}` : `${trimNumber(total)}g ${name}`;
    if (family === 'ml') return total >= 1000 ? `${trimNumber(total / 1000)}L ${name}` : `${trimNumber(total)}ml ${name}`;
    if (family === 'tsp') {
      const tbsp = Math.floor(total / 3 + 1e-9);
      const tsp = Math.round((total - tbsp * 3) * 100) / 100;
      const parts = [tbsp ? `${tbsp} tbsp` : null, tsp ? `${trimNumber(tsp)} tsp` : null].filter(Boolean);
      return `${parts.join(' + ')} ${name}`;
    }
    if (family === 'each') {
      const words = name.split(' ');
      words[words.length - 1] = pluralWord(words[words.length - 1], total);
      return `${trimNumber(total)} ${words.join(' ')}`;
    }
    if (family === 'clove') return `${trimNumber(total)} ${name} ${pluralWord('clove', total)}`;
    return `${trimNumber(total)} ${pluralWord(family, total)} ${name}`;
  }

  // How much of an ingredient is in Food, in the same family, or "covered" if it's there in a
  // unit we can't compare (so it doesn't end up on the list, as before).
  function stockAmount(key, family) {
    let total = 0;
    let covered = false;
    for (const item of data.items) {
      if (!(item.qty > 0)) continue;
      const d = warnDays(item);
      if (d !== null && d < 0) continue;   // gone off doesn't count
      const food = parseIngredient(item.name).key;
      if (!keysMatch(food, key)) continue;
      const unit = (item.unit || '').trim().toLowerCase().replace(/\.$/, '');
      const [fam, factor] = !unit || unit === 'items' || unit === 'item' ? ['each', 1] : UNITS[unit] || [unit, 1];
      if (fam === family) total += item.qty * factor;
      else covered = true;
    }
    return { total, covered };
  }

  // What the given meals (this week's by default) need that isn't in stock: one line per
  // ingredient, with the amounts added up across every meal it's in.
  function shoppingList(recipes = plannedRecipes()) {
    const byKey = new Map();
    for (const recipe of recipes) {
      const counted = new Set();
      for (const line of recipe.ingredients) {
        if (!line.trim()) continue;
        const p = parseIngredient(line);
        if (p.key.length < 2) continue;
        let entry = [...byKey.values()].find((e) => keysMatch(e.key, p.key));
        if (!entry) {
          entry = { key: p.key, name: p.name, type: guessType(line), amounts: {}, unmeasured: false, uses: new Map() };
          byKey.set(p.key, entry);
        }
        if (p.amount === null) entry.unmeasured = true;
        else entry.amounts[p.family] = (entry.amounts[p.family] || 0) + p.amount;
        if (!counted.has(entry)) {
          counted.add(entry);
          entry.uses.set(recipe.name, (entry.uses.get(recipe.name) || 0) + 1);
        }
      }
    }
    const out = [];
    for (const entry of byKey.values()) {
      const parts = [];
      const need = {};
      let anyStock = false;
      for (const [family, total] of Object.entries(entry.amounts)) {
        const have = stockAmount(entry.key, family);
        if (have.covered && !have.total) { anyStock = true; continue; }
        const left = total - have.total;
        if (have.total) anyStock = true;
        if (left > 0.0001) { parts.push(totalText(family, left, entry.name)); need[family] = left; }
      }
      if (!Object.keys(entry.amounts).length) {
        // No amounts given anywhere: just the name, unless it's in stock.
        if (stockFor(entry.name)) continue;
        parts.push(entry.name.charAt(0).toUpperCase() + entry.name.slice(1));
      } else if (!parts.length) {
        continue;   // stock covers it
      }
      if (!parts.length && anyStock) continue;
      out.push({
        line: parts.join(' + '),
        name: entry.name,
        need,
        key: entry.key,
        type: entry.type,
        recipes: [...entry.uses].filter(([name]) => name.toLowerCase() !== entry.name.toLowerCase())
          .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)),
      });
    }
    const order = FOOD_TYPES.map(([id]) => id);
    return out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  function shoppingByType(list) {
    return FOOD_TYPES.map(([id, icon, label]) => ({ icon, label, lines: list.filter((x) => x.type === id) }))
      .filter((group) => group.lines.length);
  }

  // Plan tab: what this week's meals need that isn't in stock or on the shopping list yet.
  function renderShopping() {
    const all = shoppingList();
    const list = all.filter((entry) => needStatus(entry) !== 'covered');
    const planned = plannedRecipes().length;
    $('#shopping').replaceChildren(...shoppingByType(list).map(({ icon, label, lines }) =>
      el('li', { class: 'shopping-group' },
        el('h3', {}, `${icon} ${label}`),
        el('ul', { class: 'suggest-list' }, lines.map(({ line, recipes }) =>
          el('li', {},
            el('span', {}, line, el('span', { class: 'for' }, ` · for ${recipes.join(', ')}`)),
            el('button', { type: 'button', class: 'btn btn-small', onclick: () => { addNeeded(lines.find((x) => x.line === line)); save(); render(); } }, '+ List')))))));
    $('#shopping-empty').hidden = list.length > 0;
    $('#shopping-empty').textContent = !planned
      ? 'Pick some meals above and anything you don’t have in stock will be listed here.'
      : all.length ? 'Everything you need for this week’s meals is on your shopping list.' : 'You already have everything for this week’s meals.';
    $('#copy-shopping').hidden = list.length === 0;
  }

  $('#copy-shopping').addEventListener('click', () => {
    for (const entry of shoppingList()) addNeeded(entry);
    save();
    render();
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
                    `${r.time ? ' · ' : ''}${stock.have === stock.total ? (r.premade ? 'In stock' : 'All in stock') : stockLabel(r, stock)}`) : null)));
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
    renderShopList($('#dash-shop'), 'dash');
  }

  // ---------- Shopping list ----------
  //
  // A list the household adds to: by hand, from a meal's missing ingredients, or from the
  // suggestions for planned meals. Ticked items can be moved into Food once you're home.

  const shopKey = (text) => parseIngredient(text).key;

  function listItemFor(key) {
    if (key.length < 2) return null;
    return data.shopping.find((s) => !s.done && keysMatch(shopKey(s.name), key)) || null;
  }

  function onShoppingList(text) {
    return !!listItemFor(shopKey(text));
  }

  // The amounts already on a list item, e.g. "1 tin chopped tomatoes + 400g chopped tomatoes".
  function listAmounts(item) {
    const amounts = {};
    for (const part of item.name.split(' + ')) {
      const p = parseIngredient(part);
      if (p.amount !== null) amounts[p.family] = (amounts[p.family] || 0) + p.amount;
    }
    return amounts;
  }

  // For an ingredient the meal plan needs: 'new' if it's not on the list, 'update' if a
  // meal-plan item for it should change, 'covered' if it's there already (or the person
  // added it themselves, which we leave alone). 'exact' (Fill from meal plan) sets the
  // amount for the dates picked; 'atleast' (suggestions) only ever asks for more.
  function needStatus(entry, mode = 'atleast') {
    const item = listItemFor(entry.key);
    if (!item) return 'new';
    if (!item.fromPlan) return 'covered';
    if (mode === 'exact') return item.name !== entry.line ? 'update' : 'covered';
    const have = listAmounts(item);
    return Object.entries(entry.need || {}).some(([family, n]) => n > (have[family] || 0) + 0.0001) ? 'update' : 'covered';
  }

  // Put a meal-plan ingredient on the list, or update the amount if it's already there.
  function addNeeded(entry, mode = 'atleast') {
    if (!entry) return 'covered';
    const status = needStatus(entry, mode);
    const note = entry.recipes.join(', ').slice(0, 120);
    if (status === 'new') {
      data.shopping.push({ id: uid(), name: entry.line.slice(0, 120), type: entry.type, done: false, note, fromPlan: true, addedBy: myId(), added: new Date().toISOString() });
    } else if (status === 'update') {
      const item = listItemFor(entry.key);
      if (mode === 'exact' || !entry.need) {
        item.name = entry.line.slice(0, 120);
        item.note = note;
      } else {
        // Keep whichever is bigger for each kind of amount, so a suggestion never lowers it.
        const have = listAmounts(item);
        const merged = { ...have };
        for (const [family, n] of Object.entries(entry.need)) merged[family] = Math.max(n, have[family] || 0);
        item.name = Object.entries(merged).map(([family, n]) => totalText(family, n, entry.name)).join(' + ').slice(0, 120);
        const notes = new Set([...(item.note ? item.note.split(', ') : []), ...entry.recipes]);
        item.note = [...notes].join(', ').slice(0, 120);
      }
      item.type = entry.type;
    }
    // Tidy up any repeats of the same ingredient left from before.
    const keep = listItemFor(entry.key);
    data.shopping = data.shopping.filter((s) => s === keep || s.done || !s.fromPlan || !keysMatch(shopKey(s.name), entry.key));
    return status;
  }

  function addToShopping(name, note) {
    const clean = name.trim().slice(0, 120);
    if (!clean || onShoppingList(clean)) return false;
    data.shopping.push({ id: uid(), name: clean, type: guessType(clean), done: false, note: (note || '').slice(0, 120), addedBy: myId(), added: new Date().toISOString() });
    return true;
  }

  function placeFor(type) {
    const find = (re) => data.places.find((p) => re.test(p.name));
    if (['meat', 'dairy'].includes(type)) return (find(/fridge/i) || data.places[0]).id;
    if (type === 'produce') return (find(/fridge|veg|fruit/i) || find(/cupboard|pantry/i) || data.places[0]).id;
    return (find(/cupboard|pantry|larder|shelf/i) || data.places[0]).id;
  }

  // Turn "200g egg noodles" into a food item called "Egg noodles".
  function foodFromText(text, placeId) {
    const base = ingredientName(text) || text.trim();
    const name = (base.charAt(0).toUpperCase() + base.slice(1)).replace(/,.*$/, '').trim().slice(0, 80);
    const type = guessType(name);
    data.items.push({ id: uid(), addedBy: myId(), name, type, placeId: placeId || placeFor(type), expiry: null, dateKind: defaultDateKind(type), qty: 1, unit: '', full: null, notes: '' });
  }

  function shopSuggestions() {
    return upcomingShopping().list.filter((entry) => needStatus(entry) !== 'covered');
  }

  function renderShopList(container, prefix) {
    const pending = data.shopping.filter((s) => !s.done);
    const done = data.shopping.filter((s) => s.done);
    const suggestions = prefix === 'dash' ? shopSuggestions() : [];
    const row = (item) => {
      const id = `${prefix}-shop-${item.id}`;
      const who = item.addedBy && data.members.find((m) => m.id === item.addedBy);
      return el('li', { class: item.done ? 'done' : '' },
        el('input', { type: 'checkbox', id, checked: item.done ? 'checked' : null, onchange: (e) => { item.done = e.target.checked; save(); render(); } }),
        el('label', { for: id }, who ? addedByAvatar(item) : null, item.name, item.note ? el('span', { class: 'for' }, ` · for ${item.note}`) : null),
        el('button', { type: 'button', class: 'btn btn-icon shop-remove', title: `Remove ${item.name}`, 'aria-label': `Remove ${item.name}`, onclick: () => { data.shopping = data.shopping.filter((s) => s.id !== item.id); save(); render(); } }, '×'));
    };
    const groups = FOOD_TYPES.map(([type, icon, label]) => ({ icon, label, items: pending.filter((s) => (TYPE_INFO[s.type] ? s.type : 'other') === type) }))
      .filter((g) => g.items.length);

    // Keep anything half-typed (and the cursor) when the list redraws, e.g. after a sync.
    const old = document.getElementById(`${prefix}-shop-new`);
    const typed = old ? old.value : '';
    const hadFocus = old && document.activeElement === old;
    const input = el('input', { type: 'text', id: `${prefix}-shop-new`, placeholder: 'Add something, e.g. milk', 'aria-label': 'Add to shopping list', autocomplete: 'off' });
    input.value = typed;
    const add = () => {
      const parts = input.value.split(',').map((x) => x.trim()).filter(Boolean);
      if (!parts.length) { input.focus(); return; }
      const added = parts.filter((x) => addToShopping(x));
      input.value = '';
      save();
      render();
      const again = document.getElementById(`${prefix}-shop-new`);
      if (again) again.focus();
      if (added.length < parts.length) flashShop(prefix, 'Already on the list.');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    container.replaceChildren(...[
      el('div', { class: 'shop-add' }, input, el('button', { type: 'button', class: 'btn btn-primary', onclick: add }, 'Add')),
      el('p', { class: 'ai-status', id: `${prefix}-shop-flash`, role: 'status', hidden: 'hidden' }),
      suggestions.length
        ? el('div', { class: 'shop-suggest' },
            el('span', {}, `${plural(suggestions.length, 'thing', 'things')} for the next 7 days of meals ${suggestions.length === 1 ? 'needs' : 'need'} adding to the list, or more of.`),
            el('button', { type: 'button', class: 'btn btn-small', onclick: () => {
              for (const entry of suggestions) addNeeded(entry);
              save();
              render();
            } }, 'Add them'))
        : null,
      groups.length
        ? el('ul', { class: 'shopping-list' }, groups.map(({ icon, label, items }) =>
            el('li', { class: 'shopping-group' }, el('h4', {}, `${icon} ${label}`), el('ul', { class: 'tick-list' }, items.map(row)))))
        : el('p', { class: 'muted' }, done.length ? 'All done. Nice shopping.' : 'Your shopping list is empty. Add things above, or plan some meals.'),
      done.length
        ? el('div', { class: 'shop-done' },
            el('h4', {}, `Ticked (${done.length})`),
            el('ul', { class: 'tick-list' }, done.map(row)),
            el('div', { class: 'shop-done-actions' },
              el('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: () => {
                for (const item of done) foodFromText(item.name, placeFor(TYPE_INFO[item.type] ? item.type : guessType(item.name)));
                data.shopping = data.shopping.filter((s) => !s.done);
                save();
                render();
                flashShop(prefix, `Put ${done.length} thing${done.length === 1 ? '' : 's'} in Food. Add dates there if you like.`);
              } }, 'Put ticked in Food'),
              el('button', { type: 'button', class: 'btn btn-small', onclick: () => { data.shopping = data.shopping.filter((s) => !s.done); save(); render(); } }, 'Clear ticked')))
        : null].filter(Boolean));
    if (hadFocus) input.focus();
    const countEl = document.getElementById(`${prefix}-shop-count`);
    if (countEl) countEl.textContent = pending.length ? `${pending.length} to get` : '';
    const copyEl = document.getElementById(`${prefix}-shop-copy`);
    if (copyEl) copyEl.hidden = pending.length === 0;
  }

  function flashShop(prefix, text) {
    const box = document.getElementById(`${prefix}-shop-flash`);
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => { box.hidden = true; }, 3000);
  }

  function shopListText() {
    const pending = data.shopping.filter((s) => !s.done);
    return FOOD_TYPES.map(([type, icon, label]) => {
      const items = pending.filter((s) => (TYPE_INFO[s.type] ? s.type : 'other') === type);
      return items.length ? `${icon} ${label}\n${items.map((s) => `- ${s.name}`).join('\n')}` : null;
    }).filter(Boolean).join('\n\n');
  }

  for (const prefix of ['dash', 'tab']) {
    const btn = document.getElementById(`${prefix}-shop-copy`);
    btn.addEventListener('click', async () => {
      const text = shopListText();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy list'; }, 1500);
      } catch (e) {
        prompt('Copy your shopping list:', text);
      }
    });
  }

  function renderShopTab() {
    renderShopList($('#tab-shop-list'), 'tab');
    renderFill();
  }

  // "Fill from meal plan": add what the meals between two dates need.
  function fillRange() {
    const from = $('#fill-from').value;
    const to = $('#fill-to').value;
    if (!from || !to) return null;
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (end < start) return { error: 'The end date is before the start date.' };
    const days = Math.round((end - start) / 86400000) + 1;
    if (days > 62) return { error: 'Pick up to two months at a time.' };
    const recipes = [];
    let meals = 0;
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      for (const [meal] of MEALS) {
        const dishes = dayRecipes(date, meal);
        if (dishes.length) meals++;
        recipes.push(...dishes);
      }
    }
    const needed = shoppingList(recipes).filter((entry) => needStatus(entry, 'exact') !== 'covered');
    return { meals, needed };
  }

  function setFillRange(fromDate, toDate) {
    $('#fill-from').value = isoDate(fromDate);
    $('#fill-to').value = isoDate(toDate);
    renderFill();
  }

  function renderFill() {
    if (!$('#fill-from').value) setFillDefaults();
    const result = fillRange();
    const summary = $('#fill-summary');
    const preview = $('#fill-preview');
    const button = $('#fill-add');
    if (!result || result.error) {
      summary.textContent = result ? result.error : 'Pick the dates to shop for.';
      preview.replaceChildren();
      button.disabled = true;
      return;
    }
    const { meals, needed } = result;
    summary.textContent = !meals
      ? 'No meals are planned for those dates yet.'
      : needed.length
        ? `${plural(meals, 'meal', 'meals')} planned. You need to get ${plural(needed.length, 'thing', 'things')} (amounts are totals for these dates, minus what's in Food):`
        : `${plural(meals, 'meal', 'meals')} planned, and you already have or are getting everything for them.`;
    const shown = needed.slice(0, 8);
    preview.replaceChildren(...shown.map(({ line, recipes }) =>
      el('li', {}, line, el('span', { class: 'for' }, ` · ${recipes.join(', ')}`))),
      ...(needed.length > shown.length ? [el('li', { class: 'muted' }, `and ${needed.length - shown.length} more`)] : []));
    button.disabled = needed.length === 0;
    button.textContent = needed.length ? `Add ${plural(needed.length, 'thing', 'things')} to list` : 'Add to list';
  }

  function setFillDefaults() {
    const today = addDays(new Date(), 0);
    $('#fill-from').value = isoDate(today);
    $('#fill-to').value = isoDate(addDays(today, 6));
  }

  $('#fill-from').addEventListener('change', renderFill);
  $('#fill-to').addEventListener('change', renderFill);
  $('#fill-next7').addEventListener('click', () => setFillRange(addDays(new Date(), 0), addDays(new Date(), 6)));
  $('#fill-thisweek').addEventListener('click', () => { const m = mondayOf(new Date()); setFillRange(m, addDays(m, 6)); });
  $('#fill-nextweek').addEventListener('click', () => { const m = addDays(mondayOf(new Date()), 7); setFillRange(m, addDays(m, 6)); });
  $('#fill-add').addEventListener('click', () => {
    const result = fillRange();
    if (!result || result.error || !result.needed.length) return;
    let added = 0;
    let updated = 0;
    for (const entry of result.needed) {
      const status = addNeeded(entry, 'exact');
      if (status === 'new') added++;
      if (status === 'update') updated++;
    }
    save();
    render();
    flashShop('tab', [added ? `Added ${plural(added, 'thing', 'things')}` : null, updated ? `updated the amount of ${plural(updated, 'thing', 'things')}` : null]
      .filter(Boolean).join(' and ').replace(/^./, (c) => c.toUpperCase()) + '.');
  });

  // When a meal is added to the plan, ask about any ingredients that aren't in stock.
  const missingDialog = $('#missing-dialog');
  let missingRecipe = null;

  function askAboutMissing(recipe) {
    const missing = recipe.ingredients.filter((line) => line.trim() && !stockFor(line) && !onShoppingList(line));
    if (!missing.length) return;
    missingRecipe = recipe;
    $('#missing-title').textContent = `${recipe.name} needs`;
    $('#missing-intro').textContent = `${missing.length === 1 ? 'This isn’t' : 'These aren’t'} in your food or on your shopping list. What would you like to do?`;
    const placeOptions = () => data.places.map((p) => el('option', { value: p.id }, `${p.icon ? `${p.icon} ` : ''}${p.name}`));
    $('#missing-list').replaceChildren(...missing.map((line, i) => {
      const choice = el('select', { class: 'missing-choice', 'aria-label': `What to do with ${line}`, 'data-line': line },
        el('option', { value: 'shop' }, '🛒 Add to shopping list'),
        el('option', { value: 'have' }, '✓ I have it'),
        el('option', { value: 'skip' }, 'Skip'));
      const place = el('select', { class: 'missing-place', 'aria-label': `Where ${line} is kept`, hidden: 'hidden' }, placeOptions());
      place.value = placeFor(guessType(line));
      choice.addEventListener('change', () => { place.hidden = choice.value !== 'have'; });
      return el('li', { class: 'missing-row' }, el('span', { class: 'missing-name' }, line), el('div', { class: 'missing-controls' }, choice, place));
    }));
    if (!missingDialog.open) missingDialog.showModal();
  }

  $('#missing-all-shop').addEventListener('click', () => {
    document.querySelectorAll('#missing-list .missing-choice').forEach((c) => { c.value = 'shop'; c.dispatchEvent(new Event('change')); });
  });

  $('#missing-form').addEventListener('submit', () => {
    if (!missingRecipe) return;
    let shop = 0;
    let have = 0;
    for (const rowEl of document.querySelectorAll('#missing-list .missing-row')) {
      const choice = rowEl.querySelector('.missing-choice');
      const line = choice.dataset.line;
      if (choice.value === 'shop') {
        const p = parseIngredient(line);
        const entry = { line: p.amount === null ? p.name.charAt(0).toUpperCase() + p.name.slice(1) : totalText(p.family, p.amount, p.name), key: p.key, type: guessType(line), recipes: missingRecipe.premade ? [] : [missingRecipe.name] };
        if (addNeeded(entry) !== 'covered') shop++;
      }
      if (choice.value === 'have') { foodFromText(line, rowEl.querySelector('.missing-place').value); have++; }
    }
    missingRecipe = null;
    if (shop || have) { save(); render(); }
  });

  // Read-only recipe, opened from the dashboard (handy while cooking).
  const recipeView = $('#recipe-view');
  let viewing = null;

  function openRecipeView(recipe) {
    viewing = recipe;
    const card = renderRecipe(recipe, recipeStock(recipe));
    const details = card.querySelector('details');
    if (details) details.open = true;
    card.querySelectorAll('.recipe-head button').forEach((b) => b.remove());
    $('#recipe-view-body').replaceChildren(card);
    recipeView.showModal();
  }

  $('#recipe-view-share').addEventListener('click', () => {
    recipeView.close();
    if (viewing) openShareRecipe(viewing);
  });

  // ---------- Sharing a recipe by link or QR code ----------
  //
  // The recipe itself travels in the link (#recipe=...), compressed where the browser can, so
  // anyone can open it: no account, household or server needed.

  const SHARE_FIELDS = ['name', 'premade', 'course', 'difficulty', 'time', 'ingredients', 'method', 'source', 'tags'];
  const QR_MAX = 2000;   // longer links make QR codes too dense to scan reliably

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function pipeThrough(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }

  async function encodeRecipe(recipe) {
    const payload = {};
    for (const key of SHARE_FIELDS) {
      const value = recipe[key];
      if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length)) payload[key] = value;
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (typeof CompressionStream === 'function') {
      try { return `z${toBase64Url(await pipeThrough(bytes, new CompressionStream('deflate-raw')))}`; } catch (e) { /* fall back */ }
    }
    return `j${toBase64Url(bytes)}`;
  }

  async function decodeRecipe(code) {
    let bytes = fromBase64Url(code.slice(1));
    if (code[0] === 'z') {
      if (typeof DecompressionStream !== 'function') throw new Error('old-browser');
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } else if (code[0] !== 'j') {
      throw new Error('bad-link');
    }
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('bad-link');
    // Only keep the fields a recipe has, in the shapes the app expects.
    const recipe = {
      name: raw.name.trim().slice(0, 120),
      premade: raw.premade === true,
      course: KIND_INFO[raw.course] ? raw.course : 'meal',
      difficulty: DIFFICULTY[raw.difficulty] ? raw.difficulty : 'easy',
      time: Number.isFinite(raw.time) && raw.time > 0 ? Math.round(raw.time) : null,
      ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.filter((l) => typeof l === 'string').map((l) => l.slice(0, 200)).slice(0, 100) : [],
      method: typeof raw.method === 'string' ? raw.method.slice(0, 10000) : '',
      source: typeof raw.source === 'string' && /^https?:\/\//.test(raw.source) ? raw.source : null,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string').map((t) => t.slice(0, 30)).slice(0, 20) : [],
    };
    return recipe;
  }

  let qrLibrary = null;
  function loadQrLibrary() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLibrary) {
      qrLibrary = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/qrcode.js';
        script.onload = () => resolve(window.qrcode);
        script.onerror = () => { qrLibrary = null; reject(new Error('qr')); };
        document.head.append(script);
      });
    }
    return qrLibrary;
  }

  const shareDialog = $('#share-dialog');
  let shareLink = '';
  let shareName = '';

  async function openShareRecipe(recipe) {
    shareName = recipe.name;
    $('#share-title').textContent = `Share ${recipe.name}`;
    $('#share-qr').replaceChildren(el('p', { class: 'muted' }, 'Making the QR code…'));
    $('#share-link').value = '';
    $('#share-status').hidden = true;
    shareDialog.showModal();
    shareLink = `${location.origin}${location.pathname}#recipe=${await encodeRecipe(recipe)}`;
    $('#share-link').value = shareLink;
    $('#share-native').hidden = !navigator.share;
    if (shareLink.length > QR_MAX) {
      $('#share-qr').replaceChildren(el('p', { class: 'muted' }, 'This recipe is too long for a QR code that phones can scan easily, so send the link instead.'));
      return;
    }
    try {
      const make = await loadQrLibrary();
      const qr = make(0, 'L');
      qr.addData(shareLink);
      qr.make();
      const box = el('div', { class: 'qr-box', role: 'img', 'aria-label': `QR code for ${recipe.name}` });
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
      $('#share-qr').replaceChildren(box, el('p', { class: 'muted qr-hint' }, 'Scan with a phone camera to open the recipe.'));
    } catch (e) {
      $('#share-qr').replaceChildren(el('p', { class: 'muted' }, 'Couldn’t make a QR code here. You can still send the link.'));
    }
  }

  function setShareStatus(text) {
    $('#share-status').textContent = text;
    $('#share-status').hidden = !text;
  }

  $('#share-native').addEventListener('click', async () => {
    try {
      await navigator.share({ title: shareName, text: `Here's my recipe for ${shareName}:`, url: shareLink });
    } catch (e) {
      if (e && e.name !== 'AbortError') setShareStatus('Couldn’t open the share menu. Copy the link instead.');
    }
  });

  $('#share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus('Link copied. Paste it into a message.');
    } catch (e) {
      $('#share-link').select();
      setShareStatus('Press and hold the link above and choose Copy.');
    }
  });

  // Opened from a shared recipe link: preview it and offer to save a copy.
  const sharedDialog = $('#shared-dialog');
  let incoming = null;

  async function handleSharedRecipe() {
    const match = location.hash.match(/^#recipe=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      incoming = await decodeRecipe(match[1]);
    } catch (e) {
      incoming = null;
      $('#shared-body').replaceChildren(el('p', {}, e.message === 'old-browser'
        ? 'This phone’s browser is too old to open shared recipes. Updating it should fix this.'
        : 'That recipe link didn’t work. It may have been cut short when it was copied. Ask for it to be sent again.'));
      $('#shared-save').hidden = true;
      sharedDialog.showModal();
      return;
    }
    const card = renderRecipe({ id: 'incoming', ...incoming }, recipeStock(incoming));
    card.querySelectorAll('.recipe-head button').forEach((b) => b.remove());
    const already = data.recipes.some((r) => r.name.trim().toLowerCase() === incoming.name.toLowerCase());
    $('#shared-body').replaceChildren(
      el('p', { class: 'muted' }, 'Someone shared this recipe with you.'),
      card,
      ...(already ? [el('p', { class: 'muted' }, `You already have a recipe called ${incoming.name}. Saving adds a second copy.`)] : []));
    $('#shared-save').hidden = false;
    sharedDialog.showModal();
  }

  $('#shared-save').addEventListener('click', () => {
    if (!incoming) return;
    data.recipes.push({ id: uid(), addedBy: myId(), ...incoming });
    save();
    render();
    sharedDialog.close();
    $('#shared-body').replaceChildren();
    showTab('recipes');
    incoming = null;
  });

  window.addEventListener('hashchange', handleSharedRecipe);

  $('#recipe-view-edit').addEventListener('click', () => {
    recipeView.close();
    if (viewing) openRecipeDialog(viewing);
  });

  // ---------- Tabs ----------

  const TABS = ['today', 'food', 'recipes', 'plan', 'shop'];

  function showTab(name) {
    for (const tab of TABS) {
      $(`#tab-${tab}`).setAttribute('aria-selected', String(tab === name));
      $(`#${tab}-view`).hidden = tab !== name;
    }
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
      if (!Array.isArray(parsed.shopping)) parsed.shopping = [];
      if (!confirm('Replace your current food list, recipes and meal plan with the imported ones?')) return;
      data = parsed;
      save();
      render();
    } catch (err) {
      alert('That file could not be imported.');
    }
  });

  // ---------- Excel template ----------
  //
  // Download a blank food template (with dropdowns for places, types and date kinds) and
  // upload a filled-in one, or a CSV, to add food in bulk.

  const SHEET_COLUMNS = [
    ['name', 'Food', 26],
    ['place', "Where it's kept", 18],
    ['qty', 'How much is left', 16],
    ['unit', 'Unit', 10],
    ['full', 'Full amount', 12],
    ['expiry', 'Goes off', 13],
    ['dateKind', 'Use by or best before', 20],
    ['type', 'Type', 22],
    ['notes', 'Notes', 30],
  ];
  const SHEET_UNITS = ['items', 'g', 'kg', 'ml', 'L', 'packs', 'tins', 'jars', 'portions', 'bags', 'bottles', 'slices'];

  $('#sheet-btn').addEventListener('click', () => $('#sheet-dialog').showModal());

  $('#sheet-template').addEventListener('click', () => {
    const rows = 500;
    const places = data.places.map((p) => p.name);
    const types = FOOD_TYPES.map(([, , label]) => label);
    const lists = [['Places', ...places], ['Use by or best before', 'Use by', 'Best before'], ['Types', ...types], ['Units', ...SHEET_UNITS]];
    const listRows = Array.from({ length: Math.max(...lists.map((l) => l.length)) }, (_, r) =>
      lists.map((l) => (r === 0 ? { v: l[r], s: 'header' } : l[r] ?? '')));
    const col = (key) => String.fromCharCode(65 + SHEET_COLUMNS.findIndex(([k]) => k === key));
    const range = (c, n) => `Lists!$${c}$2:$${c}$${n}`;
    const help = [
      [{ v: 'How to fill in the food template', s: 'title' }],
      [],
      ['1. Fill in one row per food on the Food sheet. Only the Food column is needed.'],
      ["2. Where it's kept: pick a place from the list, or type a new one (e.g. Garage freezer) and it will be added."],
      ['3. How much is left: a number, like 2 or 500. Put what it is in Unit (g, packs, tins…), or just write 500g.'],
      ['4. Full amount (optional): how much there was to start with, so the app can show how much is left.'],
      ['5. Goes off: the date on the packet, like 25/10/2026. Leave it empty for food that keeps.'],
      ['6. Use by or best before: use by dates give warnings when they get close; best before ones don\'t.'],
      ["   Leave it empty and it's picked from the type (meat, fish and dairy are use by)."],
      ["7. Type: leave it empty and it's guessed from the name."],
      ['8. Save, then in the app go to Food → 📊 Excel → Upload filled-in file.'],
      [],
      [{ v: 'Food that is already in the same place is updated, not added twice, so you can upload the same file again after changing it.', s: 'note' }],
    ];
    const blob = Spreadsheet.writeXlsx([
      {
        name: 'Food',
        rows: [SHEET_COLUMNS.map(([, label]) => ({ v: label, s: 'header' }))],
        widths: SHEET_COLUMNS.map(([, , w]) => w),
        colStyles: SHEET_COLUMNS.map(([key]) => (key === 'expiry' ? 'date' : null)),
        freeze: true,
        lists: [
          { col: col('place'), from: range('A', places.length + 1), rows },
          { col: col('unit'), from: range('D', SHEET_UNITS.length + 1), rows },
          { col: col('dateKind'), from: range('B', 3), rows },
          { col: col('type'), from: range('C', types.length + 1), rows },
        ],
      },
      { name: 'How to', rows: help, widths: [110] },
      { name: 'Lists', rows: listRows, widths: [20, 22, 24, 12] },
    ]);
    const a = el('a', { href: URL.createObjectURL(blob), download: 'food-template.xlsx' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });

  // Which field a column heading means (headings can be worded loosely).
  function sheetField(heading) {
    const h = String(heading).toLowerCase().replace(/[^a-z]/g, '');
    if (!h) return null;
    if (/^(food|name|item|product|what)/.test(h)) return 'name';
    if (/^(useby|best|datetype|datekind|kind)/.test(h)) return 'dateKind';
    if (/^(full|total|startingamount|original)/.test(h)) return 'full';
    if (/goesoff|expir|date|^off|^bb/.test(h)) return 'expiry';
    if (/where|place|storage|location|kept|stored/.test(h)) return 'place';
    if (/^unit/.test(h)) return 'unit';
    if (/left|amount|qty|quantity|howmuch|count|number/.test(h)) return 'qty';
    if (/type|category|aisle/.test(h)) return 'type';
    if (/note|comment/.test(h)) return 'notes';
    return null;
  }

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // A spreadsheet date (a day number or text like 25/10/2026) as YYYY-MM-DD, '' if empty,
  // or null if it can't be read. Dates with slashes are read the UK way round.
  function sheetDate(value, date1904) {
    const iso = (y, m, d) => {
      if (y < 100) y += 2000;
      const date = new Date(Date.UTC(y, m - 1, d));
      if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 2000 || y > 2100) return null;
      return date.toISOString().slice(0, 10);
    };
    if (typeof value === 'number') {
      if (value < 30000 || value > 80000) return null;
      const date = new Date(Date.UTC(1899, 11, 30) + (Math.floor(value) + (date1904 ? 1462 : 0)) * 86400000);
      return date.toISOString().slice(0, 10);
    }
    const text = String(value).trim().toLowerCase();
    if (!text) return '';
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = text.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2}|\d{4}))?$/);
    if (m) return iso(m[3] ? +m[3] : new Date().getFullYear(), +m[2], +m[1]);
    m = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([a-z]{3})[a-z]*\.?,?[\s\-]*(\d{2}|\d{4})?$/);
    if (m && MONTHS.includes(m[2])) return iso(m[3] ? +m[3] : new Date().getFullYear(), MONTHS.indexOf(m[2]) + 1, +m[1]);
    return null;
  }

  function sheetType(value, name) {
    const t = String(value).toLowerCase().trim();
    if (t) {
      const found = FOOD_TYPES.find(([id, icon, label]) => t === id || t.includes(icon) || label.toLowerCase().startsWith(t.replace(/^\W+/, '').trim())
        || label.toLowerCase().split(/[,&]/).some((part) => part.trim() && t.includes(part.trim())));
      if (found) return found[0];
    }
    return guessType(name);
  }

  function placeIconFor(name) {
    const n = name.toLowerCase();
    return /freez/.test(n) ? '🧊' : /fridge/.test(n) ? '🥶' : /cupboard|pantry|larder|shelf/.test(n) ? '🥫' : /wine|drink/.test(n) ? '🍷' : /fruit|veg/.test(n) ? '🧺' : '';
  }

  const placeKey = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

  $('#sheet-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let table;
    try {
      table = await Spreadsheet.readTable(file, 'Food');
    } catch (err) {
      alert(err.message === 'old-xls'
        ? 'That is an old-style .xls file. Save it as an Excel Workbook (.xlsx) and try again.'
        : "That file couldn't be read. Upload the .xlsx template (or a .csv file).");
      return;
    }
    // The heading row is the first one with a Food column.
    const headerAt = table.rows.findIndex((row) => row.some((h) => sheetField(h) === 'name'));
    if (headerAt < 0) {
      alert("Couldn't find a Food column. Keep the heading row from the template, with Food in it.");
      return;
    }
    const fields = table.rows[headerAt].map(sheetField);
    const newPlaces = [];
    const findPlace = (name) => [...data.places, ...newPlaces].find((p) => placeKey(p.name) === placeKey(name));
    const adds = [];
    const updates = [];
    let skipped = 0;
    let badDates = 0;
    for (const row of table.rows.slice(headerAt + 1)) {
      const cell = {};
      fields.forEach((f, i) => { if (f && cell[f] == null) cell[f] = row[i] ?? ''; });
      const text = (k) => String(cell[k] ?? '').trim();
      if (!row.some((v) => String(v).trim())) continue;
      const name = text('name').slice(0, 80);
      if (!name) { skipped++; continue; }
      const type = sheetType(cell.type ?? '', name);

      let placeId;
      const placeName = text('place').slice(0, 40);
      if (placeName && placeKey(placeName)) {
        let place = findPlace(placeName);
        if (!place) {
          place = { id: uid(), name: placeName, icon: placeIconFor(placeName) };
          newPlaces.push(place);
        }
        placeId = place.id;
      } else if (data.places.length) {
        placeId = placeFor(type);
      } else if (newPlaces.length) {
        placeId = newPlaces[0].id;
      }
      if (!placeId) {
        const fridge = { id: uid(), name: 'Fridge', icon: '🥶' };
        newPlaces.push(fridge);
        placeId = fridge.id;
      }

      let qty = 1;
      let unit = text('unit').slice(0, 20);
      const amount = cell.qty;
      if (typeof amount === 'number') qty = Math.max(0, amount);
      else if (text('qty')) {
        const m = text('qty').replace(',', '.').match(/^(\d*\.?\d+)\s*(.*)$/);
        if (m) {
          qty = parseFloat(m[1]);
          if (!unit) unit = m[2].trim().slice(0, 20);
        }
      }
      const full = parseFloat(String(cell.full ?? '').replace(',', '.'));
      let expiry = sheetDate(cell.expiry ?? '', table.date1904);
      if (expiry === null) { badDates++; expiry = ''; }
      const kind = text('dateKind').toLowerCase();
      const fieldsFor = {
        name,
        type,
        placeId,
        expiry: expiry || null,
        dateKind: /best/.test(kind) ? 'best' : /use/.test(kind) ? 'useby' : defaultDateKind(type),
        qty: Math.round(qty * 1000) / 1000,
        unit,
        full: full > 0 ? full : null,
        notes: text('notes').slice(0, 200),
      };
      const existing = data.items.find((i) => i.placeId === placeId && i.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) updates.push([existing, fieldsFor]);
      else adds.push(fieldsFor);
    }
    if (!adds.length && !updates.length) {
      alert('There was no food in that file. Fill in at least the Food column, one row per food.');
      return;
    }
    const what = [adds.length && `add ${adds.length} food${adds.length === 1 ? '' : 's'}`, updates.length && `update ${updates.length} already in the app`].filter(Boolean).join(' and ');
    const counts = new Map();
    for (const f of [...adds, ...updates.map(([, f]) => f)]) counts.set(f.placeId, (counts.get(f.placeId) || 0) + 1);
    const summary = [...counts].map(([id, n]) => `${(data.places.find((p) => p.id === id) || newPlaces.find((p) => p.id === id)).name}: ${n}`).join(', ');
    let message = `This will ${what} (${summary}).`;
    if (newPlaces.length) message += `\n\nNew storage places: ${newPlaces.map((p) => p.name).join(', ')}.`;
    if (badDates) message += `\n\n${badDates} date${badDates === 1 ? '' : 's'} couldn't be read, so ${badDates === 1 ? 'that food goes' : 'those foods go'} in without a date. Use a date like 25/10/2026.`;
    if (skipped) message += `\n\n${skipped} row${skipped === 1 ? ' has' : 's have'} no food name and will be skipped.`;
    if (!confirm(message)) return;
    data.places.push(...newPlaces);
    for (const [item, f] of updates) Object.assign(item, f);
    for (const f of adds) data.items.push({ id: uid(), addedBy: myId(), ...f });
    save();
    render();
    $('#sheet-dialog').close();
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
    syncDeviceProfile();
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

  // Your picture in the top-left corner, and the "You" card at the top of the panel it opens.
  function renderProfileButton() {
    const mine = me();
    const btn = $('#me-btn');
    btn.replaceChildren(mine
      ? avatar(mine, 44)
      : el('span', { class: 'avatar avatar-empty', style: 'width:44px;height:44px;font-size:20px' }, '?'));
    btn.classList.toggle('shared', !!household);
    btn.setAttribute('aria-label', `${mine ? mine.name : 'Choose who you are'}: you and your household`);
    btn.title = mine ? `${mine.name} · you and your household` : 'Choose who you are';

    $('#me-card-avatar').replaceChildren(mine
      ? avatar(mine, 64)
      : el('span', { class: 'avatar avatar-empty', style: 'width:64px;height:64px;font-size:28px' }, '?'));
    $('#me-card-name').textContent = mine ? mine.name : 'Who are you?';
    $('#me-card-note').textContent = mine
      ? 'This device is yours. Things you add show your picture.'
      : 'Pick your name so everyone can see who added what.';
    $('#me-edit').textContent = mine ? 'Edit me' : 'Add me';
    $('#me-switch').hidden = !mine && !data.members.length;
  }

  const whoDialog = $('#who-dialog');

  function renderWhoList() {
    const list = $('#who-list');
    const mineId = myId();
    list.replaceChildren(...data.members.map((m) =>
      el('li', {},
        el('button', { type: 'button', class: `who-person ${m.id === mineId ? 'selected' : ''}`, 'aria-pressed': String(m.id === mineId), onclick: () => { setMe(m.id); render(); whoDialog.close(); } },
          avatar(m, 56), el('span', { class: 'who-name' }, m.name), m.id === mineId ? el('span', { class: 'who-me' }, 'This is you') : null),
        m.id === mineId || canManagePeople()
          ? el('button', { type: 'button', class: 'btn btn-icon who-edit', title: `Edit ${m.name}`, 'aria-label': `Edit ${m.name}`, onclick: () => openProfileForm(m) }, '✎')
          : null)));
    $('#who-empty').hidden = data.members.length > 0;
    // Once a household has an owner, only they add other people; anyone can add themselves.
    $('#who-add').hidden = !canManagePeople() && !!me();
    $('#who-add').textContent = canManagePeople() ? '+ Add a person' : '+ Add me';
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
    $('#profile-delete').hidden = !member || !(canManagePeople() || member.id === myId());
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
      if (existing.id === myId()) syncDeviceProfile();
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

  // The panel that opens from your picture: you, your household, people and your data.
  const mePanel = $('#me-panel');

  function openMePanel() {
    renderProfileButton();
    renderHousehold();
    if (!mePanel.open) mePanel.showModal();
  }

  $('#me-btn').addEventListener('click', openMePanel);
  $('#me-panel-close').addEventListener('click', () => mePanel.close());
  // Tapping the dimmed area outside the panel closes it.
  mePanel.addEventListener('click', (e) => { if (e.target === mePanel) mePanel.close(); });
  $('#me-edit').addEventListener('click', () => { if (me()) openProfileForm(me()); else if (data.members.length) openWhoDialog(); else openProfileForm(null); });
  $('#me-switch').addEventListener('click', openWhoDialog);
  $('#who-add').addEventListener('click', () => openProfileForm(null));

  // ---------- Household sharing ----------
  //
  // Each household is households/<code> in Firestore, with one document per place, item,
  // recipe and planned day in the subcollections below. The phone keeps working from its own
  // copy; save() sends only what changed, and changes from other phones arrive as snapshots.

  const HOUSEHOLD_KEY = 'wdywfd-household';
  const COLLECTIONS = ['places', 'items', 'recipes', 'plan', 'members', 'shopping'];
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

  // While sharing: { id, code }. `id` is where the household lives; `code` is the join code
  // people type. Households made before codes could change use their first code as the id.
  let household = null;
  let fb = null;              // { mod, db, auth } once Firebase has loaded
  let unsubscribers = [];
  let ready = new Set();      // collections that have had their first snapshot
  let synced = {};            // collection -> { id: JSON of the last version seen in Firestore }
  let rulesMode = 'unknown';  // 'new' once this phone is registered; 'old' if the rules predate owners
  let owner = null;           // the owner phone's sign-in id, if the household has one
  let devices = [];           // phones in the household: { uid, profileId, name, joined }
  let needsRegister = false;  // couldn't register (e.g. offline); try again when back online

  try {
    household = JSON.parse(localStorage.getItem(HOUSEHOLD_KEY) || 'null');
    if (household && !household.id) household.id = household.code;
  } catch (e) { household = null; }

  function saveHousehold() {
    try {
      if (household) localStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(household));
      else localStorage.removeItem(HOUSEHOLD_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  const myUid = () => (fb && fb.auth.currentUser ? fb.auth.currentUser.uid : null);
  const isOwnerHere = () => rulesMode === 'new' && !!owner && owner === myUid();
  // Owners manage people; before owners existed (or with the older rules) everyone could.
  const canManagePeople = () => !household || rulesMode !== 'new' || !owner || isOwnerHere();

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
          const ref = mod.doc(db, 'households', household.id, name, id);
          if (op === 'set') { batch.set(ref, fields); synced[name][id] = json; }
          else { batch.delete(ref); delete synced[name][id]; }
        }
        batch.commit().catch(() => {
          for (const [, , id] of chunk) {
            if (id in before) synced[name][id] = before[id];
            else delete synced[name][id];
          }
          setHouseholdChip(name === 'members' ? 'profiles not shared yet' : name === 'shopping' ? 'shopping list not shared yet' : 'couldn’t sync your last change');
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
    if ($('#me-panel').open) renderHousehold();
    $('#me-btn').classList.toggle('shared', !!household);
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
    if (rulesMode === 'new') {
      // The household itself (its current code and owner) and the phones in it.
      unsubscribers.push(mod.onSnapshot(mod.doc(db, 'households', household.id), (snap) => {
        const d = snap.data();
        if (!d) return;
        owner = d.owner || null;
        if (d.code && d.code !== household.code) { household.code = d.code; saveHousehold(); }
        render();
      }, (err) => { if (err.code === 'permission-denied') checkStillMember(); }));
      unsubscribers.push(mod.onSnapshot(mod.collection(db, 'households', household.id, 'devices'), (snap) => {
        devices = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        render();
      }, () => {}));
    }
    for (const name of COLLECTIONS) {
      const ref = mod.collection(db, 'households', household.id, name);
      unsubscribers.push(mod.onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
        // Profiles were added later, so an empty cached copy may just mean the server hasn't
        // answered (or older rules refuse them). Keep this phone's profiles until it does.
        if (['members', 'shopping'].includes(name) && snap.empty && snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
        const docs = {};
        const seen = {};
        snap.forEach((d) => { docs[d.id] = d.data(); seen[d.id] = stable(d.data()); });
        synced[name] = seen;
        applyDocs(name, docs);
        ready.add(name);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
        render();
        setHouseholdChip(snap.metadata.hasPendingWrites || snap.metadata.fromCache ? 'waiting for signal' : 'up to date');
      }, (err) => {
        // Refused: either this phone has been removed, or (older rules) this list isn't shared.
        if (err.code === 'permission-denied' && rulesMode === 'new') { checkStillMember(); return; }
        // Still let the other lists sync if this one is refused (e.g. older security rules).
        ready.add(name);
        setHouseholdChip(name === 'members' ? 'profiles not shared yet' : name === 'shopping' ? 'shopping list not shared yet' : 'can’t reach the household');
      }));
    }
  }

  // Make sure this phone is registered in the household. Returns 'member' (already was),
  // 'joined' (just added with the current code), 'old' (the rules predate registration, so
  // everything works as before) or 'removed' (this phone isn't allowed in any more).
  async function registerDevice(code) {
    const { mod, db } = fb;
    const ref = mod.doc(db, 'households', household.id, 'devices', myUid());
    const mine = me();
    const profile = { profileId: mine ? mine.id : null, name: mine ? mine.name : '', lastSeen: new Date().toISOString() };
    let already = false;
    try {
      already = (await mod.getDoc(ref)).exists();
    } catch (e) {
      if (e.code !== 'permission-denied') throw e;
    }
    if (already) {
      await mod.setDoc(ref, profile, { merge: true });
      rulesMode = 'new';
      return 'member';
    }
    try {
      await mod.setDoc(ref, { ...profile, code: code || household.code, joined: new Date().toISOString() });
      rulesMode = 'new';
      return 'joined';
    } catch (e) {
      if (e.code !== 'permission-denied') throw e;
      // Older rules don't have phone records at all, but still let us read the household.
      try {
        await mod.getDoc(mod.doc(db, 'households', household.id));
        rulesMode = 'old';
        return 'old';
      } catch (e2) {
        if (e2.code === 'permission-denied') return 'removed';
        throw e2;
      }
    }
  }

  // Keep this phone's record showing who it belongs to.
  function syncDeviceProfile() {
    if (!household || !fb || rulesMode !== 'new' || !myUid()) return;
    const mine = me();
    fb.mod.setDoc(fb.mod.doc(fb.db, 'households', household.id, 'devices', myUid()),
      { profileId: mine ? mine.id : null, name: mine ? mine.name : '' }, { merge: true }).catch(() => {});
  }

  let checking = false;
  async function checkStillMember() {
    if (checking || !household || !fb) return;
    checking = true;
    try {
      const result = await registerDevice();
      if (result === 'removed') handleRemoved();
    } catch (e) {
      needsRegister = true;
    } finally {
      checking = false;
    }
  }

  function handleRemoved() {
    stopListening();
    household = null;
    owner = null;
    devices = [];
    synced = {};
    saveHousehold();
    setHouseholdChip();
    render();
    alert('This phone is no longer in the household: it was removed, or the household code changed. Everything is still saved on this phone. To rejoin, ask for the new code.');
  }

  async function connectHousehold() {
    if (!household) return;
    setHouseholdChip('connecting');
    try {
      await loadFirebase();
    } catch (e) {
      setHouseholdChip(e.message === 'not-configured' ? 'not set up' : 'waiting for signal');
      return;
    }
    try {
      await ensureSignedIn();
      const result = await registerDevice();
      needsRegister = false;
      if (result === 'removed') { handleRemoved(); return; }
    } catch (e) {
      // Offline: carry on from what's saved on the phone, and register when back online.
      needsRegister = true;
      setHouseholdChip('waiting for signal');
    }
    startListening();
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

  function rememberHousehold(id, code) {
    household = { id, code };
    saveHousehold();
  }

  function randomId() {
    const bytes = new Uint8Array(15);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').toUpperCase();
  }

  async function unusedCode() {
    const { mod, db } = fb;
    for (;;) {
      const code = newCode();
      try {
        if (!(await mod.getDoc(mod.doc(db, 'invites', code))).exists()) return code;
      } catch (e) {
        if (e.code === 'permission-denied') return code;   // older rules: no invites to clash with
        throw e;
      }
    }
  }


  $('#household-create').addEventListener('click', async () => {
    setHouseholdStatus('Creating your household…');
    try {
      await ensureSignedIn();
      const { mod, db } = fb;
      const code = await unusedCode();
      const id = randomId();
      const now = new Date().toISOString();
      const mine = me();
      const batch = mod.writeBatch(db);
      batch.set(mod.doc(db, 'households', id), { owner: myUid(), code, created: mod.serverTimestamp() });
      batch.set(mod.doc(db, 'households', id, 'devices', myUid()), { code, profileId: mine ? mine.id : null, name: mine ? mine.name : '', joined: now, lastSeen: now });
      batch.set(mod.doc(db, 'invites', code), { hid: id });
      try {
        await batch.commit();
        rememberHousehold(id, code);
        rulesMode = 'new';
        owner = myUid();
      } catch (e) {
        if (e.code !== 'permission-denied') throw e;
        // Older rules: a household lives at its code and has no owner.
        await mod.setDoc(mod.doc(db, 'households', code), { created: mod.serverTimestamp() });
        rememberHousehold(code, code);
        rulesMode = 'old';
      }
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
    if (!confirm('Joining replaces the food, recipes and meal plan on this phone with the household’s. Join?')) return;
    setHouseholdStatus('Checking the code…');
    try {
      await ensureSignedIn();
      const { mod, db } = fb;
      // Codes point to a household; households from before codes could change live at their code.
      let id = code;
      try {
        const invite = await mod.getDoc(mod.doc(db, 'invites', code));
        if (invite.exists()) id = invite.data().hid;
      } catch (e) {
        if (e.code !== 'permission-denied') throw e;
      }
      household = { id, code };
      const result = await registerDevice(code);
      if (result === 'removed') {
        household = null;
        setHouseholdStatus('That code didn’t work. Check it, or ask for the latest code: it may have been changed.', true);
        return;
      }
      if (result === 'old' && !(await mod.getDoc(mod.doc(db, 'households', id))).exists()) {
        household = null;
        setHouseholdStatus('There’s no household with that code. Check it and try again.', true);
        return;
      }
      rememberHousehold(id, code);
      synced = {};
      startListening();
      showHouseholdDialog();
      setHouseholdStatus('You’ve joined. Everything you change now is shared.');
      setTimeout(() => { $('#household-dialog').close(); if (!me()) openWhoDialog(); }, 1500);
    } catch (e) {
      household = null;
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
    const others = devices.filter((d) => d.uid !== myUid());
    if (isOwnerHere() && others.length) {
      alert('You’re the owner. Make someone else the owner first (under Phones in this household), then you can leave.');
      return false;
    }
    if (!confirm('Stop sharing on this phone? It keeps a copy of everything as it is now, and the others keep the household.')) return false;
    if (fb && rulesMode === 'new' && myUid()) {
      const batch = fb.mod.writeBatch(fb.db);
      batch.delete(fb.mod.doc(fb.db, 'households', household.id, 'devices', myUid()));
      batch.commit().catch(() => {});
    }
    stopListening();
    household = null;
    owner = null;
    devices = [];
    synced = {};
    saveHousehold();
    setHouseholdChip();
    return true;
  }

  // ---------- Owner controls ----------

  // A fresh join code. Phones already in the household stay in; the old code stops working.
  async function changeCode(batch) {
    const { mod, db } = fb;
    const oldCode = household.code;
    const code = await unusedCode();
    batch.update(mod.doc(db, 'households', household.id), { code });
    batch.set(mod.doc(db, 'invites', code), { hid: household.id });
    try {
      if ((await mod.getDoc(mod.doc(db, 'invites', oldCode))).exists()) batch.delete(mod.doc(db, 'invites', oldCode));
    } catch (e) { /* no old invite to retire */ }
    return code;
  }

  async function newHouseholdCode() {
    if (!isOwnerHere()) return;
    if (!confirm('Make a new household code? Everyone already in the household stays in, but the old code and invite links stop working.')) return;
    try {
      const batch = fb.mod.writeBatch(fb.db);
      const code = await changeCode(batch);
      await batch.commit();
      household.code = code;
      saveHousehold();
      render();
      setHomeStatus(`New code: ${code}. Send it to anyone who still needs to join.`);
    } catch (e) {
      setHomeStatus('Couldn’t change the code. Check you have signal and try again.');
    }
  }

  async function removeDevice(device) {
    if (!isOwnerHere() || device.uid === myUid()) return;
    const label = deviceLabel(device);
    if (!confirm(`Remove ${label} from the household? It stops getting updates straight away, and the household code changes so it can't rejoin with the old one.`)) return;
    try {
      const batch = fb.mod.writeBatch(fb.db);
      batch.delete(fb.mod.doc(fb.db, 'households', household.id, 'devices', device.uid));
      const code = await changeCode(batch);
      await batch.commit();
      household.code = code;
      saveHousehold();
      render();
      setHomeStatus(`Removed ${label}. The new household code is ${code}.`);
    } catch (e) {
      setHomeStatus('Couldn’t remove that phone. Check you have signal and try again.');
    }
  }

  async function makeOwner(device) {
    if (!isOwnerHere()) return;
    if (!confirm(`Make ${deviceLabel(device)} the owner? You won’t be able to change the code or remove phones any more.`)) return;
    try {
      const batch = fb.mod.writeBatch(fb.db);
      batch.update(fb.mod.doc(fb.db, 'households', household.id), { owner: device.uid });
      await batch.commit();
      setHomeStatus(`${deviceLabel(device)} is now the owner.`);
    } catch (e) {
      setHomeStatus('Couldn’t change the owner. Check you have signal and try again.');
    }
  }

  // Households from before owners existed: the first phone to claim it becomes the owner.
  async function claimOwner() {
    if (rulesMode !== 'new' || owner) return;
    if (!confirm('Become the owner of this household? You’ll be able to change the code, remove phones and manage people.')) return;
    try {
      const { mod, db } = fb;
      const batch = mod.writeBatch(db);
      batch.update(mod.doc(db, 'households', household.id), { owner: myUid(), code: household.code });
      let inviteExists = false;
      try { inviteExists = (await mod.getDoc(mod.doc(db, 'invites', household.code))).exists(); } catch (e) { /* none */ }
      if (!inviteExists) batch.set(mod.doc(db, 'invites', household.code), { hid: household.id });
      await batch.commit();
      owner = myUid();
      render();
      setHomeStatus('You’re now the owner of this household.');
    } catch (e) {
      setHomeStatus('Couldn’t make you the owner. Someone else may have just claimed it, or check your signal.');
    }
  }

  function deviceLabel(device) {
    const person = device.profileId && data.members.find((m) => m.id === device.profileId);
    const name = person ? person.name : device.name;
    return device.uid === myUid() ? 'This phone' : name ? `${name}’s phone` : 'An unnamed phone';
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
    renderOwnerControls(shared);

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
          isMe || canManagePeople() ? el('button', { type: 'button', class: 'btn btn-icon', title: `Edit ${m.name}`, 'aria-label': `Edit ${m.name}`, onclick: () => openProfileForm(m) }, '✎') : null));
    }));
    $('#home-people-empty').hidden = data.members.length > 0;
    $('#home-add-person').hidden = !canManagePeople() && !!me();
    $('#home-add-person').textContent = canManagePeople() ? '+ Add a person' : '+ Add me';

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
  $('#home-newcode').addEventListener('click', newHouseholdCode);
  $('#home-claim').addEventListener('click', claimOwner);

  function renderOwnerControls(shared) {
    const newRules = shared && rulesMode === 'new';
    $('#home-owner').hidden = !newRules;
    $('#home-newcode').hidden = !(newRules && isOwnerHere());
    $('#home-claim').hidden = !(newRules && !owner);
    $('#home-rules-note').hidden = !(shared && rulesMode === 'old');
    $('#home-devices-wrap').hidden = !newRules;
    if (!newRules) return;
    const ownerDevice = devices.find((d) => d.uid === owner);
    $('#home-owner').textContent = !owner
      ? 'No one owns this household yet. The owner can change the code, remove phones and manage people.'
      : isOwnerHere() ? 'You’re the owner. You can change the code, remove phones and manage people.'
        : `${ownerDevice ? deviceLabel(ownerDevice).replace(/’s phone$/, '') : 'Someone'} is the owner.`;
    const list = [...devices].sort((a, b) => (b.uid === myUid()) - (a.uid === myUid()) || String(a.joined).localeCompare(String(b.joined)));
    $('#home-devices').replaceChildren(...list.map((d) => {
      const person = d.profileId && data.members.find((m) => m.id === d.profileId);
      const joined = d.joined ? new Date(d.joined).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return el('li', { class: 'device' },
        person ? avatar(person, 36) : el('span', { class: 'avatar avatar-empty', style: 'width:36px;height:36px;font-size:16px' }, '📱'),
        el('div', { class: 'device-info' },
          el('div', { class: 'device-name' }, deviceLabel(d),
            d.uid === owner ? el('span', { class: 'you-tag owner-tag' }, 'Owner') : null),
          el('div', { class: 'muted device-meta' }, joined ? `Joined ${joined}` : '')),
        isOwnerHere() && d.uid !== myUid()
          ? el('div', { class: 'device-actions' },
              el('button', { type: 'button', class: 'btn btn-small', onclick: () => makeOwner(d) }, 'Make owner'),
              el('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: () => removeDevice(d) }, 'Remove'))
          : null);
    }));
  }
  $('#home-add-person').addEventListener('click', () => openProfileForm(null));

  // Opened from an invite link: #join=CODE
  function handleInvite() {
    const match = location.hash.match(/^#join=([A-Za-z0-9-]+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    const code = normaliseCode(match[1]);
    if (household && (household.code === code || household.id === code)) return;
    if (household) {
      showHouseholdDialog();
      setHouseholdStatus(`To join ${code}, leave this household first.`, true);
      return;
    }
    showHouseholdDialog(code);
  }

  window.addEventListener('hashchange', handleInvite);
  window.addEventListener('online', () => {
    if (!household || !fb) return;
    if (needsRegister) connectHousehold();
    else ensureSignedIn().catch(() => {});
  });

  render();
  setHouseholdChip();
  connectHousehold();
  handleShare();
  handleInvite();
  handleSharedRecipe();

  // Offline support and asking the browser not to clear our saved data.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
