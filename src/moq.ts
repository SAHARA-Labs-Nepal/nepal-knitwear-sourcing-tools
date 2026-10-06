// MOQ & colour planner: the arithmetic. Minimum, capacity and lead times restate
// src/data/company.ts: 200 pieces per style and colour AND at least 1,000 pieces in the
// whole order; 40,000–50,000 pieces a month; samples 7–14 days; bulk dispatch 25–30
// days after sample approval.

export const MOQ_PER_COLOUR = 200;
export const MOQ_PER_ORDER = 1000;
export const CAPACITY = { low: 40000, high: 50000 }; // pieces per month
export const SAMPLE_DAYS = { low: 7, high: 14 };
export const BULK_DAYS = { low: 25, high: 30 };

export interface StyleLine { name: string; colours: number; perColour: number }

export interface StyleResult extends StyleLine {
  planned: number;
  /** Pieces needed for every colour of this style to reach the per-colour minimum. */
  minimum: number;
  /** Each colour is under the per-colour minimum. */
  belowMoq: boolean;
  /** With the same total pieces, how many colours meet the per-colour minimum. */
  coloursAtSameTotal: number;
  /** Pieces to add to this style so every colour reaches the minimum (0 if none). */
  topUp: number;
}

export function planStyles(lines: StyleLine[]) {
  const styles: StyleResult[] = lines
    .filter((l) => l.colours > 0)
    .map((l) => {
      const planned = l.colours * Math.max(0, l.perColour);
      return {
        ...l,
        planned,
        minimum: l.colours * MOQ_PER_COLOUR,
        belowMoq: l.perColour < MOQ_PER_COLOUR,
        coloursAtSameTotal: Math.floor(planned / MOQ_PER_COLOUR),
        topUp: Math.max(0, l.colours * MOQ_PER_COLOUR - planned),
      };
    });
  const planned = styles.reduce((s, x) => s + x.planned, 0);
  const minimum = styles.reduce((s, x) => s + x.minimum, 0);
  // Share of a month's output at full capacity.
  const monthsOfOutput = { low: planned / CAPACITY.high, high: planned / CAPACITY.low };
  const allMeetMoq = styles.every((x) => !x.belowMoq);
  const orderMeetsMinimum = planned >= MOQ_PER_ORDER;
  return {
    styles,
    planned,
    minimum,
    colourRuns: styles.reduce((s, x) => s + x.colours, 0),
    /** Every style-colour reaches the per-colour minimum. */
    allMeetMoq,
    /** The whole order reaches the order minimum. */
    orderMeetsMinimum,
    /** Pieces still needed to reach the order minimum (0 if reached). */
    orderShortfall: Math.max(0, MOQ_PER_ORDER - planned),
    /** Both rules met. */
    meetsAll: allMeetMoq && orderMeetsMinimum && styles.length > 0,
    monthsOfOutput,
    /** More than a month even at the top of the capacity range. */
    overOneMonth: planned > CAPACITY.high,
    /** Between the low and high monthly capacity: about a month of full output. */
    aboutOneMonth: planned > CAPACITY.low && planned <= CAPACITY.high,
  };
}
