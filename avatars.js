// Default profile pictures: small food characters drawn as SVG.
// Each is turned into a data URL so it's stored and shared exactly like an uploaded photo.
(() => {
  'use strict';

  const INK = '#2b2622';

  // A friendly face centred at (x, y).
  function face(x, y, scale = 1) {
    const s = scale;
    return `<g>`
      + `<circle cx="${x - 9 * s}" cy="${y}" r="${3.4 * s}" fill="${INK}"/>`
      + `<circle cx="${x + 9 * s}" cy="${y}" r="${3.4 * s}" fill="${INK}"/>`
      + `<circle cx="${x - 8 * s}" cy="${y - 1.2 * s}" r="${1.1 * s}" fill="#fff"/>`
      + `<circle cx="${x + 10 * s}" cy="${y - 1.2 * s}" r="${1.1 * s}" fill="#fff"/>`
      + `<path d="M${x - 5 * s} ${y + 6 * s} Q${x} ${y + 11 * s} ${x + 5 * s} ${y + 6 * s}" fill="none" stroke="${INK}" stroke-width="${2.2 * s}" stroke-linecap="round"/>`
      + `<circle cx="${x - 15 * s}" cy="${y + 6 * s}" r="${3.6 * s}" fill="#ff7a8a" opacity=".45"/>`
      + `<circle cx="${x + 15 * s}" cy="${y + 6 * s}" r="${3.6 * s}" fill="#ff7a8a" opacity=".45"/>`
      + `</g>`;
  }

  const AVATARS = [
    {
      id: 'avocado', name: 'Avocado', bg: '#e3f1d4',
      art: `<path d="M50 14c-12 0-17 14-21 26-5 13-11 20-11 32 0 15 14 22 32 22s32-7 32-22c0-12-6-19-11-32-4-12-9-26-21-26z" fill="#4c7a2a"/>`
        + `<path d="M50 21c-9 0-13 11-16 21-4 11-9 17-9 28 0 11 11 17 25 17s25-6 25-17c0-11-5-17-9-28-3-10-7-21-16-21z" fill="#cfe58a"/>`
        + `<circle cx="50" cy="69" r="11" fill="#8b5a2b"/><circle cx="46" cy="65" r="3" fill="#a9733f"/>`
        + face(50, 42, 0.8),
    },
    {
      id: 'tomato', name: 'Tomato', bg: '#fde3df',
      art: `<ellipse cx="50" cy="58" rx="32" ry="29" fill="#e2483d"/>`
        + `<ellipse cx="38" cy="45" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 38 45)"/>`
        + `<path d="M50 31l5-9 2 10 10-4-6 9 10 3-11 3 2 9-8-6-4 9-4-9-8 6 2-9-11-3 10-3-6-9 10 4z" fill="#3f8f3a"/>`
        + face(50, 60),
    },
    {
      id: 'carrot', name: 'Carrot', bg: '#fff0dc',
      art: `<path d="M50 30c-6-10-14-14-20-12 5 2 9 8 12 14z" fill="#3f9a45"/><path d="M50 30c0-11 4-18 9-20-2 6-3 13-4 20z" fill="#56b35c"/><path d="M50 30c6-9 14-12 19-10-5 3-9 8-12 13z" fill="#3f9a45"/>`
        + `<path d="M30 34c0-3 3-5 6-5h28c3 0 6 2 6 5 0 16-9 40-17 54-2 3-4 3-6 0-8-14-17-38-17-54z" fill="#f28a2e"/>`
        + `<path d="M37 48h7M56 58h7M41 70h6" stroke="#d96f17" stroke-width="2.5" stroke-linecap="round"/>`
        + face(50, 44, 0.8),
    },
    {
      id: 'egg', name: 'Fried egg', bg: '#dff0fb',
      art: `<path d="M24 52c-6-14 6-30 22-30 9 0 13 5 20 5 14 0 22 13 17 26-3 9 3 17-4 26-8 10-20 7-30 9-14 3-27-4-28-17-1-8 6-11 3-19z" fill="#fff"/>`
        + `<circle cx="51" cy="54" r="19" fill="#ffc43d"/><ellipse cx="44" cy="46" rx="5" ry="3" fill="#fff" opacity=".5" transform="rotate(-30 44 46)"/>`
        + face(51, 54, 0.75),
    },
    {
      id: 'strawberry', name: 'Strawberry', bg: '#fde2ea',
      art: `<path d="M50 90c-17-10-31-26-31-44 0-11 8-17 17-17 6 0 10 2 14 2s8-2 14-2c9 0 17 6 17 17 0 18-14 34-31 44z" fill="#e8394f"/>`
        + [[33, 46], [67, 46], [28, 60], [72, 60], [38, 72], [62, 72], [50, 80], [44, 62], [56, 62]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#ffe08a"/>`).join('')
        + `<path d="M50 31c-8-1-15-5-18-10 6 0 11 1 14 3-1-4 0-8 4-12 4 4 5 8 4 12 3-2 8-3 14-3-3 5-10 9-18 10z" fill="#3f8f3a"/>`
        + face(50, 50, 0.85),
    },
    {
      id: 'broccoli', name: 'Broccoli', bg: '#e6f3dc',
      art: `<path d="M40 58h20l4 30H36z" fill="#b9d98a"/>`
        + `<circle cx="33" cy="42" r="14" fill="#3f8f3a"/><circle cx="67" cy="42" r="14" fill="#3f8f3a"/><circle cx="50" cy="30" r="16" fill="#4ea347"/><circle cx="42" cy="50" r="12" fill="#4ea347"/><circle cx="58" cy="50" r="12" fill="#4ea347"/>`
        + `<circle cx="44" cy="26" r="3" fill="#6dbb5e"/><circle cx="60" cy="34" r="3" fill="#6dbb5e"/><circle cx="30" cy="38" r="3" fill="#5aa94f"/>`
        + face(50, 70, 0.6),
    },
    {
      id: 'cupcake', name: 'Cupcake', bg: '#f1e4fb',
      art: `<path d="M27 54h46l-7 34H34z" fill="#f59bb7"/><path d="M36 54l3 34M50 54v34M64 54l-3 34" stroke="#e07899" stroke-width="2.5"/>`
        + `<path d="M24 56c-4-8 3-15 10-14 0-9 8-15 16-15s16 6 16 15c7-1 14 6 10 14z" fill="#fff6e8"/>`
        + `<circle cx="50" cy="22" r="6" fill="#d7263d"/><path d="M50 16q2-6 7-8" stroke="#3f8f3a" stroke-width="2" fill="none" stroke-linecap="round"/>`
        + `<path d="M36 38l3-2M58 34l3 2M46 44l2 2M64 46l-3 1" stroke="#7a5cff" stroke-width="2.5" stroke-linecap="round"/>`
        + face(50, 68, 0.7),
    },
    {
      id: 'lemon', name: 'Lemon', bg: '#fff7cf',
      art: `<path d="M14 52c5-3 7-8 10-12 8-12 18-17 26-17s18 5 26 17c3 4 5 9 10 12-5 3-7 8-10 12-8 12-18 17-26 17s-18-5-26-17c-3-4-5-9-10-12z" fill="#ffd93b"/>`
        + `<ellipse cx="38" cy="38" rx="8" ry="4" fill="#fff" opacity=".45" transform="rotate(-20 38 38)"/>`
        + `<path d="M54 24c4-6 10-8 16-7-3 5-9 8-16 7z" fill="#5aa94f"/>`
        + face(50, 52),
    },
    {
      id: 'mushroom', name: 'Mushroom', bg: '#f6e7dc',
      art: `<path d="M38 52h24l3 30c0 5-7 8-15 8s-15-3-15-8z" fill="#fbe9d0"/>`
        + `<path d="M16 54c0-20 15-34 34-34s34 14 34 34c0 4-4 6-8 6H24c-4 0-8-2-8-6z" fill="#e0453a"/>`
        + `<circle cx="34" cy="38" r="6" fill="#fff"/><circle cx="58" cy="30" r="5" fill="#fff"/><circle cx="70" cy="46" r="4.5" fill="#fff"/><circle cx="46" cy="49" r="3.5" fill="#fff"/>`
        + face(50, 70, 0.6),
    },
    {
      id: 'donut', name: 'Doughnut', bg: '#e0eefc',
      art: `<circle cx="50" cy="54" r="32" fill="#e3a868"/>`
        + `<path d="M50 24c16 0 30 12 30 27 0 6-4 8-7 6-3-3-6 3-10 1-3-2-6 4-11 3-4-1-6-5-10-3-4 2-7-2-10 0-4 2-9 1-10-3-2-5-5-3-7-6-1-14 15-25 35-25z" fill="#f47fb0"/>`
        + `<circle cx="50" cy="54" r="9" fill="#e0eefc"/>`
        + `<path d="M36 34l4 2M62 32l-2 4M72 46l-4 1M28 46l4 2M46 28l3-1" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M56 40l3 3M40 44l-3 2" stroke="#6ed3cf" stroke-width="3" stroke-linecap="round"/>`
        + face(50, 72, 0.6),
    },
    {
      id: 'cheese', name: 'Cheese', bg: '#fff3d6',
      art: `<path d="M16 72V48l58-22 10 22v24z" fill="#ffcf3f"/><path d="M16 48l58-22 10 22z" fill="#ffe17a"/>`
        + `<circle cx="72" cy="58" r="5" fill="#e8b42c"/><circle cx="24" cy="62" r="4" fill="#e8b42c"/><circle cx="62" cy="40" r="3" fill="#f2c64a"/>`
        + face(46, 60, 0.75),
    },
    {
      id: 'peach', name: 'Peach', bg: '#ffe6da',
      art: `<path d="M50 28c-18-6-34 6-34 26 0 18 15 32 34 32s34-14 34-32c0-20-16-32-34-26z" fill="#ffa477"/>`
        + `<path d="M50 30c-6 14-6 30 0 52" stroke="#f08a5d" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
        + `<path d="M51 28c0-6 2-10 4-12" stroke="#7a5230" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M55 20c8-6 18-4 20 0-8 5-15 4-20 0z" fill="#5aa94f"/>`
        + `<ellipse cx="34" cy="44" rx="6" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-30 34 44)"/>`
        + face(50, 58, 0.85),
    },
  ];

  function svgFor(a) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${a.bg}"/>${a.art}</svg>`;
  }

  window.DEFAULT_AVATARS = AVATARS.map((a) => ({
    id: a.id,
    name: a.name,
    url: `data:image/svg+xml,${encodeURIComponent(svgFor(a))}`,
  }));
})();
