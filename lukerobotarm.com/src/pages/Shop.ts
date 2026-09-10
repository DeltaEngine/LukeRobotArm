import html from './Shop.html?raw';
import { loadPage } from './loadPage';

type Model = 'mini' | 'standard' | 'pro';

const BASE: Record<Model, number> = { mini: 249, standard: 499, pro: 899 };

const MINI_PRESET: Record<string, string> = {
  black: '#1c1c1c',
  silver: '#c8cad0',
  red: '#c62828',
  yellow: '#e6c200',
};

const STD_PRESET: Record<string, string> = {
  silver: '#c8cad0',
  black: '#1c1c1c',
  red: '#c62828',
  blue: '#1e5aa8',
};

const CUSTOM: { name: string; hex: string }[] = [
  { name: 'Orange', hex: '#ff7a00' },
  { name: 'Forest', hex: '#228b22' },
  { name: 'Royal', hex: '#4169e1' },
  { name: 'Purple', hex: '#6a1b9a' },
  { name: 'Pink', hex: '#ff4f9a' },
  { name: 'Teal', hex: '#008e8e' },
  { name: 'Gold', hex: '#d4a017' },
  { name: 'Olive', hex: '#6b8e23' },
  { name: 'Indigo', hex: '#3f51b5' },
  { name: 'Tomato', hex: '#ff6347' },
  { name: 'Slate', hex: '#607d8b' },
  { name: 'Beige', hex: '#d7c4a3' },
  { name: 'Mint', hex: '#3dcf8e' },
  { name: 'Crimson', hex: '#dc143c' },
  { name: 'Navy', hex: '#1a365d' },
  { name: 'White', hex: '#f4f4f4' },
];

const COVER: Record<string, string> = {
  white: '#f3f3f3',
  teal: '#2ec4b6',
  'light blue': '#7ec8e3',
  orange: '#ff7a3d',
  pink: '#ff6ba8',
};

const BEDS = ['sparkling triangles', 'flat shiny', 'ruff', 'carbon fiber', 'stars'];
const PATTERNS = ['Smooth', 'Rings', 'Honeycomb', 'Stones'];

type State = {
  model: Model;
  colorKey: string;
  color2Key: string;
  custom: boolean;
  bed: string;
  cover: string;
  coverPattern: string;
  camera: boolean;
  gamepad: boolean;
  finger2: boolean;
  finger3: boolean;
  dof: 'simple' | 'rotate' | '4dof';
  chess: boolean;
  ludo: boolean;
  educational: boolean;
  conveyor: boolean;
  reach: boolean;
  height: 500 | 700 | 1000;
};

function defaults(model: Model): State {
  if (model === 'mini') {
    return {
      model,
      colorKey: 'black',
      color2Key: 'black',
      custom: false,
      bed: 'sparkling triangles',
      cover: 'white',
      coverPattern: 'Smooth',
      camera: false,
      gamepad: false,
      finger2: false,
      finger3: true,
      dof: 'simple',
      chess: false,
      ludo: false,
      educational: false,
      conveyor: false,
      reach: false,
      height: 500,
    };
  }
  if (model === 'standard') {
    return {
      model,
      colorKey: 'silver',
      color2Key: 'black',
      custom: false,
      bed: 'sparkling triangles',
      cover: 'teal',
      coverPattern: 'Smooth',
      camera: true,
      gamepad: true,
      finger2: false,
      finger3: true,
      dof: 'simple',
      chess: false,
      ludo: false,
      educational: false,
      conveyor: false,
      reach: false,
      height: 500,
    };
  }
  return {
    model,
    colorKey: 'silver',
    color2Key: 'black',
    custom: false,
    bed: 'sparkling triangles',
    cover: 'teal',
    coverPattern: 'Honeycomb',
    camera: true,
    gamepad: true,
    finger2: false,
    finger3: true,
    dof: '4dof',
    chess: true,
    ludo: false,
    educational: false,
    conveyor: false,
    reach: false,
    height: 500,
  };
}

function hexNamed(map: Record<string, string>, key: string): string {
  return map[key] || CUSTOM.find((c) => c.name === key)?.hex || '#c8cad0';
}

