// Simulace pro minihru Náhoda v davu mizí (0_cafe_mini_shift_LLN).
// Pojišťovna čeká, že v každém kole nabourá zhruba každé desáté auto (zjednodušení podle zadání, skutečná četnost
// v povinném ručení je asi 3,5 nehody na 100 aut). Počet nehod ve skupině n aut je Bi(n; 0,1).

export const P = 0.1;
/** Čtyři polohy posuvníku: počet aut ve skupině. */
export const GROUPS = [10, 100, 1000, 10000];
/** Počet simulovaných kol u každé skupiny. */
export const ROUNDS = 3;
export const tipOf = (n: number): number => Math.round(n * P);

/* ---------- pásma kolem tipu ---------- */

export interface BandDef {
  id: 'uzke' | 'stredni' | 'siroke';
  name: string;
  /** Poloviční šířka pásma relativně k tipu. */
  rel: number;
  /** Nejmenší poloviční šířka v autech. */
  min: number;
  win: number;
  miss: number;
}
export const BANDS: BandDef[] = [
  { id: 'uzke', name: 'Úzké', rel: 0.15, min: 0, win: 4, miss: -1 },
  { id: 'stredni', name: 'Střední', rel: 0.3, min: 1, win: 2, miss: -1 },
  { id: 'siroke', name: 'Široké', rel: 0.75, min: 2, win: 1, miss: 0 },
];
/** Poloviční šířka pásma v autech: max(min, ⌊rel · tip⌋). */
export const bandHw = (b: number, tip: number): number => Math.max(BANDS[b].min, Math.floor(BANDS[b].rel * tip + 1e-9));
export const bandHit = (b: number, tip: number, n: number): boolean => Math.abs(n - tip) <= bandHw(b, tip);
export const bandPoints = (b: number, tip: number, n: number): number => (bandHit(b, tip, n) ? BANDS[b].win : BANDS[b].miss);
export const bandRange = (b: number, tip: number): [number, number] => {
  const h = bandHw(b, tip);
  return [Math.max(0, tip - h), tip + h];
};

/**
 * Očekávané body za kolo podle skupiny (řádky 10, 100, 1 000, 10 000 aut) a pásma (úzké, střední, široké),
 * spočtené přesně z binomického rozdělení. U malých skupin se vyplatí střední pásmo, u velkých úzké.
 */
export const EV: number[][] = [
  [0.937, 1.789, 0.987],
  [0.911, 1.277, 0.988],
  [3.49, 1.996, 1.0],
  [4.0, 2.0, 1.0],
];
export const bestBand = (g: number): number => EV[g].indexOf(Math.max(...EV[g]));

/**
 * Úspěšnost volby pásem bez vlivu náhody: (součet očekávaných bodů zvolených pásem − nejhorší možný součet)
 * / (nejlepší možný − nejhorší možný). 1 = u každé skupiny nejvýhodnější pásmo, 0 = vždy to nejméně výhodné.
 */
export const choiceScore = (bands: number[]): number => {
  const lo = EV.reduce((s, r) => s + Math.min(...r), 0);
  const hi = EV.reduce((s, r) => s + Math.max(...r), 0);
  const v = bands.reduce((s, b, g) => s + EV[g][b], 0);
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
};

/** Strýček: u 10 až 1 000 aut bere pro jistotu střední pásmo, teprve u 10 000 aut úzké. */
export const UNCLE_BANDS = [1, 1, 1, 0];

/** Nejvyšší možný součet bodů: 4 skupiny × 3 kola × 4 body. */
export const MAX_POINTS = GROUPS.length * ROUNDS * 4;

/* ---------- náhoda ---------- */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sim {
  constructor(private rng: Rng) {}

  uniform(): number {
    return this.rng();
  }

  binom(n: number, p: number): number {
    let k = 0;
    for (let i = 0; i < n; i++) if (this.rng() < p) k++;
    return k;
  }

  /** k různých indexů z 0 až n − 1 (částečné Fisherovo-Yatesovo míchání). */
  sampleK(n: number, k: number): Int32Array {
    const a = new Int32Array(n);
    for (let i = 0; i < n; i++) a[i] = i;
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.rng() * (n - i));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a.slice(0, k);
  }

  /** Barvy aut jako indexy do palety. */
  colors(n: number, palette: number): Uint8Array {
    const c = new Uint8Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.floor(this.rng() * palette);
    return c;
  }
}

/* ---------- texty ---------- */

const NB = '\u00A0';
/** Celé číslo s mezerou jako oddělovačem tisíců (pevná mezera). */
export const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
export const carsWord = (n: number): string => (n === 1 ? 'auto' : n >= 2 && n <= 4 ? 'auta' : 'aut');
export const crashWord = (n: number): string => (n === 1 ? 'nehoda' : n >= 2 && n <= 4 ? 'nehody' : 'nehod');
/** Akuzativ: „čeká 1 nehodu, 10 nehod“. */
export const crashAcc = (n: number): string => (n === 1 ? 'nehodu' : n >= 2 && n <= 4 ? 'nehody' : 'nehod');
export const claimsAcc = (n: number): string => (n === 1 ? 'škodu' : n >= 2 && n <= 4 ? 'škody' : 'škod');
export const pointsWord = (n: number): string => {
  const a = Math.abs(n);
  return a === 1 ? 'bod' : a >= 2 && a <= 4 ? 'body' : 'bodů';
};
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const rangeText = (lo: number, hi: number): string => (lo === hi ? `přesně ${fmtInt(lo)}` : `${fmtInt(lo)} až ${fmtInt(hi)}`);

/** Relativní odchylka skutečnosti od tipu v procentech. */
export const devPct = (actual: number, tip: number): number => (100 * (actual - tip)) / tip;
/** Odchylka jako text: pod 10 % s jedním desetinným místem, jinak celé procento, se znaménkem. */
export const devText = (d: number): string => {
  const a = Math.abs(d);
  const v = a < 10 ? a.toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(a));
  return `${d > 0.05 ? '+' : d < -0.05 ? '−' : ''}${v}${NB}%`;
};
export const absDevText = (d: number): string => devText(Math.abs(d)).replace(/^\+/, '');

/** Hodnocení skupiny podle největší odchylky (věty ze zadání). */
export const verdictLine = (maxAbsDev: number): string =>
  maxAbsDev >= 100 ? 'Úplně vedle.' : maxAbsDev >= 15 ? 'Pořád vedle, ale už líp.' : maxAbsDev >= 5 ? 'Skoro přesně.' : 'Trefa.';

/** Výčet čísel česky: „3, 0 a 2“. */
export const listText = (v: number[]): string =>
  v.length <= 1 ? v.map(fmtInt).join('') : `${v.slice(0, -1).map(fmtInt).join(', ')} a ${fmtInt(v[v.length - 1])}`;
