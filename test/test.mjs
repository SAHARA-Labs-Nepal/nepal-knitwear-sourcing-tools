// Checks the buyer tools' maths against hand-worked examples.
//   node test/test.mjs   (Node 22.18+, which runs .ts imports directly)
import assert from 'node:assert/strict';
import { check, korea, australia, india } from '../src/origin-check.ts';
import { garmentGrams, plan } from '../src/carton.ts';

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

console.log('test-tools: all checks passed');