function priceOf(s: State) {
  const pro = s.model === 'pro';
  let n = BASE[s.model];
  const lines: string[] = [`Luke ${label(s.model)} $${BASE[s.model]}`];
  if (s.model === 'mini' && s.custom) {
    n += 29;
    lines.push('Custom color +$29');
  } else if (pro && s.custom) {
    lines.push('Custom colors included');
  }

  if (s.model !== 'mini') {
    if (pro) {
      if (s.camera) lines.push('Camera included');
      else {
        n -= 29;
        lines.push('No camera −$29');
      }
      if (s.gamepad) lines.push('Gamepad included');
      else {
        n -= 10;
        lines.push('No gamepad −$10');
      }
    } else {
      if (s.camera) {
        n += 29;
        lines.push('Camera +$29');
      }
      if (s.gamepad) {
        n += 10;
        lines.push('Gamepad +$10');
      }
    }
  }

  const kits: Array<'chess' | 'ludo' | 'educational'> = [];
  if (s.chess) kits.push('chess');
  if (s.ludo) kits.push('ludo');
  if (s.educational) kits.push('educational');
  const free = pro && kits.length ? kits[0] : '';
  if (pro && !kits.length) {
    n -= 19;
    lines.push('No kit −$19');
  }
  const kitLine = (id: typeof kits[number], name: string) => {
    if (!kits.includes(id)) return;
    lines.push(free === id ? `${name} included` : `${name} +$19`);
  };
  kitLine('chess', 'Chess kit');
  kitLine('ludo', 'Ludo kit');
  kitLine('educational', 'Educational kit');
  n += kits.length * 19 - (free ? 19 : 0);

  if (s.finger2 && s.finger3) {
    n += 39;
    lines.push('2- and 3-finger grippers +$39');
  } else if (s.finger2) {
    lines.push('2-finger gripper');
  } else {
    lines.push('3-finger gripper');
  }
  if (s.finger3) {
    if (s.dof === 'rotate') {
      n += 39;
      if (pro) {
        n -= 99;
        lines.push('Grab + rotation +$39 (instead of 4 DoF −$99)');
      } else {
        lines.push('Grab + rotation +$39');
      }
    } else if (s.dof === '4dof') {
      if (pro) lines.push('4 DoF gripper included');
      else {
        n += 99;
        lines.push('4 DoF gripper +$99');
      }
    } else if (pro) {
      n -= 99;
      lines.push('Simple gripper −$99');
    } else {
      lines.push('Simple 3-finger gripper');
    }
  } else if (pro) {
    n -= 99;
    lines.push('No 3-finger gripper −$99');
  }

  if (s.model !== 'mini' && s.reach) {
    n += 149;
    lines.push('Extended reach +$149');
  }
  if (s.model !== 'mini' && s.height === 700) {
    n += 99;
    lines.push('700mm column +$99');
  }
  if (s.model !== 'mini' && s.height === 1000) {
    n += 199;
    lines.push('1000mm column +$199');
  }
  if (s.model !== 'mini' && s.conveyor) {
    n += 149;
    lines.push('Conveyor belt +$149');
  }
  return { n, lines, free };
}

function label(m: Model) {
  return m === 'mini' ? 'Mini' : m === 'pro' ? 'Pro' : 'Standard';
}

function swatchHtml(key: string, hex: string, title: string) {
  return `<button type="button" class="shop-swatch" data-key="${key}" title="${title}" style="background-color:${hex}" aria-label="${title}"></button>`;
}

