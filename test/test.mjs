// Checks the buyer tools' maths against hand-worked examples.
//   node test/test.mjs   (Node 22.18+, which runs .ts imports directly)
import assert from 'node:assert/strict';
import { check, korea, australia, india } from '../src/origin-check.ts';
import { freightCosts, garmentGrams, plan } from '../src/carton.ts';
import { planStyles } from '../src/moq.ts';

const tee = { fob: 3.2, fabric: 1.6, fabricOrigin: 'china', trims: 0.2, trimsOrigin: 'china', labour: 0.9 };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// Korea: (1.6 + 0.2) / 3.2 = 56.25% ≤ 60%
near(korea(tee).share, 0.5625, 'korea share'); assert.equal(korea(tee).status, 'yes');
assert.equal(korea({ ...tee, fob: 2.9 }).status, 'fail'); // 1.8 / 2.9 = 62%
assert.equal(korea({ ...tee, fabricOrigin: 'korea', fob: 2.0 }).status, 'yes'); // Korean fabric not counted: 0.2 / 2.0
// Australia: total 2.7; allowable 0.9 + min(1.8, 0.675) = 1.575 → 58.3% ≥ 50%
near(australia(tee).share, 1.575 / 2.7, 'australia share'); assert.equal(australia(tee).status, 'yes');
// labour 0.5: total 2.3; 0.5 + min(1.8, 0.575) = 1.075 → 46.7% < 50%
assert.equal(australia({ ...tee, labour: 0.5 }).status, 'fail');
assert.equal(australia({ ...tee, labour: 0.5, fabricOrigin: 'other' }).status, 'check');
assert.equal(australia({ ...tee, labour: 0.5, fabricOrigin: 'ldc' }).status, 'yes'); // LDC fabric counts in full
// Review fix: the 'check' message names the origin actually selected
assert.match(australia({ ...tee, labour: 0.5, fabricOrigin: 'korea' }).why, /South Korea/);
assert.doesNotMatch(australia({ ...tee, labour: 0.5, fabricOrigin: 'korea' }).why, /Another country/);
// Missing FOB or costs give 'check', never a pass
assert.equal(korea({ ...tee, fob: 0 }).status, 'check');
assert.equal(india({ ...tee, fob: 0 }).status, 'check');
assert.equal(australia({ ...tee, fabric: 0, trims: 0, labour: 0 }).status, 'check');
// India: 1.8 / 3.2 = 56.25% ≤ 70%; Indian fabric counts as local
assert.equal(india(tee).status, 'yes');
assert.equal(india({ ...tee, fob: 2.5 }).status, 'fail'); // 72%
assert.equal(india({ ...tee, fob: 2.5, fabricOrigin: 'india' }).status, 'yes');
// Markets without value tests
for (const m of ['eu', 'uk', 'japan', 'canada', 'china']) assert.equal(check(m, 'tee', tee).status, 'yes');
assert.match(check('canada', 'tee', tee).why, /criterion C/);
assert.match(check('canada', 'hoodie', tee).why, /criterion B/);
assert.equal(check('usa', 'tee', tee).status, 'none');
assert.equal(check('uae', 'tee', tee).status, 'none');

// Garment weights restate the weight guide: 180 gsm tee ~155 / 172 / 190 g in M / L / XL
assert.equal(garmentGrams('tee', 180, 'L'), 172);
assert.equal(garmentGrams('tee', 180, 'M'), 156);
assert.equal(garmentGrams('tee', 180, 'XL'), 189);
assert.ok(garmentGrams('hoodie', 320, 'L') >= 580 && garmentGrams('hoodie', 320, 'L') <= 700);

// Carton plan: 5,000 tees, 172 + 20 g, 50 per 60×40×40 carton, 1.2 kg tare, 85% fill
const p = plan({ qty: 5000, pieceGrams: 172, packGrams: 20, perCarton: 50, cartonCm: [60, 40, 40], cartonTareKg: 1.2, fill: 0.85 });
assert.equal(p.cartons, 100);
near(p.cartonGrossKg, 10.8, 'carton gross');
near(p.totalCbm, 9.6, 'cbm');
near(p.airKg, 1600, 'air chargeable'); // 9,600,000 cm³ / 6,000 > 1,080 kg
near(p.courierKg, 1920, 'courier chargeable'); // / 5,000
assert.equal(p.containers.find((c) => c.key === '40').piecesFit, 29650); // floor(67×0.85/0.096)=593 × 50
assert.equal(p.containers.find((c) => c.key === '20').needed, 1);
near(p.lclRt, 9.6, 'LCL revenue tons');

// Freight comparison: air 1,600 kg × $5 = $8,000; LCL 9.6 RT × $60 = $576; one 20ft at $2,000
const fr = freightCosts(p, 5000, { airPerKg: 5, lclPerRt: 60, fcl: { '20': 2000, '40': 0, '40hc': NaN } });
assert.deepEqual(fr.map((o) => o.mode), ['Sea, shared container (LCL)', 'Sea, 20ft standard', 'Air']);
near(fr[0].cost, 576, 'lcl cost'); near(fr[2].perPiece, 1.6, 'air per piece');
assert.equal(freightCosts(p, 5000, { airPerKg: 0, lclPerRt: 0, fcl: { '20': 0, '40': 0, '40hc': 0 } }).length, 0);

