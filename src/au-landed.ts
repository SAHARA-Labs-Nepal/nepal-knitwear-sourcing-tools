// Australia landed cost and order calendar: the arithmetic.
// Duty is charged on the FOB value (Australia's customs value). GST is 10% of the
// "value of the taxable importation": FOB + international freight and insurance + duty.
// Broker, port and delivery charges are the buyer's own estimate, spread over the order.

export const GST_RATE = 10; // %
export const GENERAL_DUTY = 5; // % on Chapter 61 knitwear; the LDC rate is Free when the 50% rule is met

export interface LandedInput {
  fobUsd: number; // per piece
  freightUsd: number; // freight and insurance per piece, US$
  qty: number;
  audPerUsd: number;
  dutyPct: number; // 0 (LDC claim) or 5
  chargesAud: number; // broker, port and delivery for the whole shipment, A$
}

export function landedAud(i: LandedInput) {
  const fob = i.fobUsd * i.audPerUsd;
  const freight = i.freightUsd * i.audPerUsd;
  const duty = (fob * i.dutyPct) / 100;
  const gst = ((fob + freight + duty) * GST_RATE) / 100;
  const charges = i.qty > 0 ? i.chargesAud / i.qty : 0;
  const exGst = fob + freight + duty + charges;
  return { fob, freight, duty, gst, charges, exGst, incGst: exGst + gst, orderExGst: exGst * i.qty, orderGst: gst * i.qty };
}

// Days from a start to the warehouse door. `safe` is the conservative plan; `best` the quick one.
export const STAGES = [
  { key: 'sample', label: 'Sample made (tech pack reviewed first)', safe: 14, best: 7 },
  { key: 'courier', label: 'Sample courier to you', safe: 7, best: 3 },
  { key: 'approve', label: 'You review and approve the sample', safe: 7, best: 2 },
  { key: 'bulk', label: 'Bulk production, dispatched after approval', safe: 30, best: 25 },
  { key: 'sea', label: 'Trucking to Kolkata or Haldia, then sea freight to Australia', safe: 56, best: 42 },
  { key: 'clear', label: 'Customs clearance and delivery to your warehouse', safe: 7, best: 4 },
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
