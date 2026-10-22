// Default profile pictures: small food and animal characters drawn as SVG.
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

  const FOOD = [
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

  // A small nose and whiskers for the animals that need them.
  const nose = (x, y, colour = '#e2697f') => `<path d="M${x - 4} ${y}h8l-4 4z" fill="${colour}" stroke="${colour}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const whiskers = (x, y) => `<path d="M${x - 14} ${y}h-12M${x - 14} ${y + 5}l-11 3M${x + 14} ${y}h12M${x + 14} ${y + 5}l11 3" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`;

  const ANIMALS = [
    {
      id: 'cat', name: 'Cat', bg: '#ffe9d6',
      art: `<path d="M22 46l4-28 20 16zM78 46l-4-28-20 16z" fill="#f2a04f"/><path d="M27 38l2-13 10 8zM73 38l-2-13-10 8z" fill="#ffc2c9"/>`
        + `<ellipse cx="50" cy="58" rx="32" ry="28" fill="#f2a04f"/>`
        + `<path d="M50 30v10M42 31l2 8M58 31l-2 8" stroke="#d9822f" stroke-width="3" stroke-linecap="round"/>`
        + face(50, 58, 0.9) + nose(50, 61) + whiskers(50, 64),
    },
    {
      id: 'dog', name: 'Dog', bg: '#e4ecfa',
      art: `<ellipse cx="50" cy="56" rx="29" ry="30" fill="#d9a066"/>`
        + `<ellipse cx="22" cy="52" rx="10" ry="20" fill="#8a5a35" transform="rotate(18 22 52)"/><ellipse cx="78" cy="52" rx="10" ry="20" fill="#8a5a35" transform="rotate(-18 78 52)"/>`
        + `<ellipse cx="50" cy="70" rx="15" ry="11" fill="#f6e3c8"/><circle cx="62" cy="44" r="7" fill="#c48a52"/>`
        + face(50, 54, 0.85) + `<ellipse cx="50" cy="64" rx="5" ry="3.5" fill="${INK}"/>`,
    },
    {
      id: 'fox', name: 'Fox', bg: '#fde6da',
      art: `<path d="M20 44l6-28 20 18zM80 44l-6-28-20 18z" fill="#ec7a2f"/><path d="M24 34l3-12 9 8zM76 34l-3-12-9 8z" fill="#3a2a22"/>`
        + `<path d="M18 46c0-12 14-18 32-18s32 6 32 18c0 16-14 38-32 42-18-4-32-26-32-42z" fill="#ec7a2f"/>`
        + `<path d="M18 48c10 0 22 8 32 22 10-14 22-22 32-22-4 18-16 36-32 40-16-4-28-22-32-40z" fill="#fff4ea"/>`
        + face(50, 54, 0.85) + `<ellipse cx="50" cy="74" rx="4.5" ry="3.5" fill="${INK}"/>`,
    },
    {
      id: 'bear', name: 'Bear', bg: '#efe4d8',
      art: `<circle cx="26" cy="30" r="12" fill="#8b5e3c"/><circle cx="74" cy="30" r="12" fill="#8b5e3c"/><circle cx="26" cy="30" r="6" fill="#c49a6c"/><circle cx="74" cy="30" r="6" fill="#c49a6c"/>`
        + `<circle cx="50" cy="56" r="31" fill="#8b5e3c"/><ellipse cx="50" cy="68" rx="14" ry="11" fill="#d8b48a"/>`
        + face(50, 52, 0.85) + `<ellipse cx="50" cy="63" rx="5" ry="3.5" fill="${INK}"/>`,
    },
    {
      id: 'panda', name: 'Panda', bg: '#e2f2e2',
      art: `<circle cx="25" cy="31" r="11" fill="${INK}"/><circle cx="75" cy="31" r="11" fill="${INK}"/>`
        + `<circle cx="50" cy="56" r="31" fill="#fff"/>`
        + `<ellipse cx="38" cy="53" rx="8" ry="10" fill="${INK}" transform="rotate(25 38 53)"/><ellipse cx="62" cy="53" rx="8" ry="10" fill="${INK}" transform="rotate(-25 62 53)"/>`
        + `<circle cx="39" cy="52" r="3" fill="#fff"/><circle cx="61" cy="52" r="3" fill="#fff"/>`
        + `<ellipse cx="50" cy="65" rx="4.5" ry="3" fill="${INK}"/><path d="M45 71q5 4 10 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
        + `<circle cx="33" cy="66" r="3.6" fill="#ff7a8a" opacity=".45"/><circle cx="67" cy="66" r="3.6" fill="#ff7a8a" opacity=".45"/>`,
    },
    {
      id: 'bunny', name: 'Bunny', bg: '#f1e5fb',
      art: `<ellipse cx="38" cy="26" rx="8" ry="22" fill="#f4f1ee" transform="rotate(-10 38 26)"/><ellipse cx="62" cy="26" rx="8" ry="22" fill="#f4f1ee" transform="rotate(10 62 26)"/>`
        + `<ellipse cx="38" cy="27" rx="4" ry="15" fill="#ffc2d1" transform="rotate(-10 38 27)"/><ellipse cx="62" cy="27" rx="4" ry="15" fill="#ffc2d1" transform="rotate(10 62 27)"/>`
        + `<ellipse cx="50" cy="62" rx="28" ry="25" fill="#f4f1ee"/>`
        + face(50, 60, 0.8) + nose(50, 65) + `<rect x="47" y="71" width="6" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1"/>`,
    },
    {
      id: 'frog', name: 'Frog', bg: '#ddf3e5',
      art: `<circle cx="32" cy="34" r="12" fill="#5fbf5a"/><circle cx="68" cy="34" r="12" fill="#5fbf5a"/>`
        + `<ellipse cx="50" cy="60" rx="34" ry="25" fill="#5fbf5a"/>`
        + `<circle cx="32" cy="34" r="7" fill="#fff"/><circle cx="68" cy="34" r="7" fill="#fff"/><circle cx="33" cy="35" r="4" fill="${INK}"/><circle cx="67" cy="35" r="4" fill="${INK}"/>`
        + `<path d="M32 62q18 14 36 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
        + `<circle cx="26" cy="58" r="4" fill="#ff7a8a" opacity=".45"/><circle cx="74" cy="58" r="4" fill="#ff7a8a" opacity=".45"/>`
        + `<circle cx="46" cy="50" r="1.5" fill="#3f8f3a"/><circle cx="54" cy="50" r="1.5" fill="#3f8f3a"/>`,
    },
    {
      id: 'pig', name: 'Pig', bg: '#fde2ea',
      art: `<path d="M24 40l2-20 16 12zM76 40l-2-20-16 12z" fill="#f08ca3"/>`
        + `<circle cx="50" cy="56" r="31" fill="#f7a8b8"/>`
        + `<ellipse cx="50" cy="66" rx="13" ry="9" fill="#f08ca3"/><ellipse cx="45" cy="66" rx="2.5" ry="3.5" fill="#b8566c"/><ellipse cx="55" cy="66" rx="2.5" ry="3.5" fill="#b8566c"/>`
        + `<circle cx="40" cy="48" r="3.4" fill="${INK}"/><circle cx="60" cy="48" r="3.4" fill="${INK}"/><circle cx="41" cy="46.8" r="1.1" fill="#fff"/><circle cx="61" cy="46.8" r="1.1" fill="#fff"/>`
        + `<circle cx="30" cy="60" r="4" fill="#ff6f8a" opacity=".4"/><circle cx="70" cy="60" r="4" fill="#ff6f8a" opacity=".4"/>`,
    },
    {
      id: 'owl', name: 'Owl', bg: '#e8e2f6',
      art: `<path d="M24 30l8 12M76 30l-8 12" stroke="#7a5236" stroke-width="7" stroke-linecap="round"/>`
        + `<path d="M20 56c0-18 13-28 30-28s30 10 30 28c0 20-13 32-30 32S20 76 20 56z" fill="#9c6b45"/>`
        + `<path d="M34 70q16 14 32 0v8q-16 10-32 0z" fill="#c9a07a"/>`
        + `<circle cx="38" cy="50" r="11" fill="#fff"/><circle cx="62" cy="50" r="11" fill="#fff"/><circle cx="39" cy="51" r="5" fill="${INK}"/><circle cx="61" cy="51" r="5" fill="${INK}"/><circle cx="40.5" cy="49.5" r="1.6" fill="#fff"/><circle cx="62.5" cy="49.5" r="1.6" fill="#fff"/>`
        + `<path d="M46 60h8l-4 7z" fill="#f2a33a" stroke="#f2a33a" stroke-width="1.5" stroke-linejoin="round"/>`,
    },
    {
      id: 'penguin', name: 'Penguin', bg: '#dcf0fb',
      art: `<circle cx="50" cy="56" r="32" fill="#2f3542"/>`
        + `<path d="M50 44c4-8 12-12 18-10 8 3 9 14 5 24-4 11-12 20-23 22-11-2-19-11-23-22-4-10-3-21 5-24 6-2 14 2 18 10z" fill="#fff"/>`
        + `<circle cx="40" cy="52" r="3.4" fill="${INK}"/><circle cx="60" cy="52" r="3.4" fill="${INK}"/><circle cx="41" cy="50.8" r="1.1" fill="#fff"/><circle cx="61" cy="50.8" r="1.1" fill="#fff"/>`
        + `<path d="M44 60h12l-6 7z" fill="#f2a33a" stroke="#f2a33a" stroke-width="1.5" stroke-linejoin="round"/>`
        + `<circle cx="32" cy="62" r="4" fill="#ff7a8a" opacity=".45"/><circle cx="68" cy="62" r="4" fill="#ff7a8a" opacity=".45"/>`,
    },
    {
      id: 'lion', name: 'Lion', bg: '#fff0cf',
      art: Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<circle cx="${(50 + Math.cos(a) * 30).toFixed(1)}" cy="${(55 + Math.sin(a) * 30).toFixed(1)}" r="11" fill="#c8682a"/>`;
      }).join('')
        + `<circle cx="50" cy="55" r="30" fill="#c8682a"/>`
        + `<circle cx="31" cy="36" r="6" fill="#f2c063"/><circle cx="69" cy="36" r="6" fill="#f2c063"/>`
        + `<circle cx="50" cy="56" r="23" fill="#f2c063"/><ellipse cx="50" cy="66" rx="10" ry="7" fill="#fbe3b0"/>`
        + face(50, 53, 0.75) + `<path d="M46 61h8l-4 4z" fill="#8a4b2a" stroke="#8a4b2a" stroke-width="1.5" stroke-linejoin="round"/>`,
    },
    {
      id: 'mouse', name: 'Mouse', bg: '#e9edf2',
      art: `<circle cx="26" cy="34" r="16" fill="#a9b0bc"/><circle cx="74" cy="34" r="16" fill="#a9b0bc"/><circle cx="26" cy="34" r="9" fill="#f5b8c6"/><circle cx="74" cy="34" r="9" fill="#f5b8c6"/>`
        + `<ellipse cx="50" cy="60" rx="26" ry="25" fill="#c5cbd5"/>`
        + face(50, 58, 0.8) + `<circle cx="50" cy="66" r="3.5" fill="#e2697f"/>` + whiskers(50, 66),
    },
  ];

  const AVATARS = [
    ...FOOD.map((a) => ({ ...a, group: 'Food' })),
    ...ANIMALS.map((a) => ({ ...a, group: 'Animals' })),
  ];

  function svgFor(a) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${a.bg}"/>${a.art}</svg>`;
  }

  window.DEFAULT_AVATARS = AVATARS.map((a) => ({
    id: a.id,
    name: a.name,
    group: a.group,
    url: `data:image/svg+xml,${encodeURIComponent(svgFor(a))}`,
  }));
})();
