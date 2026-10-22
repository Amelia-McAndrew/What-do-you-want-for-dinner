# What do you want for dinner?

A simple dashboard for keeping track of the food you have at home.

- **Storage places** – starts with Fridge, Freezer and Cupboard; add, rename or delete your own (e.g. "Garage freezer", "Spice rack").
- **Food items** – for each item record which storage place it's in, when it goes off, how much is left (with a unit), and optionally the full amount so you get a "how much is left" bar.
- **Dashboard** – totals for items, things going off in the next 3 days, things that have gone off, and things running low.
- **Use these first** – a list of food that's about to go off, so you know what to cook tonight.
- Search, sort (soonest to go off, name, least left), a quick "−1" button to use some up, and export/import of your data as JSON.
- **Recipes tab** – store recipes with their ingredients (one per line), an optional method, a difficulty level (easy / medium / hard) and the total time. Each recipe shows how many of its ingredients you have in stock, and you can sort by most ingredients in stock, quickest or easiest, or filter by difficulty.
- **Recipes from Pinterest / TikTok** – save a recipe's link (it shows an "Open on Pinterest / TikTok" button), paste the caption or recipe text to fill in the ingredients and method automatically, or on Android share a pin or video straight to the installed app (**Share → Dinner**).
- **Copy for Claude** – in a new recipe, tap **✨ Copy for Claude** to copy a ready-made request (with the link and caption) to paste into the Claude app. Claude writes the recipe in a layout the app understands; paste the reply back and tap **Fill in from text** to fill in the name, difficulty, time, ingredients and method. Free with any Claude account, no API key.
- **Meal plan tab** – plan breakfast, lunch and dinner for each day of the week (Monday to Sunday) by picking from your saved recipes. Move between weeks, clear a week, and get a shopping list of the ingredients you don't already have, which you can copy.
- **Households** – tap **🏠 Share with your household** to create a household and send an invite link; everyone who joins shares the same food list, recipes and meal plan, kept in sync between phones (and still working offline). Uses a free Firebase project – see below.
- **Profiles** – tap the name button at the top to pick who you are or add a person with a name and photo. There are 24 built-in characters to choose from, 12 foods and 12 animals (`avatars.js`), and new people get a random one. Food and recipes show the picture of whoever added them. Photos are shrunk to a small square on the phone and stored with the household's data, so no paid storage is needed.

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

## Setting up household sharing

Household sharing stores data in a Firebase project on Google's free Spark plan. The app works without it; until it's set up, the 🏠 button says sharing isn't switched on.

1. In the [Firebase console](https://console.firebase.google.com), create a project (Google Analytics not needed).
2. Add a **Web app** and copy its config object into `firebase-config.js` as `window.FIREBASE_CONFIG = { ... }`.
3. **Build → Authentication → Get started → Anonymous → Enable.**
4. **Build → Firestore Database → Create database** (production mode, a location near you), then paste the contents of `firestore.rules` into the **Rules** tab and **Publish**.

Each household lives at `households/<code>` with `places`, `items`, `recipes`, `plan` and `members` subcollections (one document per entry), so edits from different phones merge instead of overwriting each other. Households can't be listed; the code is the only way in. The Firebase SDK (12.19.0, Apache 2.0) is bundled in `vendor/firebase.mjs`.
