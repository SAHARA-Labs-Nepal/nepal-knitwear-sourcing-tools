# Nepal knitwear sourcing tools

Free, open tools and data for importers buying knit basics (T-shirts, polos, sweatshirts and hoodies) from Nepal. Every duty rate and rule links to the official source it was read from.

**Use the live tools (no sign-up):**

| Tool | Live version | Code / data here |
|---|---|---|
| Nepal knitwear 0% checker: one garment, ten markets | [trishaktiapparel.com/tools/origin-checker/](https://trishaktiapparel.com/tools/origin-checker/) | [`src/origin-check.ts`](src/origin-check.ts) |
| Knitwear carton & container calculator, with a freight-quote comparison | [trishaktiapparel.com/tools/carton-calculator/](https://trishaktiapparel.com/tools/carton-calculator/) | [`src/carton.ts`](src/carton.ts) |
| MOQ & colour planner: styles × colours against a per-colour minimum | [trishaktiapparel.com/tools/moq-planner/](https://trishaktiapparel.com/tools/moq-planner/) | [`src/moq.ts`](src/moq.ts) |
| Garment import duty dataset (CSV / JSON) | [trishaktiapparel.com/tools/duty-rates/](https://trishaktiapparel.com/tools/duty-rates/) | [`data/`](data/) |
| Nepal to India import duty calculator (₹): landed cost per piece in rupees, treaty 0% vs MFN, IGST, order-by date | [trishaktiapparel.com/tools/nepal-india-import-duty-calculator/](https://trishaktiapparel.com/tools/nepal-india-import-duty-calculator/) | [`src/in-landed.ts`](src/in-landed.ts) |
| Australia landed cost & order calendar (A$, duty, 10% GST) | [trishaktiapparel.com/tools/australia-landed-cost/](https://trishaktiapparel.com/tools/australia-landed-cost/) | [`src/au-landed.ts`](src/au-landed.ts) |
| REX number checker (bulk): up to 10 EU REX numbers at once, live on the European Commission's database | [trishaktiapparel.com/tools/rex-checker/](https://trishaktiapparel.com/tools/rex-checker/) · [Deutsch](https://trishaktiapparel.com/de/tools/rex-checker/) | [`src/rex.ts`](src/rex.ts) |
| Knitwear tech-pack & QC template (Excel / PDF) | [trishaktiapparel.com/tools/tech-pack-template/](https://trishaktiapparel.com/tools/tech-pack-template/) | [`templates/`](templates/) |

## What the 0% checker covers
For a garment cut and sewn in Nepal, it applies each market's rule of origin for least-developed-country goods:

- **EU, UK, Japan, Canada, China:** imported fabric is fine (single transformation or equivalent). Canada: criterion C for T-shirts (HS 6109), B for polos and most hoodies.
- **Korea:** imported materials, valued landed in Nepal, at most 60% of the FOB price; Korean materials are not counted.
- **Australia:** allowable factory cost at least 50% of total factory cost; materials from non-LDC developing countries (China, India, Vietnam) count only up to 25%.
- **India (Treaty of Trade):** materials from outside Nepal and India at most 70% of the FOB price.
- **US, UAE:** no preference for Nepal (MFN / 5% GCC duty).

It also shows the paperwork each market asks for and how long the 0% rate lasts after Nepal's LDC graduation, now scheduled for 24 November 2029.

## What the REX checker does
A REX number is what lets an exporter in a country with EU trade preferences (Nepal, India, Bangladesh, Vietnam…) claim reduced or 0% EU duty through a statement on origin. `src/rex.ts` checks the number's format (two letters, `REX`, then up to 30 letters or digits), asks the Commission's public REX page, and returns only the status, registration date, exporter name and country. Address, e-mail and phone are left out on purpose. No API key is needed.

```ts
import { checkRex } from './src/rex.ts';
console.log(await checkRex('NPREX1244417670168NPTEPC'));
// [{ number: 'NPREX1244417670168NPTEPC', status: 'valid', registered: '24-09-2026', name: 'Trishakti Apparel', country: 'Nepal', … }]
```

A valid number proves the exporter is registered, not that the goods meet the rules of origin.

## Data
`data/garment-duty-rates.csv` and `.json`: duty on cotton knit T-shirts (6109.10), polos (6105.10) and sweatshirts/hoodies (6110.20) made in Nepal, Bangladesh, India, China and Vietnam, entering ten markets, with the preference scheme and the official source URLs for every row. The live copy is regenerated from the site's source data: <https://trishaktiapparel.com/data/garment-duty-rates.json>.

## Run the tests
```sh
node test/test.mjs   # Node 22.18+ runs the .ts sources directly
```

## Licences
- Code (`src/`, `test/`): MIT, see [LICENSE](LICENSE).
- Data and templates (`data/`, `templates/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: *Trishakti Apparel, trishaktiapparel.com*.

## Not advice
These tools restate published rules, checked on the dates shown in the data. They are not customs or legal advice: confirm your HS code and origin with a licensed customs broker before you order.

---
Made by [Trishakti Apparel](https://trishaktiapparel.com), a cut-and-sew knitwear factory in Gaindakot, Nepal. Corrections welcome: open an issue.
