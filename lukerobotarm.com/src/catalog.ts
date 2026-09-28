import {
  SEED,
  affordableBand,
  money,
  normalizeCatalog,
  priceOf,
  type Catalog,
} from '../server/price-math.mjs';

export { SEED, affordableBand, money, priceOf, type Catalog };
export type { AddonKey, JointDef, Model, Prices } from '../server/price-math.mjs';

let current: Catalog = SEED;
let pending: Promise<Catalog> | null = null;

export function catalog(): Catalog {
  return current;
}

/** One fetch per page load. Mongo down or slow: keep the seed. */
export function loadCatalog(): Promise<Catalog> {
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch('/api/catalog', { signal: AbortSignal.timeout(1200) });
        if (!res.ok) return current;
        const body = (await res.json()) as { catalog?: unknown };
        const next = normalizeCatalog(body.catalog);
        if (next) current = next;
      } catch {
        /* seed already in current */
      }
      return current;
    })();
  }
  return pending;
}
