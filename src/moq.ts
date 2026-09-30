// MOQ & colour planner: the arithmetic. Minimum, capacity and lead times restate
// src/data/company.ts: 1,000 pieces per style per colour; 26,000–30,000 pieces a month;
// samples 7–14 days; bulk 40–50 days after sample approval.

export const MOQ_PER_COLOUR = 1000;
export const CAPACITY = { low: 26000, high: 30000 }; // pieces per month
export const SAMPLE_DAYS = { low: 7, high: 14 };
export const BULK_DAYS = { low: 40, high: 50 };

export interface StyleLine { name: string; colours: number; perColour: number }

export interface StyleResult extends StyleLine {
  planned: number;
  minimum: number;
  belowMoq: boolean;
  /** With the same total pieces, how many colours meet the minimum. */
  coloursAtSameTotal: number;
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
      };
    });
  const planned = styles.reduce((s, x) => s + x.planned, 0);
  const minimum = styles.reduce((s, x) => s + x.minimum, 0);
  // Share of a month's output at full capacity.
  const monthsOfOutput = { low: planned / CAPACITY.high, high: planned / CAPACITY.low };
  return {
    styles,
    planned,
    minimum,
    colourRuns: styles.reduce((s, x) => s + x.colours, 0),
    allMeetMoq: styles.every((x) => !x.belowMoq),
    monthsOfOutput,
    /** More than a month even at the top of the capacity range. */
    overOneMonth: planned > CAPACITY.high,
    /** Between the low and high monthly capacity: about a month of full output. */
    aboutOneMonth: planned > CAPACITY.low && planned <= CAPACITY.high,
  };
}
