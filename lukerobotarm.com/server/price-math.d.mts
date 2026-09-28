export type Model = 'mini' | 'standard' | 'pro';

export type AddonKey =
  | 'customColor'
  | 'camera'
  | 'gamepad'
  | 'secondGripper'
  | 'rotate'
  | 'dof4'
  | 'kit'
  | 'reach'
  | 'column700'
  | 'column1000'
  | 'conveyor';

export type Prices = {
  models: Record<Model, number>;
  addons: Record<AddonKey, number>;
};

export type JointDef = {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
};

export type Catalog = {
  prices: Prices;
  control: { joints: JointDef[] };
};

export type PriceState = {
  model: Model;
  custom: boolean;
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

export type PriceQuote = {
  n: number;
  lines: string[];
  free: '' | 'chess' | 'ludo' | 'educational';
};

export const SEED: Catalog;

export function normalizePrices(raw: unknown): Prices | null;
export function normalizeJoints(list: unknown): JointDef[] | null;
export function normalizeCatalog(raw: unknown): Catalog | null;
export function money(n: number): string;
export function affordableBand(catalog: Catalog): string;
export function priceOf(s: PriceState, prices?: Prices): PriceQuote;
export function selfCheck(): void;
