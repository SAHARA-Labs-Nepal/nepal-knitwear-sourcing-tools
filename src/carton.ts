// Knitwear carton & container planner: the arithmetic, separate from the page.
// Garment weights restate the factory figures in the guide
// /blog/how-much-does-a-tshirt-weigh-shipping/ (weight ≈ GSM × fabric area; a
// 180 gsm tee is ~155 g in M, ~172 g in L, ~190 g in XL; each size step ~10%;
// polos 30–60 g heavier; long sleeve ~1.2–1.4 m² and hoodies ~1.8–2.2 m² of fabric in L).
// Containers: Maersk dry-container specifications. Air: IATA divisor 6,000 cm³/kg.
// Courier: DHL Express divisor 5,000 cm³/kg and 70 kg per piece.

export type Garment = 'tee' | 'longsleeve' | 'polo' | 'hoodie';
export type Size = 'S' | 'M' | 'L' | 'XL' | '2XL';

/** Fabric area used by one garment in size L, m² (midpoints of the guide's ranges). */
const AREA_L: Record<Garment, number> = { tee: 0.956, longsleeve: 1.3, polo: 0.956, hoodie: 2.0 };
/** Size factor relative to L (each size step ~10%). */
const SIZE: Record<Size, number> = { S: 1 / 1.1 / 1.1, M: 1 / 1.1, L: 1, XL: 1.1, '2XL': 1.21 };
/** Polo extras (collar, placket, buttons): midpoint of 30–60 g. */
const POLO_EXTRA_G = 45;

export const CONTAINERS = [
  { key: '20', name: '20ft standard', cbm: 33, payloadKg: 28200 },
  { key: '40', name: '40ft standard', cbm: 67, payloadKg: 28800 },
  { key: '40hc', name: '40ft high cube', cbm: 76, payloadKg: 28620 },
] as const;

export const AIR_DIVISOR = 6000; // cm³ per kg, IATA
export const COURIER_DIVISOR = 5000; // cm³ per kg, DHL Express
export const COURIER_MAX_PIECE_KG = 70; // DHL Express, per piece
export const LIFT_GUIDE_KG = { women: 16, men: 25 }; // UK HSE lifting filter, best zone

/** Estimated garment weight in grams (before packing). */
export function garmentGrams(g: Garment, gsm: number, size: Size): number {
  const w = gsm * AREA_L[g] * SIZE[size];
  return Math.round(g === 'polo' ? w + POLO_EXTRA_G : w);
}

export interface PlanInput {
  qty: number;
  pieceGrams: number; // garment weight
  packGrams: number; // polybag, tags, labels per piece
  perCarton: number;
  cartonCm: [number, number, number];
  cartonTareKg: number;
  fill: number; // share of a container's volume you can realistically load (0–1)
}

export function plan(i: PlanInput) {
  const cartons = i.perCarton > 0 ? Math.ceil(i.qty / i.perCarton) : 0;
  const cartonNetKg = (i.perCarton * (i.pieceGrams + i.packGrams)) / 1000;
  const cartonGrossKg = cartonNetKg + i.cartonTareKg;
  const [l, w, h] = i.cartonCm;
  const cartonCm3 = l * w * h;
  const cartonCbm = cartonCm3 / 1e6;
  const totalCbm = cartons * cartonCbm;
  const totalKg = cartons * cartonGrossKg;
  const containers = CONTAINERS.map((c) => {
    const byVol = cartonCbm > 0 ? Math.floor((c.cbm * i.fill) / cartonCbm) : 0;
    const byWeight = cartonGrossKg > 0 ? Math.floor(c.payloadKg / cartonGrossKg) : 0;
    const fit = Math.min(byVol, byWeight);
    return { ...c, cartonsFit: fit, piecesFit: fit * i.perCarton, needed: fit > 0 ? Math.ceil(cartons / fit) : 0, limitedBy: byWeight < byVol ? 'weight' : 'volume' };
  });
  const airKg = Math.max(totalKg, (cartons * cartonCm3) / AIR_DIVISOR);
  const courierKg = Math.max(totalKg, (cartons * cartonCm3) / COURIER_DIVISOR);
  // Sea LCL is charged per revenue ton: the greater of CBM and metric tonnes (1 CBM = 1,000 kg).
  const lclRt = Math.max(totalCbm, totalKg / 1000);
  return { cartons, cartonNetKg, cartonGrossKg, cartonCbm, totalCbm, totalKg, containers, airKg, courierKg, lclRt };
}
