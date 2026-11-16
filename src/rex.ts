// REX number checks against the European Commission's public REX database
// (the same page anyone can use by hand: ec.europa.eu/taxation_customs/dds2/eos/rex_validation.jsp).
// The live tool at https://trishaktiapparel.com/tools/rex-checker/ uses this same code.
// No API key is needed: the Commission's page is public. Please be gentle with it
// (a few numbers at a time, and cache answers), as the live tool does.
// We pass on only what a buyer needs to judge a supplier: the status, the
// registration date, the exporter's name and country. Address, e-mail, phone
// and fax are left out on purpose.

/** EC format: two uppercase letters (ISO country), "REX", then 1–30 uppercase letters or digits. */
export const REX_RE = /^[A-Z]{2}REX[A-Z0-9]{1,30}$/;
/** Most numbers checked in one request. */
export const REX_MAX = 10;
/** Checks (requests) each visitor may run per hour; enforced in /api/rex-check, shown in the checker. */
export const REX_CHECKS_PER_HOUR = 20;

export type RexStatus = 'valid' | 'not-valid' | 'not-found' | 'bad-format' | 'unavailable';
export interface RexResult {
  number: string;
  status: RexStatus;
  /** The database's own wording, when it gave one (e.g. "The REX number is valid"). */
  statusText?: string;
  registered?: string;
  name?: string;
  country?: string;
}

/** Upper-case and drop spaces, dots and dashes people paste in by mistake. */
export const normalizeRex = (s: unknown) => String(s ?? '').toUpperCase().replace(/[\s.\-–—_/]+/g, '');

/** Every distinct number in pasted text. Lines, commas and semicolons separate numbers; spaces
 *  inside one number ("NPREX 1244 4176") are kept together, unless a line is several complete
 *  numbers separated by spaces ("NPREX1 DEREX2"). */
export function splitRexAll(input: unknown): string[] {
  const out: string[] = [];
  for (const part of String(input ?? '').split(/[\r\n,;|]+/)) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    const several = words.length > 1 && words.every((w) => REX_RE.test(normalizeRex(w)));
    for (const n of (several ? words : [part]).map(normalizeRex)) if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
/** The numbers that get checked: the first REX_MAX distinct ones. */
export const splitRex = (input: unknown) => splitRexAll(input).slice(0, REX_MAX);

/** Languages the Commission's page offers that our site also uses; anything else gets English. */
const EC_LANGS = new Set(['en', 'de', 'fr']);
/** Link to the Commission's own result page for one number, in the visitor's language where it exists. */
export const ecRexUrl = (n: string, lang = 'en') =>
  `https://ec.europa.eu/taxation_customs/dds2/eos/rex_validation.jsp?Type=REX&Number=${encodeURIComponent(n)}&Lang=${EC_LANGS.has(lang) ? lang : 'en'}&Expand=true`;
/** The HTML fragment that page loads with the result. */
export const ecRexListUrl = (n: string) =>
  `https://ec.europa.eu/taxation_customs/dds2/eos/rex_list.jsp?Type=REX&Number=${encodeURIComponent(n)}&Lang=en&Expand=true`;

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();

/** Read the Commission's result fragment. Unknown layouts come back as "unavailable", never as a guess. */
export function parseRexHtml(html: string): Omit<RexResult, 'number'> {
  const rows = new Map<string, string>();
  const re = /<b>\s*([^<]{2,80}?)\s*<\/b>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  for (let m; (m = re.exec(html)); ) rows.set(text(m[1]).toLowerCase(), text(m[2]).slice(0, 200));
  const statusText = rows.get('status of the rex number');
  if (!statusText) {
    // No status row: only the database's own "not found" message (in its search_info box) counts.
    const info = html.match(/id="search_info"[^>]*>\s*<p[^>]*>([\s\S]{0,300}?)<\/p>/i)?.[1] ?? '';
    return /does not exist/i.test(text(info))
      ? { status: 'not-found', statusText: 'This REX number does not exist in the EU REX database.' }
      : { status: 'unavailable' };
  }
  const valid = /\bis valid\b/i.test(statusText) && !/\bnot valid\b|\binvalid\b/i.test(statusText);
  return {
    status: valid ? 'valid' : 'not-valid',
    statusText,
    registered: rows.get('date of registration') || undefined,
    name: rows.get('name of the registered exporter') || undefined,
    country: rows.get('country') || undefined,
  };
}

/** Check numbers one after another straight against the Commission's page (Node 18+ or a browser
 *  without CORS limits, e.g. a server). At most REX_MAX numbers, with a short pause between calls. */
export async function checkRex(input: unknown, opts: { pauseMs?: number; timeoutMs?: number } = {}): Promise<RexResult[]> {
  const out: RexResult[] = [];
  for (const n of splitRex(input)) {
    if (!REX_RE.test(n)) { out.push({ number: n, status: 'bad-format' }); continue; }
    try {
      const res = await fetch(ecRexListUrl(n), { signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) });
      out.push(res.ok ? { number: n, ...parseRexHtml(await res.text()) } : { number: n, status: 'unavailable' });
    } catch {
      out.push({ number: n, status: 'unavailable' });
    }
    await new Promise((r) => setTimeout(r, opts.pauseMs ?? 500));
  }
  return out;
}
