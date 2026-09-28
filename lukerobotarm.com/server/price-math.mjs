/**
 * One price list for overview, shop, and connect sliders.
 * MongoDB (database Luke) is the live copy. This object is the bootstrap
 * and the offline fallback. Assembly stays in the page bundle.
 *
 * Ceiling: addon signs are applied in priceOf (included / removed), not stored
 * as negative prices. Upgrade: a line-item table if a model stops including
 * the same add-ons Pro includes today.
 */

export const SEED = {
  prices: {
    models: { mini: 249, standard: 499, pro: 899 },
    addons: {
      customColor: 29,
      camera: 29,
      gamepad: 10,
      secondGripper: 39,
      rotate: 39,
      dof4: 99,
      kit: 19,
      reach: 149,
      column700: 99,
      column1000: 199,
      conveyor: 149,
    },
  },
  control: {
    joints: [
      { id: 'j1', label: 'Base (θ1)', min: -180, max: 180, value: 0 },
      { id: 'j2', label: 'Shoulder (θ2)', min: -90, max: 90, value: 0 },
      { id: 'j3', label: 'Z height', min: 0, max: 100, value: 50 },
      { id: 'j4', label: 'Wrist', min: -180, max: 180, value: 0 },
      { id: 'j5', label: 'Gripper', min: 0, max: 100, value: 50 },
    ],
  },
};

const MODELS = ['mini', 'standard', 'pro'];
const ADDONS = Object.keys(SEED.prices.addons);

function moneyInt(n) {
  return Number.isInteger(n) && n >= 0 && n <= 100000;
}

export function normalizePrices(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const models = {};
  for (const id of MODELS) {
    if (!moneyInt(raw.models?.[id])) return null;
    models[id] = raw.models[id];
  }
  const addons = {};
  for (const id of ADDONS) {
    if (!moneyInt(raw.addons?.[id])) return null;
    addons[id] = raw.addons[id];
  }
  return { models, addons };
}

export function normalizeJoints(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 12) return null;
  const joints = [];
  for (const j of list) {
    if (!j || typeof j.id !== 'string' || !j.id || typeof j.label !== 'string' || !j.label) return null;
    const { min, max, value } = j;
    if (![min, max, value].every((n) => Number.isFinite(n))) return null;
    if (min >= max || max - min > 10000) return null;
    if (value < min || value > max) return null;
    joints.push({ id: j.id, label: j.label, min, max, value });
  }
  return joints;
}

/** Remote prices or joints that fail the check are replaced with the seed, per section. */
export function normalizeCatalog(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const prices = normalizePrices(raw.prices) || SEED.prices;
  const joints = normalizeJoints(raw.control?.joints) || SEED.control.joints;
  if (!normalizePrices(raw.prices) && !normalizeJoints(raw.control?.joints)) return null;
  return { prices, control: { joints } };
}

export function money(n) {
  return `$${n}`;
}

/** Overview "affordable" band: Mini through Standard base. Pro is listed on its own in the shop. */
export function affordableBand(catalog) {
  const m = catalog.prices.models;
  return `${money(m.mini)}–${money(m.standard)}`;
}