// MOQ planner: 200 per style-colour AND 1,000 per order. 3 × 300 tees + 2 × 150 polos
const mq = planStyles([{ name: 'Tee', colours: 3, perColour: 300 }, { name: 'Polo', colours: 2, perColour: 150 }]);
assert.equal(mq.planned, 1200); assert.equal(mq.minimum, 1000); assert.equal(mq.colourRuns, 5);
assert.equal(mq.allMeetMoq, false); assert.equal(mq.orderMeetsMinimum, true); assert.equal(mq.meetsAll, false);
assert.equal(mq.styles[0].belowMoq, false);
assert.equal(mq.styles[1].belowMoq, true); assert.equal(mq.styles[1].coloursAtSameTotal, 1); // 300 pieces → 1 colour at 200
assert.equal(mq.styles[1].topUp, 100);
near(mq.monthsOfOutput.low, 1200 / 50000, 'months low'); assert.equal(mq.overOneMonth, false);
// Three colours of 200 = 600: every colour is fine but the order is under 1,000
const three = planStyles([{ name: 'Tee', colours: 3, perColour: 200 }]);
assert.equal(three.allMeetMoq, true); assert.equal(three.orderMeetsMinimum, false); assert.equal(three.orderShortfall, 400); assert.equal(three.meetsAll, false);
// 5 × 200 = 1,000 meets both
assert.equal(planStyles([{ name: 'Tee', colours: 5, perColour: 200 }]).meetsAll, true);
assert.equal(planStyles([{ name: 'Big', colours: 51, perColour: 1000 }]).overOneMonth, true); // 51,000 > 50,000
// 45,000 is about a month, not "more than a month"
assert.equal(planStyles([{ name: 'Mid', colours: 45, perColour: 1000 }]).overOneMonth, false);
assert.equal(planStyles([{ name: 'Mid', colours: 45, perColour: 1000 }]).aboutOneMonth, true);
// Review fix: no quantity or no cartons gives no freight rows (no $0 "cheapest")
const empty = plan({ qty: 0, pieceGrams: 172, packGrams: 20, perCarton: 50, cartonCm: [60, 40, 40], cartonTareKg: 1.2, fill: 0.85 });
assert.equal(freightCosts(empty, 0, { airPerKg: 5, lclPerRt: 60, fcl: { '20': 2000, '40': 0, '40hc': 0 } }).length, 0);
// Review fix: LCL under 1 revenue ton carries the minimum-charge note
const small = plan({ qty: 200, pieceGrams: 172, packGrams: 20, perCarton: 50, cartonCm: [60, 40, 40], cartonTareKg: 1.2, fill: 0.85 });
assert.match(freightCosts(small, 200, { airPerKg: 0, lclPerRt: 60, fcl: { '20': 0, '40': 0, '40hc': 0 } })[0].note, /minimum charge/);


// Australia landed cost: FOB US$3.20 at A$1.50 = A$4.80; freight US$0.35 = A$0.525; 5% duty = A$0.24;
// GST = 10% of (4.80 + 0.525 + 0.24) = 0.5565; broker A$300 over 3,000 pcs = A$0.10
{
  const { landedAud, orderBy } = await import('../src/au-landed.ts');
  const r = landedAud({ fobUsd: 3.2, freightUsd: 0.35, qty: 3000, audPerUsd: 1.5, dutyPct: 5, chargesAud: 300 });
  near(r.duty, 0.24, 'au duty'); near(r.gst, 0.5565, 'au gst'); near(r.exGst, 4.80 + 0.525 + 0.24 + 0.1, 'au ex gst');
  near(landedAud({ fobUsd: 3.2, freightUsd: 0.35, qty: 3000, audPerUsd: 1.5, dutyPct: 0, chargesAud: 0 }).duty, 0, 'au ldc duty');
  // Calendar: 14+7+7+30+56+7 = 121 days safe with a sample; 30+56+7 = 93 without
  const d = new Date('2027-02-01T00:00:00Z');
  assert.equal(orderBy(d, false, 'safe').totalDays, 121);
  assert.equal(orderBy(d, true, 'safe').totalDays, 93);
  assert.equal(orderBy(d, false, 'safe').startBy.toISOString().slice(0, 10), '2026-10-03');

  // India: CIF basis, MFN 20% with a per-piece minimum, 10% SWS on duty, IGST on CIF + duties
  const IN = await import('../src/in-landed.ts');
  // Tee at US$3.20 × 97.2 = 311.04 + ₹10 freight = 321.04 CIF
  const t = IN.landedInr({ garment: 'tee', fobUsd: 3.2, freightInr: 10, qty: 2000, inrPerUsd: 97.2, treaty: true, chargesInr: 4000 });
  near(t.cif, 321.04, 'in cif'); near(t.bcd, 0, 'in treaty bcd'); near(t.igst, 16.052, 'in igst 5%'); near(t.charges, 2, 'in charges');
  // MFN: 20% of 321.04 = 64.208 (> ₹45 minimum); SWS 6.4208
  near(t.mfnBcd, 64.208, 'in mfn bcd'); near(t.mfnSws, 6.4208, 'in mfn sws'); near(t.savingPerPiece, 70.6288, 'in saving');
  // Minimum bites on a cheap tee: CIF 150 → 20% = 30 < 45
  near(IN.duties(150, 'tee', false).bcd, 45, 'in min duty');
  // IGST 18% above ₹2,500 per piece
  assert.equal(IN.duties(3000, 'hoodie', true).igstPct, 18);
  // Calendar: 14+7+7+30+10 = 68 days safe with a new sample; 30+10 = 40 with one
  const di = new Date('2027-03-01T00:00:00Z');
  assert.equal(IN.orderBy(di, false, 'safe').totalDays, 68);
  assert.equal(IN.orderBy(di, true, 'safe').totalDays, 40);
  assert.equal(IN.orderBy(di, false, 'best').totalDays, 40);
}

console.log('all checks passed');
