// Simulace nehod a škod (povinné ručení, osobní auta).
// Frekvence: 3,5 nehody na 100 aut ročně. Výše škody: lognormální rozdělení se σ = 1,2,
// useknuté na 5 tis. až 2 mil. Kč, μ je zvolené tak, aby podmíněný průměr vyšel 62 tis. Kč.

export const P = 0.035;
export const SIG = 1.2;
export const MU = 10.2512;
export const XMIN = 5000;
/** Horní mez posuvníku a škod ve fázi 3a (hlášení o nehodě). */
export const XMAX = 500000;
/** Horní mez škod v deníku, ve fázi 3c a ve finále. */
export const CLAIM_MAX = 2000000;
export const B1 = 30000; // hranice ťukanec / bouračka
export const B2 = 150000; // hranice bouračka / velká bouračka

export const DEMO_SEED = 20261026;
export const DEMO = {
  f1: [3, 5],
  f2: [5, 2, 4],
  /** Finále v třídním demu: počty blízko očekávaných 35, aby bylo vidět, že úzké pásmo na tisíci autech vychází. */
  fin: [37, 32, 36],
  sev: [
    { id: 'park-auto', x: 12000 },
    { id: 'silnice-celni', x: 310000 },
    { id: 'mesto-zraneni', x: 95000 },
  ],
};

/* ---------- pásma tipu (fáze 2 a finále) ---------- */

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

/* ---------- strýček ---------- */

/**
 * Strýček má zkušenosti, ale i lidské chyby:
 * fáze 2 tipuje jako loni (setrvačnost) a bere široké pásmo; ve fázi 3a čte hlášení dobře, ale u červených aut
 * přidává polovinu (pověra); ve fázi 3c dává 5/4/1 podle dat; ve finále vezme data pojišťovny (35), ale ze
 * zbytečné opatrnosti střední pásmo.
 */
export const UNCLE = {
  f2Band: 2,
  alloc: [5, 4, 1],
  finTip: 35,
  finBand: 1,
  redFactor: 1.5,
};
export const uncleF2Tip = (log: number[]): number => Math.max(1, log[log.length - 1] ?? 3);

/* ---------- fáze 3a: hlášení o nehodě ---------- */

/**
 * Výši škody určuje místo, rychlost, co se stalo a zranění. Barva auta je falešná stopa.
 * Škoda = typická škoda scénáře × lognormální šum se σ = 0,4.
 */
export interface Scenario {
  id: string;
  bin: number;
  place: string;
  speed: string;
  what: string;
  injury: string;
  median: number;
  /** Krátké texty pro sprint (méně čtení). */
  sPlace: string;
  sWhat: string;
}
export const SCEN_SIG = 0.4;
export const SCENARIOS: Scenario[] = [
  { id: 'park-sloupek', bin: 0, place: 'parkoviště u obchodu', speed: 'krokem', what: 'couvání do sloupku obchodu', injury: 'nikdo', median: 9000, sPlace: 'parkoviště', sWhat: 'couvání do sloupku' },
  { id: 'park-auto', bin: 0, place: 'parkoviště u obchodu', speed: 'krokem', what: 'ťuknutí do zaparkovaného auta', injury: 'nikdo', median: 14000, sPlace: 'parkoviště', sWhat: 'ťuknutí do auta' },
  { id: 'ulice-zrcatko', bin: 0, place: 'úzká ulice', speed: 'asi 20 km/h', what: 'ulomené zrcátko protijedoucího auta', injury: 'nikdo', median: 7000, sPlace: 'úzká ulice', sWhat: 'ulomené zrcátko' },
  { id: 'kolona', bin: 0, place: 'kolona ve městě', speed: 'asi 10 km/h', what: 'ťuknutí zezadu do auta v koloně', injury: 'nikdo', median: 16000, sPlace: 'kolona', sWhat: 'ťuknutí zezadu' },
  { id: 'mesto-auto', bin: 1, place: 'křižovatka ve městě', speed: 'asi 40 km/h', what: 'srážka s jiným autem', injury: 'nikdo', median: 45000, sPlace: 'křižovatka', sWhat: 'srážka dvou aut' },
  { id: 'mesto-zraneni', bin: 1, place: 'křižovatka ve městě', speed: 'asi 50 km/h', what: 'srážka s jiným autem', injury: 'lehké zranění', median: 85000, sPlace: 'křižovatka', sWhat: 'srážka dvou aut' },
  { id: 'kruhac', bin: 1, place: 'kruhový objezd', speed: 'asi 30 km/h', what: 'boční náraz do auta při vjezdu', injury: 'nikdo', median: 55000, sPlace: 'kruhový objezd', sWhat: 'boční náraz' },
  { id: 'obec-plot', bin: 1, place: 'obec', speed: 'asi 50 km/h', what: 'smyk do plotu a zaparkovaného auta', injury: 'nikdo', median: 70000, sPlace: 'obec', sWhat: 'smyk do plotu' },
  { id: 'silnice-celni', bin: 2, place: 'silnice mimo obec', speed: 'asi 90 km/h', what: 'čelní srážka s autem', injury: 'vážné zranění', median: 280000, sPlace: 'silnice', sWhat: 'čelní srážka' },
  { id: 'dalnice', bin: 2, place: 'dálnice', speed: 'asi 120 km/h', what: 'náraz do svodidel a dvou aut', injury: 'lehké zranění', median: 200000, sPlace: 'dálnice', sWhat: 'svodidla a 2 auta' },
  { id: 'prechod', bin: 2, place: 'přechod ve městě', speed: 'asi 50 km/h', what: 'srážka s chodcem', injury: 'vážné zranění', median: 320000, sPlace: 'přechod', sWhat: 'srážka s chodcem' },
  { id: 'predjizdeni', bin: 2, place: 'silnice mimo obec', speed: 'asi 100 km/h', what: 'srážka tří aut při předjíždění', injury: 'lehká zranění', median: 240000, sPlace: 'silnice', sWhat: 'srážka 3 aut' },
];
export const scenarioById = (id: string): Scenario => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
export interface SevItem { sc: Scenario; x: number }

