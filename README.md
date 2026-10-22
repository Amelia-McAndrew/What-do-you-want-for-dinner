# What do you want for dinner?

A simple dashboard for keeping track of the food you have at home.

- **Storage places** – starts with Fridge, Freezer and Cupboard; add, rename or delete your own (e.g. "Garage freezer", "Spice rack").
- **Food items** – for each item record which storage place it's in, when it goes off, how much is left (with a unit), and optionally the full amount so you get a "how much is left" bar.
- **Dashboard** – totals for items, things going off in the next 3 days, things that have gone off, and things running low.
- **Use these first** – a list of food that's about to go off, so you know what to cook tonight.
- Search, sort (soonest to go off, name, least left), a quick "−1" button to use some up, and export/import of your data as JSON.
- **Recipes tab** – store recipes with their ingredients (one per line), an optional method, a difficulty level (easy / medium / hard) and the total time. Each recipe shows how many of its ingredients you have in stock, and you can sort by most ingredients in stock, quickest or easiest, or filter by difficulty.

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
