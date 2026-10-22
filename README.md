# What do you want for dinner?

A simple dashboard for keeping track of the food you have at home.

- **Storage places** – starts with Fridge, Freezer and Cupboard; add, rename or delete your own (e.g. "Garage freezer", "Spice rack").
- **Food items** – for each item record which storage place it's in, when it goes off, how much is left (with a unit), and optionally the full amount so you get a "how much is left" bar.
- **Dashboard** – totals for items, things going off in the next 3 days, things that have gone off, and things running low.
- **Use these first** – a list of food that's about to go off, so you know what to cook tonight.
- Search, sort (soonest to go off, name, least left), a quick "−1" button to use some up, and export/import of your data as JSON.
- **Recipes tab** – store recipes with their ingredients (one per line), an optional method, a difficulty level (easy / medium / hard) and the total time. Each recipe shows how many of its ingredients you have in stock, and you can sort by most ingredients in stock, quickest or easiest, or filter by difficulty.
- **Recipes from Pinterest / TikTok** – save a recipe's link (it shows an "Open on Pinterest / TikTok" button), paste the caption or recipe text to fill in the ingredients and method automatically, or on Android share a pin or video straight to the installed app (**Share → Dinner**).
- **AI recipe writer** – share a TikTok or Pinterest link (or paste one) and tap **✨ Write the recipe for me**: Claude reads the post's caption and any recipe page it links to, and fills in the name, ingredients, method, difficulty and time for you to check and save. Needs your own Anthropic API key, added under **✨ AI recipe writer** at the bottom of the page; the key stays on the device. When the app is opened from the share menu with a key saved, it starts writing straight away.
- **Meal plan tab** – plan breakfast, lunch and dinner for each day of the week (Monday to Sunday) by picking from your saved recipes. Move between weeks, clear a week, and get a shopping list of the ingredients you don't already have, which you can copy.

## Running it

There's no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Installing it on your phone

The app is an installable web app (PWA): once installed it opens full screen from your home screen, works offline, and saves your food list on the phone.

1. Host it with GitHub Pages: in the repo go to **Settings → Pages**, choose **Deploy from a branch**, pick the branch and `/ (root)`, and save. After a minute you get a link like `https://<username>.github.io/What-do-you-want-for-dinner/`.
2. Open that link on your phone:
   - **iPhone (Safari):** tap the Share button, then **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

Data is saved on the device in the browser's local storage, so each phone or computer keeps its own list. Use **Export data** / **Import data** to back it up or move it to another device. Deleting the app from your home screen also deletes its saved data, so export a backup first.

## About the AI recipe writer

The app calls the Claude API directly from the phone using the official Anthropic SDK, bundled in `vendor/anthropic-sdk.mjs` (version 0.132.1, MIT licence) so it works without a build step. Requests use Claude's web fetch and web search tools to read the shared post, and structured output to get the recipe back in a fixed shape. Because the key lives in the browser, use a key with a spending limit set in the Anthropic Console.