export const RED = '#D9483B';
export const CAR_COLORS = [RED, '#3A74D6', '#F4F3EF', '#2E3238', '#A3ADB8', '#3E9C8F'];
export const COLOR_NAMES: Record<string, string> = {
  '#D9483B': 'červená',
  '#3A74D6': 'modrá',
  '#F4F3EF': 'bílá',
  '#2E3238': 'černá',
  '#A3ADB8': 'stříbrná',
  '#3E9C8F': 'zelená',
};
export const uncleSevTip = (sc: Scenario, color: string): number => roundTip(sc.median * (color === RED ? UNCLE.redFactor : 1));

/**
 * Karta Likvidátor: odhad = skutečná škoda × lognormální šum, rozpětí odhad / f až odhad · f.
 * U škod jen na vozidlech σ = 0,12 a ±30 %, u zranění σ = 0,2 a ±50 % (léčení a bolestné se ukáží až později).
 * Rozpětí obsahuje skutečnou škodu asi v 97 %, resp. 96 % případů.
 */
export const hasInjury = (sc: Scenario): boolean => sc.injury !== 'nikdo';
export const liqSpec = (sc: Scenario): { sig: number; f: number } => (hasInjury(sc) ? { sig: 0.2, f: 1.5 } : { sig: 0.12, f: 1.3 });

/**
 * Test barvy ve sprintu: dvě červená auta s úplně jinou škodou (ťukanec s nejmenší škodou a nejdražší hlášení
 * z velkých, případně ze středních bouraček), ostatní auta červená nejsou. Vrací indexy dvojice, nebo null.
 */
export function plantRedPair(items: { sc: Scenario; x: number; color: string }[], otherColor: () => string): [number, number] | null {
  const pick = (bin: number, best: (a: number, b: number) => boolean): number => {
    let k = -1;
    items.forEach((it, i) => {
      if (it.sc.bin === bin && (k < 0 || best(it.x, items[k].x))) k = i;
    });
    return k;
  };
  const lo = pick(0, (a, b) => a < b);
  const hi = pick(2, (a, b) => a > b) >= 0 ? pick(2, (a, b) => a > b) : pick(1, (a, b) => a > b);
  if (lo < 0 || hi < 0) return null;
  items.forEach((it, i) => {
    if (i === lo || i === hi) it.color = RED;
    else if (it.color === RED) it.color = otherColor();
  });
  return [lo, hi];
}
/** Barva auta mimo červenou (pro test barvy). */
export const NON_RED = CAR_COLORS.filter((c) => c !== RED);

/* ---------- likvidátorský sprint ---------- */

