# What do you want for dinner?

A simple dashboard for keeping track of the food you have at home.

- **Storage places** – starts with Fridge, Freezer and Cupboard; add, rename or delete your own (e.g. "Garage freezer", "Spice rack").
- **Food items** – for each item record which storage place it's in, when it goes off, how much is left (with a unit), and optionally the full amount so you get a "how much is left" bar.
- **Dashboard** – totals for items, things going off in the next 3 days, things that have gone off, and things running low.
- **Use these first** – a list of food that's about to go off, so you know what to cook tonight.
- Search, sort (soonest to go off, name, least left), a quick "−1" button to use some up, and export/import of your data as JSON.

## Running it

There's no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

It can also be hosted for free with GitHub Pages (Settings → Pages → deploy from branch).

Data is saved in your browser's local storage, so it stays on the device you use. Use **Export data** / **Import data** to back it up or move it to another device.
