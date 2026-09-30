// Nepal knitwear 0% checker: the rule logic, separate from the page so it can
// be tested and reused. Every threshold and rule restates the origin text in
// src/data/markets.ts (with its sources); rates come from the same file.
// Not customs advice: the page says so, and results say "check" where the
// answer depends on facts we can't see.

export type Product = 'tee' | 'polo' | 'hoodie';
/** Where a material was made. `ldc` = another least developed country (e.g. Bangladesh). */
export type MatOrigin = 'nepal' | 'india' | 'china' | 'vietnam' | 'ldc' | 'korea' | 'australia' | 'other';
export type Status = 'yes' | 'check' | 'fail' | 'none';

export interface Costs {
  /** FOB price per piece, US$. */
  fob: number;
  /** Fabric per piece, valued as landed in Nepal (CIF), US$. */
  fabric: number;
  fabricOrigin: MatOrigin;
  /** Trims and packing per piece, landed in Nepal, US$. */
  trims: number;
  trimsOrigin: MatOrigin;
  /** Labour and overheads in Nepal per piece, US$ (Australia's factory-cost test). */
  labour: number;
}

export interface Verdict {
  status: Status;
  /** One plain sentence: why. */
  why: string;
  /** Share used by the market's value test, when there is one (0–1). */
  share?: number;
  limit?: number;
}

export const MAT_LABEL: Record<MatOrigin, string> = {
  nepal: 'Nepal',
  india: 'India',
  china: 'China',
  vietnam: 'Vietnam',
  ldc: 'Another LDC (e.g. Bangladesh)',
  korea: 'South Korea',
  australia: 'Australia',
  other: 'Another country',
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const ok = (n: number) => Number.isFinite(n) && n >= 0;

// Korea: imported materials, valued landed in Nepal, ≤ 60% of FOB; Korean materials not counted.
export function korea(c: Costs): Verdict {
  if (!ok(c.fob) || c.fob <= 0) return { status: 'check', why: 'Enter the FOB price to run Korea’s 60% test.' };
  const imported = (o: MatOrigin, v: number) => (o === 'nepal' || o === 'korea' ? 0 : v);
  const share = (imported(c.fabricOrigin, c.fabric) + imported(c.trimsOrigin, c.trims)) / c.fob;
  return share <= 0.6
    ? { status: 'yes', share, limit: 0.6, why: `Imported materials are ${pct(share)} of FOB, within Korea’s 60% limit (Korean materials don’t count).` }
    : { status: 'fail', share, limit: 0.6, why: `Imported materials are ${pct(share)} of FOB, above Korea’s 60% limit. Korean fabric or a higher FOB would help.` };
}

// Australia: allowable factory cost ≥ 50% of total factory cost. Allowable = Nepali labour and
// overheads + materials from LDCs or Australia + materials from non-LDC developing countries
// (China, India, Vietnam) capped at 25% of total factory cost. Other origins count for nothing here.
export function australia(c: Costs): Verdict {
  const total = c.fabric + c.trims + c.labour;
  if (!ok(total) || total <= 0) return { status: 'check', why: 'Enter fabric, trims and labour costs to run Australia’s 50% test.' };
  let full = c.labour;
  let capped = 0;
  for (const [o, v] of [[c.fabricOrigin, c.fabric], [c.trimsOrigin, c.trims]] as [MatOrigin, number][]) {
    if (o === 'nepal' || o === 'ldc' || o === 'australia') full += v;
    else if (o === 'china' || o === 'india' || o === 'vietnam') capped += v;
  }
  const share = (full + Math.min(capped, 0.25 * total)) / total;
  const unknownOrigins = [...new Set([c.fabricOrigin, c.trimsOrigin].filter((o) => o === 'korea' || o === 'other'))];
  const unknown = unknownOrigins.length > 0;
  if (share >= 0.5) return { status: 'yes', share, limit: 0.5, why: `Allowable cost is ${pct(share)} of factory cost, meeting Australia’s 50% rule.` };
  return {
    status: unknown ? 'check' : 'fail',
    share,
    limit: 0.5,
    why: unknown
      ? `Allowable cost is ${pct(share)} of factory cost if the material from ${unknownOrigins.map((o) => MAT_LABEL[o]).join(' and ')} doesn’t count. Check whether that country is in Australia’s qualifying area.`
      : `Allowable cost is ${pct(share)} of factory cost, below Australia’s 50% rule (non-LDC materials count only up to 25%).`,
  };
}

// India (Treaty of Trade): materials from outside Nepal and India ≤ 70% of FOB, valued landed in Nepal.
// Cutting and sewing fabric (ch. 60) into garments (ch. 61) meets the change-of-heading test.
export function india(c: Costs): Verdict {
  if (!ok(c.fob) || c.fob <= 0) return { status: 'check', why: 'Enter the FOB price to run the 70% test.' };
  const outside = (o: MatOrigin, v: number) => (o === 'nepal' || o === 'india' ? 0 : v);
  const share = (outside(c.fabricOrigin, c.fabric) + outside(c.trimsOrigin, c.trims)) / c.fob;
  return share <= 0.7
    ? { status: 'yes', share, limit: 0.7, why: `Materials from outside Nepal and India are ${pct(share)} of FOB, within the treaty’s 70% limit.` }
    : { status: 'fail', share, limit: 0.7, why: `Materials from outside Nepal and India are ${pct(share)} of FOB, above the treaty’s 70% limit. Indian fabric counts as local.` };
}

/** Rule outcome per market for a garment cut and sewn in Nepal. */
export function check(market: string, product: Product, c: Costs): Verdict {
  switch (market) {
    case 'eu':
      return { status: 'yes', why: 'EU single transformation: cutting and sewing in Nepal qualifies, from fabric made anywhere.' };
    case 'uk':
      return { status: 'yes', why: 'UK DCTS: one significant process such as cutting and sewing qualifies, from fabric made anywhere.' };
    case 'japan':
      return { status: 'yes', why: 'Japan: knitted apparel “manufactured from fabrics” qualifies; the fabric need not be Nepali.' };
    case 'canada':
      return product === 'tee'
        ? { status: 'yes', why: 'Canada: T-shirts need only sewing or assembly in the LDC (criterion C); fabric origin doesn’t matter.' }
        : { status: 'yes', why: 'Canada: cut, or knit to shape, and sewn in the LDC (criterion B); fabric origin doesn’t matter.' };
    case 'china':
      return { status: 'yes', why: 'China: cut-and-sew changes tariff heading; Chinese fabric counts as originating.' };
    case 'korea':
      return korea(c);
    case 'australia':
      return australia(c);
    case 'india':
      return india(c);
    case 'usa':
      return { status: 'none', why: 'No preference for Nepal: the normal (MFN) rate applies. Nepal is not on the Section 301 list as of September 2026.' };
    case 'uae':
      return { status: 'none', why: 'No preference exists for Nepal: the standard 5% GCC duty applies.' };
    default:
      return { status: 'check', why: 'Market not covered.' };
  }
}