export default function Shop() {
  const root = loadPage(html, 'page shop-page');
  let s = defaults('standard');

  const miniPresets = root.querySelector('#miniPresets') as HTMLElement;
  const miniCustomSwatches = root.querySelector('#miniCustomSwatches') as HTMLElement;
  const miniBeds = root.querySelector('#miniBeds') as HTMLElement;
  const stdPresets = root.querySelector('#stdPresets') as HTMLElement;
  const stdColor1 = root.querySelector('#stdColor1') as HTMLElement;
  const stdColor2 = root.querySelector('#stdColor2') as HTMLElement;
  const coverColors = root.querySelector('#coverColors') as HTMLElement;
  const coverPatterns = root.querySelector('#coverPatterns') as HTMLElement;

  miniPresets.innerHTML = Object.entries(MINI_PRESET)
    .map(([k, hex]) => swatchHtml(k, hex, k))
    .join('');
  miniCustomSwatches.innerHTML = CUSTOM.map((c) => swatchHtml(c.name, c.hex, c.name)).join('');
  miniBeds.innerHTML = BEDS.map((b) => `<button type="button" class="shop-chip" data-bed="${b}">${b}</button>`).join('');
  const stdAll = [
    ...Object.entries(STD_PRESET).map(([k, hex]) => ({ key: k, hex, title: k })),
    ...CUSTOM.map((c) => ({ key: c.name, hex: c.hex, title: c.name })),
  ];
  stdPresets.innerHTML = Object.entries(STD_PRESET)
    .map(([k, hex]) => swatchHtml(k, hex, k))
    .join('');
  stdColor1.innerHTML = stdAll.map((c) => swatchHtml(c.key, c.hex, c.title)).join('');
  stdColor2.innerHTML = stdAll.map((c) => swatchHtml(c.key, c.hex, '2: ' + c.title)).join('');
  coverColors.innerHTML = Object.entries(COVER)
    .map(([k, hex]) => swatchHtml(k, hex, k))
    .join('');
  coverPatterns.innerHTML = PATTERNS.map(
    (p) => `<button type="button" class="shop-chip" data-pattern="${p}">${p}</button>`,
  ).join('');

  const frame = root.querySelector('#shopFrame') as HTMLElement;
  const base = root.querySelector('#shopBase') as HTMLImageElement;
  const tint = root.querySelector('#shopTint') as HTMLElement;
  const tintB = root.querySelector('#shopTintB') as HTMLElement;
  const cover = root.querySelector('#shopCover') as HTMLElement;
  const cap = root.querySelector('#shopCaption') as HTMLElement;
  const total = root.querySelector('#shopTotal') as HTMLElement;
  const breakdown = root.querySelector('#shopBreakdown') as HTMLElement;

  function markSwatches(box: HTMLElement, key: string) {
    box.querySelectorAll('.shop-swatch').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.key === key);
    });
  }

  function render() {
    const mini = s.model === 'mini';
    const pro = s.model === 'pro';
    root.querySelectorAll('[data-model]').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.model === s.model);
    });
    (root.querySelector('#shopColorMini') as HTMLElement).hidden = !mini;
    (root.querySelector('#shopColorStd') as HTMLElement).hidden = mini;
    (root.querySelector('#shopKits') as HTMLElement).hidden = mini;
    (root.querySelector('#shopAddons') as HTMLElement).hidden = mini;
    (root.querySelector('#optCamera') as HTMLElement).hidden = mini;
    (root.querySelector('#optGamepad') as HTMLElement).hidden = mini;
    (root.querySelector('#shopGrip3') as HTMLElement).hidden = !s.finger3;
    (root.querySelector('#miniCustomPanel') as HTMLElement).hidden = !(mini && s.custom);
    (root.querySelector('#stdCustomPanel') as HTMLElement).hidden = !(!mini && s.custom);
    root.querySelector('[data-mini-custom]')?.classList.toggle('is-on', mini && s.custom);
    root.querySelector('[data-std-custom]')?.classList.toggle('is-on', !mini && s.custom);

    markSwatches(miniPresets, s.custom ? '' : s.colorKey);
    markSwatches(miniCustomSwatches, s.custom ? s.colorKey : '');
    markSwatches(stdPresets, s.custom ? '' : s.colorKey);
    markSwatches(stdColor1, s.colorKey);
    markSwatches(stdColor2, s.color2Key);
    markSwatches(coverColors, s.cover);
    miniBeds.querySelectorAll('.shop-chip').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.bed === s.bed);
    });
    coverPatterns.querySelectorAll('.shop-chip').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.pattern === s.coverPattern);
    });

    (root.querySelector('input[name="finger2"]') as HTMLInputElement).checked = s.finger2;
    (root.querySelector('input[name="finger3"]') as HTMLInputElement).checked = s.finger3;
    root.querySelectorAll('[data-dof]').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.dof === s.dof);
    });
    root.querySelectorAll('[data-height]').forEach((el) => {
      el.classList.toggle('is-on', (el as HTMLElement).dataset.height === String(s.height));
    });
    (root.querySelector('input[name="camera"]') as HTMLInputElement).checked = s.camera;
    (root.querySelector('input[name="gamepad"]') as HTMLInputElement).checked = s.gamepad;
    (root.querySelector('input[name="reach"]') as HTMLInputElement).checked = s.reach;
    (root.querySelector('input[name="chess"]') as HTMLInputElement).checked = s.chess;
    (root.querySelector('input[name="ludo"]') as HTMLInputElement).checked = s.ludo;
    (root.querySelector('input[name="educational"]') as HTMLInputElement).checked = s.educational;
    (root.querySelector('input[name="conveyor"]') as HTMLInputElement).checked = s.conveyor;

    const { n, lines, free } = priceOf(s);
    const camPrice = root.querySelector('#priceCamera') as HTMLElement;
    const padPrice = root.querySelector('#priceGamepad') as HTMLElement;
    camPrice.textContent = pro ? (s.camera ? 'Included' : '−$29') : s.camera ? '+$29' : '';
    padPrice.textContent = pro ? (s.gamepad ? 'Included' : '−$10') : s.gamepad ? '+$10' : 'Save $10';
    (root.querySelector('#priceChess') as HTMLElement).textContent = free === 'chess' ? 'Included' : '+$19';
    (root.querySelector('#priceLudo') as HTMLElement).textContent = free === 'ludo' ? 'Included' : '+$19';
    (root.querySelector('#priceEdu') as HTMLElement).textContent = free === 'educational' ? 'Included' : '+$19';
    (root.querySelector('#priceFinger2') as HTMLElement).textContent = s.finger2 && s.finger3 ? '+$39' : '';
    (root.querySelector('#priceFinger3') as HTMLElement).textContent =
      s.finger2 && s.finger3 ? 'Second gripper' : 'Default';
    (root.querySelector('#priceDofSimple') as HTMLElement).textContent = pro ? '−$99' : 'Included';
    (root.querySelector('#priceDof4') as HTMLElement).textContent = pro ? 'Included' : '+$99';

    base.src = mini ? '/shop/LukeMiniBaseModel.jpg' : '/shop/LukeStandardBaseModel.jpg';
    base.alt = `Luke ${label(s.model)}`;
    const mask = mini ? '/shop/LukeMiniColoring.png' : '/shop/LukeMiniColoring.png';
    const c1 = hexNamed(mini ? MINI_PRESET : STD_PRESET, s.colorKey);
    const c2 = hexNamed(STD_PRESET, s.color2Key);
    tint.style.setProperty('--tint', c1);
    tint.style.setProperty('--mask', `url("${mask}")`);
    tint.className = 'shop-tint bed-' + s.bed.replace(/\s+/g, '-');
    tintB.style.setProperty('--tint', c2);
    tintB.style.setProperty('--mask', `url("${mask}")`);
    tintB.hidden = mini || !s.custom;
    cover.style.setProperty('--cover', COVER[s.cover] || '#f3f3f3');
    cover.className = 'shop-cover pat-' + s.coverPattern.toLowerCase();
    frame.dataset.model = s.model;

    (root.querySelector('#shopCam') as HTMLElement).hidden = mini || !s.camera;
    (root.querySelector('#shopMotors') as HTMLElement).hidden = !pro;
    (root.querySelector('#shopPad') as HTMLElement).hidden = mini || !s.gamepad;
    (root.querySelector('#shopChess') as HTMLElement).hidden = !s.chess;
    (root.querySelector('#shopLudo') as HTMLElement).hidden = !s.ludo;
    (root.querySelector('#shopBelt') as HTMLElement).hidden = mini || !s.conveyor;

    const colorName = s.custom ? (mini ? s.colorKey : `${s.colorKey} / ${s.color2Key}`) : s.colorKey;
    const grip =
      s.finger2 && s.finger3 ? '2+3 finger' : s.finger2 ? '2-finger' : `3-finger ${s.dof === '4dof' ? '4 DoF' : s.dof === 'rotate' ? '+rot' : 'simple'}`;
    cap.textContent = `Luke ${label(s.model)} · ${colorName} · ${grip}`;
    total.textContent = `$${n}`;
    breakdown.innerHTML = lines.map((l) => `<li>${l}</li>`).join('');

    const inquire = root.querySelector('#shopInquire') as HTMLAnchorElement;
    const order = root.querySelector('#shopOrder') as HTMLButtonElement;
    inquire.hidden = !mini;
    order.hidden = mini;
    if (mini) (root.querySelector('#shopPayDummy') as HTMLElement).hidden = true;
    const stdCustomPrice = root.querySelector('[data-std-custom] em');
    if (stdCustomPrice) stdCustomPrice.textContent = pro ? 'Included' : 'Two-tone';
    if (mini) {
      const body = [`Luke Mini waitlist`, ...lines, `Total $${n}`].join('\n');
      inquire.href = `mailto:Support@DeltaEngine.net?subject=${encodeURIComponent('Luke Mini waitlist')}&body=${encodeURIComponent(body)}`;
      inquire.textContent = 'Inquire — coming soon';
    }
    order.textContent = `Order · $${n}`;
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button, .shop-swatch, .shop-chip') as HTMLElement | null;
    if (!t || !root.contains(t)) return;
    if (t.dataset.model) {
      s = defaults(t.dataset.model as Model);
      render();
      return;
    }
    if (t.dataset.miniCustom) {
      s.custom = !s.custom;
      if (s.custom && MINI_PRESET[s.colorKey]) s.colorKey = CUSTOM[0].name;
      if (!s.custom) s.colorKey = 'black';
      render();
      return;
    }
    if (t.dataset.stdCustom) {
      s.custom = !s.custom;
      render();
      return;
    }
    if (t.dataset.bed) {
      s.bed = t.dataset.bed;
      render();
      return;
    }
    if (t.dataset.pattern) {
      s.coverPattern = t.dataset.pattern;
      render();
      return;
    }
    if (t.dataset.dof) {
      s.dof = t.dataset.dof as State['dof'];
      render();
      return;
    }
    if (t.dataset.height) {
      s.height = Number(t.dataset.height) as 500 | 700 | 1000;
      render();
      return;
    }
    if (t.classList.contains('shop-swatch') && t.dataset.key) {
      const box = t.parentElement;
      if (box === miniPresets) {
        s.custom = false;
        s.colorKey = t.dataset.key;
      } else if (box === miniCustomSwatches) {
        s.custom = true;
        s.colorKey = t.dataset.key;
      } else if (box === stdPresets) {
        s.custom = false;
        s.colorKey = t.dataset.key;
      } else if (box === stdColor1) s.colorKey = t.dataset.key;
      else if (box === stdColor2) s.color2Key = t.dataset.key;
      else if (box === coverColors) s.cover = t.dataset.key;
      render();
    }
  });

  root.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name === 'finger2' || el.name === 'finger3') {
      s.finger2 = (root.querySelector('input[name="finger2"]') as HTMLInputElement).checked;
      s.finger3 = (root.querySelector('input[name="finger3"]') as HTMLInputElement).checked;
      if (!s.finger2 && !s.finger3) {
        if (el.name === 'finger3') s.finger2 = true;
        else s.finger3 = true;
      }
    }
    if (el.name === 'camera') s.camera = el.checked;
    if (el.name === 'gamepad') s.gamepad = el.checked;
    if (el.name === 'reach') s.reach = el.checked;
    if (el.name === 'chess') s.chess = el.checked;
    if (el.name === 'ludo') s.ludo = el.checked;
    if (el.name === 'educational') s.educational = el.checked;
    if (el.name === 'conveyor') s.conveyor = el.checked;
    render();
  });

  root.querySelector('#shopOrder')?.addEventListener('click', () => {
    const dummy = root.querySelector('#shopPayDummy') as HTMLElement;
    dummy.hidden = false;
  });

  render();
  return root;
}