export function priceOf(s, prices = SEED.prices) {
  const a = prices.addons;
  const pro = s.model === 'pro';
  const base = prices.models[s.model];
  let n = base;
  const lines = [`Luke ${s.model === 'mini' ? 'Mini' : s.model === 'pro' ? 'Pro' : 'Standard'} ${money(base)}`];

  if (s.model === 'mini' && s.custom) {
    n += a.customColor;
    lines.push(`Custom color +${money(a.customColor)}`);
  } else if (pro && s.custom) {
    lines.push('Custom colors included');
  }

  if (s.model !== 'mini') {
    if (pro) {
      if (s.camera) lines.push('Camera included');
      else {
        n -= a.camera;
        lines.push(`No camera −${money(a.camera)}`);
      }
      if (s.gamepad) lines.push('Gamepad included');
      else {
        n -= a.gamepad;
        lines.push(`No gamepad −${money(a.gamepad)}`);
      }
    } else {
      if (s.camera) {
        n += a.camera;
        lines.push(`Camera +${money(a.camera)}`);
      }
      if (s.gamepad) {
        n += a.gamepad;
        lines.push(`Gamepad +${money(a.gamepad)}`);
      }
    }
  }

  const kits = [];
  if (s.chess) kits.push('chess');
  if (s.ludo) kits.push('ludo');
  if (s.educational) kits.push('educational');
  const free = pro && kits.length ? kits[0] : '';
  if (pro && !kits.length) {
    n -= a.kit;
    lines.push(`No kit −${money(a.kit)}`);
  }
  const kitLine = (id, name) => {
    if (!kits.includes(id)) return;
    lines.push(free === id ? `${name} included` : `${name} +${money(a.kit)}`);
  };
  kitLine('chess', 'Chess kit');
  kitLine('ludo', 'Ludo kit');
  kitLine('educational', 'Educational kit');
  n += kits.length * a.kit - (free ? a.kit : 0);

  if (s.finger2 && s.finger3) {
    n += a.secondGripper;
    lines.push(`2- and 3-finger grippers +${money(a.secondGripper)}`);
  } else if (s.finger2) {
    lines.push('2-finger gripper');
  } else {
    lines.push('3-finger gripper');
  }
  if (s.finger3) {
    if (s.dof === 'rotate') {
      n += a.rotate;
      if (pro) {
        n -= a.dof4;
        lines.push(`Grab + rotation +${money(a.rotate)} (instead of 4 DoF −${money(a.dof4)})`);
      } else {
        lines.push(`Grab + rotation +${money(a.rotate)}`);
      }
    } else if (s.dof === '4dof') {
      if (pro) lines.push('4 DoF gripper included');
      else {
        n += a.dof4;
        lines.push(`4 DoF gripper +${money(a.dof4)}`);
      }
    } else if (pro) {
      n -= a.dof4;
      lines.push(`Simple gripper −${money(a.dof4)}`);
    } else {
      lines.push('Simple 3-finger gripper');
    }
  } else if (pro) {
    n -= a.dof4;
    lines.push(`No 3-finger gripper −${money(a.dof4)}`);
  }

  if (s.model !== 'mini' && s.reach) {
    n += a.reach;
    lines.push(`Extended reach +${money(a.reach)}`);
  }
  if (s.model !== 'mini' && s.height === 700) {
    n += a.column700;
    lines.push(`700mm column +${money(a.column700)}`);
  }
  if (s.model !== 'mini' && s.height === 1000) {
    n += a.column1000;
    lines.push(`1000mm column +${money(a.column1000)}`);
  }
  if (s.model !== 'mini' && s.conveyor) {
    n += a.conveyor;
    lines.push(`Conveyor belt +${money(a.conveyor)}`);
  }
  return { n, lines, free };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const grip = {
  custom: false,
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

export function selfCheck() {
  const mini = priceOf({ ...grip, model: 'mini' });
  assert(mini.n === 249, `mini base ${mini.n}`);
  const standard = priceOf({ ...grip, model: 'standard', camera: true, gamepad: true });
  assert(standard.n === 499 + 29 + 10, `standard with camera+pad ${standard.n}`);
  const pro = priceOf({ ...grip, model: 'pro', camera: true, gamepad: true, dof: '4dof', chess: true });
  assert(pro.n === 899 && pro.free === 'chess', `pro default ${pro.n}`);
  const customMini = priceOf({ ...grip, model: 'mini', custom: true });
  assert(customMini.n === 249 + 29, 'mini custom color');
  const barePro = priceOf({ ...grip, model: 'pro', dof: 'simple' });
  assert(barePro.n === 899 - 29 - 10 - 19 - 99, `bare pro ${barePro.n}`);
  assert(affordableBand(SEED) === '$249–$499', affordableBand(SEED));
  assert(normalizePrices({ models: { mini: 1, standard: 2, pro: 3 }, addons: { ...SEED.prices.addons, camera: -1 } }) === null, 'bad addon');
  assert(normalizeJoints([{ id: 'j', label: 'J', min: 5, max: 1, value: 0 }]) === null, 'bad joint');
  const mixed = normalizeCatalog({ prices: SEED.prices, control: { joints: [] } });
  assert(mixed.control.joints.length === 5, 'bad joints fall back to seed');
  assert(mixed.prices.models.mini === 249, 'prices kept');
}
