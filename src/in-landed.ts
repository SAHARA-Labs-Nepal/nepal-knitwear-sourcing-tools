// India landed cost in ₹ and an order-by calendar: the arithmetic.
// Indian customs value garments at CIF (assessable value). Basic customs duty
// (BCD) from Nepal is 0% when the Treaty of Trade or SAFTA origin rules are met;
// at the MFN rate it is 20%, but at least a fixed amount per piece, plus the 10%
// Social Welfare Surcharge on the BCD. IGST is charged on the assessable value
// plus those duties: 5%, or 18% above Rs 2,500 sale value per piece. Rates are
// those of the duty chart (src/data/tariffs.ts, inMfn), with the same sources.

export const MFN_BASIC = 20; // % basic customs duty, Chapter 61
export const SWS = 10; // % Social Welfare Surcharge, on the basic duty
export const IGST_LOW = 5; // %
export const IGST_HIGH = 18; // % above the threshold
export const IGST_THRESHOLD = 2500; // Rs sale value per piece
/** CBIC customs exchange rate for imports (Notification 22/2026-Customs (N.T.)). */
export const CBIC_INR_PER_USD = 97.2;
/** Minimum basic duty per piece at the MFN rate, Rs (6109 10 00, 6105 10, 6110 20 00). */
export const MIN_BCD_INR = { tee: 45, polo: 83, hoodie: 85 } as const;
export type Garment = keyof typeof MIN_BCD_INR;

export interface IndiaInput {
  garment: Garment;
  fobUsd: number; // per piece
  freightInr: number; // freight and insurance to the Indian border, per piece
  qty: number;
  inrPerUsd: number;
  treaty: boolean; // true: 0% BCD (origin rules met); false: MFN
  chargesInr: number; // customs agent, transport to your city etc., whole shipment
}

export function duties(cif: number, garment: Garment, treaty: boolean) {
  const bcd = treaty ? 0 : Math.max((cif * MFN_BASIC) / 100, MIN_BCD_INR[garment]);
  const sws = (bcd * SWS) / 100;
  const base = cif + bcd + sws;
  const igstPct = base > IGST_THRESHOLD ? IGST_HIGH : IGST_LOW;
  return { bcd, sws, igstPct, igst: (base * igstPct) / 100 };
}

export function landedInr(i: IndiaInput) {
  const fob = i.fobUsd * i.inrPerUsd;
  const cif = fob + i.freightInr;
  const d = duties(cif, i.garment, i.treaty);
  const charges = i.qty > 0 ? i.chargesInr / i.qty : 0;
  const exIgst = cif + d.bcd + d.sws + charges;
  // The same garment, same CIF, from an origin paying the MFN rate (e.g. China).
  const mfn = duties(cif, i.garment, false);
  const mfnExIgst = cif + mfn.bcd + mfn.sws + charges;
  return {
    fob, freight: i.freightInr, cif, ...d, charges, exIgst, incIgst: exIgst + d.igst,
    orderExIgst: exIgst * i.qty, orderIgst: d.igst * i.qty,
    mfnBcd: mfn.bcd, mfnSws: mfn.sws, mfnExIgst, savingPerPiece: mfnExIgst - exIgst, savingOrder: (mfnExIgst - exIgst) * i.qty,
  };
}

// Days from a start to your warehouse in north India. `safe` is the conservative
// plan; `best` the quick one. Road: Gaindakot is about 3 hours from the
// Bhairahawa–Sunauli border (see /india-buyers/).
export const STAGES = [
  { key: 'sample', label: 'Sample made (tech pack reviewed first)', safe: 14, best: 7 },
  { key: 'courier', label: 'Sample courier to you', safe: 7, best: 3 },
  { key: 'approve', label: 'You review and approve the sample', safe: 7, best: 2 },
  { key: 'bulk', label: 'Bulk production, dispatched after approval', safe: 30, best: 25 },
  { key: 'road', label: 'Truck to the border, customs clearance and delivery to your city', safe: 10, best: 3 }, // door within 10 days of dispatch (owner, 6 Oct 2026)
] as const;

const DAY = 86400000;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Working back from the date stock must be in your warehouse. `haveSample` skips the sample stages. */
export function orderBy(inWarehouse: Date, haveSample: boolean, mode: 'safe' | 'best') {
  const stages = STAGES.filter((s) => !haveSample || !['sample', 'courier', 'approve'].includes(s.key));
  let end = inWarehouse;
  const out = [...stages].reverse().map((s) => {
    const start = addDays(end, -s[mode]);
    const row = { key: s.key, label: s.label, days: s[mode], start, end };
    end = start;
    return row;
  }).reverse();
  return { rows: out, startBy: end, totalDays: out.reduce((a, r) => a + r.days, 0) };
}