/** Počet hlášení ve sprintu a pevný limit na jedno hlášení. */
export const SPRINT_N = 8;
export const SPRINT_MS = 9000;
/**
 * Strýček odpovídá za 1,8 až 3,8 s. O 0,2 s rychleji než ve verzi 8.1 vyrovnává test barvy (dvě červená auta
 * v každém sprintu, na jednom se strýček vždy splete), takže výhry hráčů zůstávají stejné.
 */
export const UNCLE_SPRINT_MS: [number, number] = [1800, 3800];
/**
 * Body za správnou odpověď podle rychlosti, podobně jako v Kahootu: do 3 s 3 body, do 6 s 2 body, do 9 s 1 bod.
 * Chyba i vypršený čas 0 bodů. Strýček se hodnotí stejně.
 */
export const sprintPoints = (ms: number): number => (ms <= SPRINT_MS / 3 ? 3 : ms <= (2 * SPRINT_MS) / 3 ? 2 : 1);
/**
 * Smůla: odpověď odpovídá typické přihrádce podle hlášení, ale skutečná škoda padla jinam (asi 6 % hlášení).
 * Za správné čtení hlášení je 1 bod, i pro strýčka.
 */
export const SPRINT_LUCKLESS_POINTS = 1;
/** Strýček u červeného auta posune odhad o přihrádku výš (pověra). */
export const uncleSprintAnswer = (sc: Scenario, color: string): number => Math.min(2, sc.bin + (color === RED ? 1 : 0));
export const shortSpeed = (s: string): string => s.replace(/^asi /, '');
export const shortInjury = (s: string): string =>
  s === 'nikdo' ? 'nikdo' : s.replace(' zranění', '');
/** Pravděpodobnost typu hlášení ve sprintu odpovídá podílům přihrádek v celém rozdělení. */
export const BIN_WEIGHTS = [0.48, 0.43, 0.09];

/**
 * Podíly přihrádek v celém rozdělení (data pojišťoven), v procentech: na počtu nehod 48 / 43 / 9,
 * na penězích 12 / 46 / 42 (useknutá lognormální výše škody, přesně 48,1 / 43,0 / 8,9 a 12,2 / 45,7 / 42,1).
 */
export const POP_COUNT_PCT = [48, 43, 9];
export const POP_MONEY_PCT = [12, 46, 42];
/** Pravděpodobnost, že úzké pásmo s tipem podle dat vyjde: 1 000 aut a tip 35 asi 66 %, 100 aut a tip 4 asi 19 %. */
export const NARROW_HIT_FIN = 0.66;
export const NARROW_HIT_F2 = 0.19;

export const BIN_NAMES = ['Ťukanec', 'Bouračka', 'Velká bouračka'];
export const BIN_RANGES = ['do 30 tis. Kč', '30 až 150 tis. Kč', 'nad 150 tis. Kč'];
export const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

/* ---------- bodování ---------- */

/** Nejvýš 1,25krát víc nebo míň než skutečnost 3 body, nejvýš 1,5krát 2 body, nejvýš 2krát 1 bod. */
export const SEV_TIERS: [number, number, number] = [1.25, 1.5, 2];
export const sevPoints = (tip: number, x: number): number => {
  const e = Math.abs(Math.log(tip / x)) - 1e-9;
  return e <= Math.log(SEV_TIERS[0]) ? 3 : e <= Math.log(SEV_TIERS[1]) ? 2 : e <= Math.log(SEV_TIERS[2]) ? 1 : 0;
};
export const allocOverlap = (tip: number[], act: number[]): number => tip.reduce((s, v, i) => s + Math.min(v, act[i]), 0);
/** Fáze 3c: shoda 10 z 10 3 body, 9 2 body, 8 1 bod. */
export const allocPoints = (overlap: number): number => Math.max(0, overlap - 7);

/** Nejvyšší možný součet: 6 let po 4 bodech, 3 škody a 3 kola po 3 bodech, 8 hlášení sprintu po 3 bodech. */
export const MAX_POINTS = 66;
/** Referenční výkon pro successRate: 95. percentil optimální a rychlé hry (simulace). */
export const SUCCESS_REF = 50;

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

  /** Počet nehod na stovce aut bez ořezu, jen s volitelným minimem (fáze 1: aspoň 1). */
  drawCount(min = 0): number {
    let k: number;
    do k = this.binom(100, P);
    while (k < min);
    return k;
  }

  randn(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.rng();
    while (v === 0) v = this.rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Výše škody z lognormálního rozdělení, useknuto na 5 tis. až 2 mil. Kč, zaokrouhleno na tisíce. */
  drawSev(): number {
    let x: number;
    do x = Math.exp(MU + SIG * this.randn());
    while (x < XMIN || x > CLAIM_MAX);
    return Math.min(CLAIM_MAX, Math.max(XMIN, Math.round(x / 1000) * 1000));
  }

  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  sampleK(n: number, k: number, exclude: number[] = []): number[] {
    const a = Array.from({ length: n }, (_, i) => i).filter((i) => !exclude.includes(i));
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.rng() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  /** Škoda konkrétní nehody podle hlášení: typická škoda scénáře × lognormální šum. */
  drawScenario(sc: Scenario): number {
    let x: number;
    do x = sc.median * Math.exp(SCEN_SIG * this.randn());
    while (x < XMIN || x > XMAX);
    return Math.min(XMAX, Math.max(XMIN, Math.round(x / 1000) * 1000));
  }

  /** Fáze 3a: vždy jeden ťukanec, jedna bouračka a jedna velká bouračka v náhodném pořadí. */
  genSev3(): SevItem[] {
    const items = [0, 1, 2].map((bin) => {
      const pool = SCENARIOS.filter((s) => s.bin === bin);
      const sc = pool[Math.floor(this.rng() * pool.length)];
      return { sc, x: this.drawScenario(sc) };
    });
    return this.shuffle(items);
  }

  /** Hlášení pro sprint: typ podle podílů přihrádek, scénář v přihrádce rovnoměrně, škoda podle scénáře. */
  genSprint(n: number): SevItem[] {
    const out: SevItem[] = [];
    for (let k = 0; k < n; k++) {
      const u = this.rng();
      const bin = u < BIN_WEIGHTS[0] ? 0 : u < BIN_WEIGHTS[0] + BIN_WEIGHTS[1] ? 1 : 2;
      const pool = SCENARIOS.filter((sc) => sc.bin === bin);
      const sc = pool[Math.floor(this.rng() * pool.length)];
      out.push({ sc, x: this.drawScenario(sc) });
    }
    return out;
  }

  color(): string {
    return CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
  }

  nonRed(): string {
    return NON_RED[Math.floor(this.rng() * NON_RED.length)];
  }
}

export const binOf = (x: number): number => (x < B1 ? 0 : x < B2 ? 1 : 2);
/** Podíl velkých bouraček v procentech (zaokrouhleno). */
export const bigPct = (v: number[]): number => Math.round((100 * v[2]) / Math.max(1, v[0] + v[1] + v[2]));


const NB = ' ';
export const fmtK = (x: number): string =>
  x >= 1000000 ? `${(x / 1000000).toFixed(1).replace('.', ',')}${NB}mil.${NB}Kč` : `${Math.round(x / 1000)}${NB}tis.${NB}Kč`;
export const sToX = (s: number): number => 5000 * Math.pow(100, s);
export const xToS = (x: number): number => Math.log10(x / 5000) / 2;
export const roundTip = (x: number): number => {
  const step = x < 20000 ? 1000 : x < 100000 ? 5000 : 10000;
  return Math.min(XMAX, Math.max(XMIN, Math.round(x / step) * step));
};
export const carsWord = (n: number): string => (n === 1 ? 'auto' : n >= 2 && n <= 4 ? 'auta' : 'aut');
export const pointsWord = (n: number): string => {
  const a = Math.abs(n);
  return a === 1 ? 'bod' : a >= 2 && a <= 4 ? 'body' : 'bodů';
};
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const crashedText = (n: number): string =>
  n === 0 ? 'Nenabouralo žádné auto.' : n === 1 ? 'Nabouralo 1 auto.' : n <= 4 ? `Nabourala ${n} auta.` : `Nabouralo ${n} aut.`;
/** Interval v autech, např. „přesně 4“ nebo „3 až 5“. */
export const rangeText = (lo: number, hi: number): string => (lo === hi ? `přesně ${lo}` : `${lo} až ${hi}`);
/** Počet na 1 000 aut přepočtený na 100 aut, s desetinnou čárkou. */
export const per100 = (n: number): string => (n / 10).toFixed(1).replace('.', ',');
