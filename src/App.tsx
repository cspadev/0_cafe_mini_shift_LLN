import { useEffect, useReducer, useRef, useState } from 'react';
import { fail, finish, startMinihra } from './minihra-protokol';
import { type Config, parseConfig } from './game/config';
import * as S from './game/sim';
import { type Crash, type Layout, animateYear, drawFin, reducedMotion, zoomOut } from './game/finaleCanvas';
import { Avatar, BandPicker, Burst, CarSvg, Clover, Gauge, type GaugeSpec, Mix, SevBands, ShareBars, SoftTimer, Waffle, YearBar } from './ui';

// Náhledový build (VITE_STANDALONE_PREVIEW=1) běží bez hlavní hry, i když je vložený v cizím iframu.
const preview = import.meta.env.VITE_STANDALONE_PREVIEW === '1';
const embedded = window.parent !== window && !preview;

export default function App() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (preview) {
      setCfg(parseConfig(undefined, undefined));
      return;
    }
    startMinihra((level, payload) => {
      setCfg(parseConfig(level, payload));
      setGen((g) => g + 1); // nový INIT = nové kolo od začátku
    });
  }, []);
  if (!cfg) return <div className="loading">Načítám…</div>;
  const previewCfg = preview
    ? (c: Config) => {
        setCfg(c);
        setGen((g) => g + 1);
      }
    : undefined;
  return <Game key={gen} cfg={cfg} onRestart={() => setGen((g) => g + 1)} onPreviewCfg={previewCfg} />;
}

/* ---------- typy ---------- */

type PanelId = 'lot' | 'count' | 'sev' | 'reveal' | 'sprint' | 'bins' | 'fin' | 'end';
type Phase = 'f2' | 'fin';
interface Btn { id: string; label: string; onClick: () => void; disabled?: boolean }
interface YearState { key: number; dur: number; running: boolean; count: number; label: string }
interface CntRow { y: number; n: number; tip: number; band: number; pts: number; uTip: number | null; uBand: number | null; uPts: number | null; mix: number[] | null }
interface Cnt { phase: Phase; year: number; tip: number | null; slider: number; band: number | null; editing: boolean; rows: CntRow[] }
interface RevealRow { tip: number; uTip: number; actual: number; display: number; done: boolean; pts: number; uPts: number | null; color: string; clue: string }
interface KoloRow { r: number; act: number[]; tip: number[]; ov: number; uOv: number; pts: number; uPts: number | null }
interface EndRow { label: string; me: number; uncle: number }
interface SprintItem { sc: S.Scenario; x: number; color: string; uMs: number }
interface SprintFb { ans: number | null; ok: boolean; luckless: boolean; truth: number; x: number; pts: number; uAns: number | null; uOk: boolean; uLuckless: boolean; uPts: number | null; ms: number | null }
interface Sprint {
  k: number;
  items: SprintItem[];
  /** Zkušební hlášení bez času a bez bodů. */
  trial: SprintItem | null;
  inTrial: boolean;
  trialDone: boolean;
  limit: number;
  key: number;
  started: number;
  phase: 'intro' | 'live' | 'fb' | 'done';
  uDone: boolean;
  fb: SprintFb | null;
  streak: number;
  best: number;
  correct: number;
  luckless: number;
  me: number;
  un: number;
  uRedMiss: number;
  /** Test barvy: indexy dvou červených aut s úplně jinou škodou. */
  redPair: [number, number] | null;
}

interface UI {
  step: number;
  say: string;
  sayKey: number;
  task: { main: string; meta: string; result: boolean } | null;
  panels: PanelId[];
  buttons: Btn[];
  toast: { text: string; kind: 'plus' | 'big' | 'minus' | 'info' };
  toastKey: number;
  score: { me: number; uncle: number };
  clover: number;
  log: number[];
  colors: string[];
  picks: number[];
  uPicks: number[];
  crashed: number[];
  picking: boolean;
  showMissed: boolean;
  year: YearState | null;
  gauge: GaugeSpec | null;
  lastPts: { me: number; uncle: number | null } | null;
  cnt: Cnt | null;
  timer: { key: number; dur: number } | null;
  sevIdx: number;
  sevS: number;
  sevMoved: boolean;
  reveal: RevealRow[];
  bins: { mode: 'show' | 'alloc' | 'run'; tip: number[]; act: number[]; flash: number; uAlloc: number[] | null; round: number; diary: number[]; money: number[] };
  kolo: KoloRow[];
  fin: { head: string };
  /** Podíl velkých škod na počtu a na penězích: deník a celé finále (3 roky na 1 000 autech). */
  finShare: { counts: number[]; money: number[]; n: number } | null;
  end: { pts: number; sent: boolean; rows: EndRow[]; winner: 'player' | 'uncle' | 'tie' | null; tieBreak: string | null; againReady: boolean } | null;
  error: string | null;
  /** Karta hráče, jen jednou. Strýček ji nemá. */
  liqCard: 'ready' | 'used';
  liq: ({ lo: number; hi: number } | null)[];
  liqBusy: boolean;
  sprint: Sprint | null;
}

interface YearRes { tip: number; band: string; crashes: number; points: number; uncleTip: number | null; uncleBand: string | null; unclePoints: number | null }
interface Res {
  f1: { crashes: number[]; hits: number; uncleHits: number };
  f2: YearRes[];
  f3a: { scenario: string; color: string; tip: number; actual: number; points: number; uncleTip: number | null; unclePoints: number | null; likvidator: boolean }[];
  f3c: { alloc: number[]; counts: number[]; overlap: number; points: number; uncleOverlap: number | null; unclePoints: number | null }[];
  finale: (YearRes & { bins: number[]; money: number[] })[];
  cards: { likvidator: { used: boolean; car: number | null } };
  sprint: {
    items: { scenario: string; color: string; actual: number; bin: number; reportBin: number; answer: number | null; ms: number | null; points: number; uncleAnswer: number | null; uncleMs: number | null; unclePoints: number | null }[];
    points: number;
    unclePoints: number | null;
    colorTest: number[] | null;
  };
}

interface GameData {
  sim: S.Sim;
  cos: S.Sim;
  round: number;
  yearKey: number;
  timerKey: number;
  timerH: number | null;
  autoH: number | null;
  sprintH: number[];
  lastCrashed: number[];
  f3cars: number[];
  sev: number[];
  sevTips: number[];
  scen: S.Scenario[];
  warned: boolean;
  finL: Layout | null;
  colors1000: string[];
  diary: { counts: number[]; money: number[] } | null;
  finCounts: number[];
  finMoney: number[];
  cloverGiven: boolean;
  f1hits: number;
  t0: number;
  res: Res;
}

const seedOf = (cfg: Config): number | null => (cfg.demo ? S.DEMO_SEED : cfg.seed);
const cosmeticRng = (cfg: Config): S.Rng => {
  const s = seedOf(cfg);
  return s !== null ? S.mulberry32((s * 7919 + 13) | 0) : Math.random;
};

const initialGame = (cfg: Config): GameData => {
  const s = seedOf(cfg);
  return {
    sim: new S.Sim(s !== null ? S.mulberry32(s) : Math.random),
    cos: new S.Sim(cosmeticRng(cfg)),
    round: 0,
    yearKey: 0,
    timerKey: 0,
    timerH: null,
    autoH: null,
    sprintH: [],
    lastCrashed: [],
    f3cars: [],
    sev: [],
    sevTips: [],
    scen: [],
    warned: false,
    finL: null,
    colors1000: [],
    diary: null,
    finCounts: [0, 0, 0],
    finMoney: [0, 0, 0],
    cloverGiven: false,
    f1hits: 0,
    t0: performance.now(),
    res: {
      f1: { crashes: [], hits: 0, uncleHits: 0 },
      f2: [],
      f3a: [],
      f3c: [],
      finale: [],
      cards: { likvidator: { used: false, car: null } },
      sprint: { items: [], points: 0, unclePoints: null, colorTest: null },
    },
  };
};

const initialUI = (g: GameData): UI => ({
  step: 0,
  say: '',
  sayKey: 0,
  task: null,
  panels: ['lot'],
  buttons: [],
  toast: { text: '', kind: 'info' },
  toastKey: 0,
  score: { me: 0, uncle: 0 },
  clover: 0,
  log: [],
  colors: Array.from({ length: 100 }, () => g.cos.color()),
  picks: [],
  uPicks: [],
  crashed: [],
  picking: false,
  showMissed: false,
  year: null,
  gauge: null,
  lastPts: null,
  cnt: null,
  timer: null,
  sevIdx: 0,
  sevS: 500,
  sevMoved: false,
  reveal: [],
  bins: { mode: 'show', tip: [0, 0, 0], act: [0, 0, 0], flash: -1, uAlloc: null, round: 0, diary: [0, 0, 0], money: [0, 0, 0] },
  kolo: [],
  fin: { head: '' },
  finShare: null,
  end: null,
  error: null,
  liqCard: 'ready',
  liq: [null, null, null],
  liqBusy: false,
  sprint: null,
});

class Aborted extends Error {}

const STEPS = ['Které auto', 'Kolik aut', 'Výše škody', '1 000 aut'];
const F1_ROUNDS = 2;
const YEARS = 3;
const KOLA = 3;
const YEAR_MS_F1 = 1600;
const YEAR_MS_F2 = 1400;
const YEAR_MS_FIN = 2000;
const TIMER_MS = 8000;
const FREQ_SEV =
  'Frekvence: nehody na auto za rok, asi 3,5 na 100 aut. Severita: průměrná škoda na nehodu, 62 tis. Kč. Frekvence krát severita: asi 2 200 Kč na auto ročně, základ ceny pojištění.';
/** Doba na přečtení repliky (15 znaků za sekundu), nejvýš 5 s. */
const readMs = (t: string) => Math.min(5000, Math.round((t.length * 1000) / 15));

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function Ticks({ values, pos }: { values: number[]; pos: (v: number) => number }) {
  return (
    <div className="ticks" aria-hidden="true">
      {values.map((v) => (
        <span key={v} style={{ left: `${(pos(v) * 100).toFixed(2)}%` }}>
          {v}
        </span>
      ))}
    </div>
  );
}

/* ---------- hra ---------- */

function Game({ cfg, onRestart, onPreviewCfg }: { cfg: Config; onRestart: () => void; onPreviewCfg?: (c: Config) => void }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const G = useRef<GameData | null>(null);
  const g = (G.current ??= initialGame(cfg));
  const U = useRef<UI | null>(null);
  const u = (U.current ??= initialUI(g));
  const alive = useRef(true);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lotRef = useRef<HTMLDivElement>(null);
  const cntRef = useRef<HTMLElement>(null);
  const finRef = useRef<HTMLElement>(null);
  const ctrlRef = useRef<HTMLDivElement>(null);
  const duel = cfg.duel;
  const reduced = reducedMotion();

  const sleep = (ms: number) =>
    new Promise<void>((res, rej) =>
      setTimeout(() => (alive.current ? res() : rej(new Aborted())), reduced ? Math.min(ms, 80) : ms),
    );
  /** Pauza na přečtení výsledku: nezkracuje se ani při omezených animacích. */
  const wait = (ms: number) =>
    new Promise<void>((res, rej) => setTimeout(() => (alive.current ? res() : rej(new Aborted())), ms));

  // Každá akce hráče běží v ochraně: neočekávaná chyba skončí zprávou ERROR, hra se nezasekne potichu.
  const act = (fn: () => void | Promise<void>) => () => {
    Promise.resolve()
      .then(fn)
      .catch((err: unknown) => {
        if (err instanceof Aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(err);
        u.error = msg;
        force();
        fail('INTERNAL', msg);
      });
  };

  const say = (t: string) => {
    u.say = t;
    u.sayKey++;
    force();
  };
  const task = (main: string, meta = '', result = false) => {
    u.task = main || meta ? { main, meta, result } : null;
    force();
  };
  const show = (...p: PanelId[]) => {
    u.panels = p;
    force();
  };
  const setButtons = (...b: Btn[]) => {
    u.buttons = b;
    force();
  };
  const enable = (id: string, on: boolean) => {
    u.buttons = u.buttons.map((b) => (b.id === id ? { ...b, disabled: !on } : b));
    force();
  };
  const relabel = (id: string, label: string) => {
    u.buttons = u.buttons.map((b) => (b.id === id ? { ...b, label } : b));
    force();
  };
  const lock = () => {
    u.buttons = u.buttons.map((b) => ({ ...b, disabled: true }));
    force();
  };
  const toast = (text: string, kind: UI['toast']['kind'] = 'info') => {
    u.toast = { text, kind };
    u.toastKey++;
    force();
  };
  const addPoints = (me: number, un: number, bigText?: string) => {
    u.score.me += me;
    u.score.uncle += un;
    if (me !== 0) {
      const t = `${S.signed(me)} ${S.pointsWord(me)}`;
      toast(bigText && me >= 3 ? `${bigText} ${t}` : t, me >= 3 ? 'big' : me > 0 ? 'plus' : 'minus');
    }
    force();
  };
  const clearBoard = () => {
    u.crashed = [];
    u.picks = [];
    u.uPicks = [];
    u.showMissed = false;
  };

  /** Posune stránku (jen uvnitř minihry), aby byl prvek vidět nad spodní lištou. */
  const ensureVisible = (el: HTMLElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bar = ctrlRef.current?.getBoundingClientRect().height ?? 0;
    const vh = window.innerHeight - bar;
    let dy = 0;
    if (r.bottom > vh - 6) dy = r.bottom - vh + 6;
    if (r.top - dy < 6) dy = r.top - 6;
    if (Math.abs(dy) > 2) window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
  };
  const reveal = (el: () => HTMLElement | null) => {
    setTimeout(() => alive.current && ensureVisible(el()), 40);
  };

  /* ----- měkký časovač ----- */
  const clearTimer = () => {
    if (g.timerH !== null) window.clearTimeout(g.timerH);
    g.timerH = null;
    if (u.timer) {
      u.timer = null;
      force();
    }
  };
  const startTimer = (ms: number, fn: () => void | Promise<void>) => {
    clearTimer();
    u.timer = { key: ++g.timerKey, dur: ms };
    g.timerH = window.setTimeout(() => {
      g.timerH = null;
      u.timer = null;
      if (alive.current) act(fn)();
    }, ms);
    force();
  };

  /* ----- karta Likvidátor ----- */
  const canLiq = () => duel && u.panels.includes('sev') && u.liqCard === 'ready' && !u.liqBusy;

  async function useLiq() {
    if (!canLiq()) return;
    const k = u.sevIdx;
    u.liqCard = 'used';
    u.liqBusy = true;
    enable('b-sev', false);
    const sc = g.scen[k];
    say(S.hasInjury(sc) ? 'Likvidátor to prohlédne. U zranění se ale škoda může ještě změnit.' : 'Likvidátor to prohlédne zblízka. Já mám jen data.');
    await sleep(900);
    // Odhad likvidátora: skutečná škoda s malým šumem, u vozidel ±30 %, u zranění ±50 %. Ze semene, opakovatelné.
    const ls = S.liqSpec(sc);
    const e = g.sev[k] * Math.exp(ls.sig * g.cos.randn());
    u.liq[k] = { lo: S.roundTip(e / ls.f), hi: S.roundTip(e * ls.f) };
    u.liqBusy = false;
    g.res.cards.likvidator = { used: true, car: k + 1 };
    enable('b-sev', u.sevMoved);
  }

  /** Jeden rok na parkovišti: měsíce běží, nehody padají v náhodných okamžicích. */
  async function runYear(n: number, dur: number, label: string): Promise<number[]> {
    const idx = g.sim.sampleK(100, n);
    const times = idx.map(() => Math.random() * (dur - 300)).sort((a, b) => a - b);
    const yr: YearState = { key: ++g.yearKey, dur, running: true, count: 0, label };
    u.crashed = [];
    u.year = yr;
    force();
    const t0 = performance.now();
    for (let k = 0; k < n; k++) {
      const wait = times[k] - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      u.crashed = [...u.crashed, idx[k]];
      yr.count = k + 1;
      force();
    }
    const rest = dur - (performance.now() - t0);
    if (rest > 0) await sleep(rest);
    yr.running = false;
    force();
    await sleep(250);
    return idx;
  }

  /* ----- úvod ----- */
  function intro() {
    u.step = 0;
    u.picking = false;
    u.year = null;
    show('lot');
    say(
      duel
        ? 'Sto aut s povinným ručením: když řidič způsobí škodu někomu jinému, zaplatí ji jeho pojišťovna. Která letos nabourají? Já taky tipnu.'
        : 'Sto aut s povinným ručením: když řidič způsobí škodu někomu jinému, zaplatí ji jeho pojišťovna. Která letos nabourají?',
    );
    task('');
    setButtons({ id: 'b-start', label: 'Jdu na to', onClick: act(f1Select) });
  }

  /* ----- fáze 1: které auto nabourá (jen pro čtyřlístek, do skóre se nepočítá) ----- */
  const pickLabel = () => {
    const left = 5 - u.picks.length;
    return left > 0 ? `Označ ještě ${left} ${S.carsWord(left)}` : 'Rok se spouští…';
  };

  function f1Select() {
    g.round++;
    clearBoard();
    u.picking = true;
    u.year = null;
    task(`Rok ${g.round} ze ${F1_ROUNDS}: označ 5 aut, která podle tebe nabourají.`, 'Po pátém autě se rok spustí sám');
    setButtons({ id: 'b-run', label: pickLabel(), onClick: () => undefined, disabled: true });
  }

  function togglePick(i: number) {
    if (!u.picking) return;
    if (g.autoH !== null) {
      window.clearTimeout(g.autoH);
      g.autoH = null;
    }
    if (u.picks.includes(i)) u.picks = u.picks.filter((p) => p !== i);
    else if (u.picks.length < 5) u.picks = [...u.picks, i];
    relabel('b-run', pickLabel());
    if (u.picks.length === 5) {
      g.autoH = window.setTimeout(() => {
        g.autoH = null;
        if (alive.current && u.picking && u.picks.length === 5) act(f1Run)();
      }, 550);
    }
  }

  async function f1Run() {
    u.picking = false;
    lock();
    const r = g.round;
    if (duel) {
      // Strýček se vyhne autům, která nabourala loni („už to mají za sebou“). Na šanci to nemá vliv.
      u.uPicks = g.sim.sampleK(100, 5, r > 1 ? g.lastCrashed : []);
      say(r > 1 ? 'Auta, co loni nabourala, vynechám. Už to mají za sebou.' : 'Já beru tyhle. Uvidíme.');
    }
    const count = cfg.demo ? S.DEMO.f1[r - 1] : g.sim.drawCount(1);
    task(`Rok ${r} ze ${F1_ROUNDS}`, 'Rok běží…');
    const crashed = await runYear(count, YEAR_MS_F1, `Rok ${r} ze ${F1_ROUNDS}`);
    g.lastCrashed = crashed;
    const hits = crashed.filter((i) => u.picks.includes(i)).length;
    const uHits = duel ? crashed.filter((i) => u.uPicks.includes(i)).length : 0;
    g.f1hits += hits;
    g.res.f1.crashes.push(count);
    g.res.f1.hits += hits;
    g.res.f1.uncleHits += uHits;
    u.showMissed = true;
    u.log = [...u.log, count];
    task(S.crashedText(count), duel ? `Trefy: ty ${hits}, strýček ${uHits}` : `Tvoje trefy: ${hits}`, true);
    if (hits > 0 && !g.cloverGiven) {
      g.cloverGiven = true;
      u.clover = 1;
      toast('Šťastná trefa: čtyřlístek', 'plus');
    }
    if (r < F1_ROUNDS) {
      say(
        hits > 0
          ? 'Trefa! Čistá náhoda, čtyřlístek si nech.'
          : uHits > 0
            ? 'Mně jedno vyšlo. Čistá náhoda.'
            : 'Nic? Zkus to ještě jednou.',
      );
      setButtons({ id: 'b-run', label: 'Další rok…', onClick: () => undefined, disabled: true });
      await wait(1900);
      f1Select();
    } else {
      // Strýčkovo „už to mají za sebou“ vyvrátit: ve hře je to čistá náhoda, ve skutečnosti dřívější nehody riziko spíš zvyšují.
      say(
        'Náhoda. Které auto nabourá, nepředpoví ani pojišťovna. Riziko odhadne třeba podle dřívějších nehod' +
          (duel ? ', takže moje „už to mají za sebou“ je spíš naopak.' : '.'),
      );
      setButtons({ id: 'b-next', label: 'Pokračovat', onClick: act(f2Intro) });
    }
  }

  /* ----- fáze 2 a finále: tip počtu a šířka pásma před každým rokem ----- */
  const cntMax = (ph: Phase) => (ph === 'f2' ? 15 : 100);
  const gaugeMax = (ph: Phase, ...v: number[]) => (ph === 'f2' ? 15 : Math.min(100, Math.max(70, Math.ceil((Math.max(...v) + 6) / 10) * 10)));

  function previewGauge() {
    const c = u.cnt;
    if (!c || c.tip === null || c.band === null) {
      u.gauge = null;
      return;
    }
    const hw = S.bandHw(c.band, c.tip);
    u.gauge = { max: gaugeMax(c.phase, c.tip + hw), tip: c.tip, hw, uTip: null, uHw: 0 };
    u.lastPts = null;
  }

  function cntEdit(extraMs = 0) {
    const c = u.cnt;
    if (!c) return;
    c.editing = true;
    u.year = c.phase === 'f2' ? u.year : null;
    previewGauge();
    task(
      `Rok ${c.year} ze ${YEARS}: kolik aut ${c.phase === 'f2' ? 'ze stovky' : 'z tisíce'} nabourá?`,
      c.year > 1 ? 'Tip i pásmo můžeš změnit' : 'Zvol tip a šířku pásma',
    );
    setButtons({ id: 'b-cnt', label: `Spustit rok ${c.year}`, onClick: act(cntRun), disabled: c.tip === null || c.band === null });
    if (c.year > 1 && c.tip !== null && c.band !== null) startTimer(TIMER_MS + extraMs, cntRun);
    reveal(() => cntRef.current ?? finRef.current);
  }

  function onCntTip(v: number) {
    const c = u.cnt;
    if (!c || !c.editing) return;
    const t = Math.min(cntMax(c.phase), Math.max(0, Math.round(v)));
    c.tip = t;
    c.slider = t;
    previewGauge();
    enable('b-cnt', c.band !== null);
  }

  function onCntBand(b: number) {
    const c = u.cnt;
    if (!c || !c.editing) return;
    c.band = b;
    previewGauge();
    enable('b-cnt', c.tip !== null);
  }

  function f2Intro() {
    u.step = 1;
    clearBoard();
    u.year = null;
    u.cnt = { phase: 'f2', year: 1, tip: null, slider: 7, band: null, editing: true, rows: [] };
    show('count', 'lot');
    say('Úzké pásmo dá víc bodů, ale snáz mineš.');
    cntEdit();
  }

  async function cntRun() {
    const c = u.cnt;
    if (!c || !c.editing || c.tip === null || c.band === null) return;
    const f2 = c.phase === 'f2';
    if (!f2 && c.tip < 15 && !g.warned) {
      g.warned = true;
      clearTimer();
      say('Pozor, aut je desetkrát víc. Nechceš tip posunout?');
      return;
    }
    clearTimer();
    lock();
    c.editing = false;
    const tip = c.tip;
    const band = c.band;
    const y = c.year;
    const uTip = duel ? (f2 ? S.uncleF2Tip(u.log) : S.UNCLE.finTip) : null;
    const uBand = duel ? (f2 ? S.UNCLE.f2Band : S.UNCLE.finBand) : null;
    const hw = S.bandHw(band, tip);
    const uHw = uTip !== null && uBand !== null ? S.bandHw(uBand, uTip) : 0;
    u.gauge = { max: gaugeMax(c.phase, tip + hw, (uTip ?? 0) + uHw), tip, hw, uTip, uHw };
    u.lastPts = null;
    // Strýček svůj postup řekne jen v prvním roce, další tipy jsou vidět na ukazateli a v řádcích.
    if (duel && y === 1) say(f2 ? `Já ${uTip}, jako loni. Široké, na stovce to lítá.` : 'Já 35 podle dat. A střední, pro jistotu.');
    let n: number;
    let bins: number[] | null = null;
    let money: number[] | null = null;
    if (f2) {
      n = cfg.demo ? S.DEMO.f2[y - 1] : g.sim.drawCount(0);
      clearBoard();
      task(`Rok ${y} ze ${YEARS}`, 'Rok běží…');
      reveal(() => lotRef.current);
      g.lastCrashed = await runYear(n, YEAR_MS_F2, `Rok ${y} ze ${YEARS}`);
    } else {
      const cv = cvRef.current;
      const L = g.finL;
      if (!cv || !L) throw new Error('Plocha finále se nenačetla.');
      n = cfg.demo ? S.DEMO.fin[y - 1] : g.sim.binom(1000, S.P);
      const crashes: Crash[] = g.sim.sampleK(1000, n).map((i) => ({ i, x: g.sim.drawSev(), t: 0 }));
      const yr: YearState = { key: ++g.yearKey, dur: YEAR_MS_FIN, running: true, count: 0, label: `Rok ${y} ze ${YEARS}` };
      u.year = yr;
      task(`Rok ${y} ze ${YEARS}`, 'Rok běží…');
      reveal(() => finRef.current);
      drawFin(cv, L, g.colors1000, [], 0);
      await animateYear(cv, L, g.colors1000, crashes, YEAR_MS_FIN, (k) => {
        yr.count = k;
        force();
      }, () => alive.current);
      if (!alive.current) throw new Aborted();
      yr.running = false;
      yr.count = n;
      bins = [0, 0, 0];
      money = [0, 0, 0];
      for (const cr of crashes) {
        const b = S.binOf(cr.x);
        bins[b]++;
        money[b] += cr.x;
        g.finCounts[b]++;
        g.finMoney[b] += cr.x;
      }
    }
    const pts = S.bandPoints(band, tip, n);
    const uPts = uTip !== null && uBand !== null ? S.bandPoints(uBand, uTip, n) : null;
    const row: CntRow = { y, n, tip, band, pts, uTip, uBand, uPts, mix: bins ? bins.map((v) => (n > 0 ? v / n : 0)) : null };
    c.rows = [...c.rows, row];
    const rec: YearRes = {
      tip,
      band: S.BANDS[band].id,
      crashes: n,
      points: pts,
      uncleTip: uTip,
      uncleBand: uBand !== null ? S.BANDS[uBand].id : null,
      unclePoints: uPts,
    };
    if (f2) {
      g.res.f2.push(rec);
      u.log = [...u.log, n];
    } else g.res.finale.push({ ...rec, bins: bins ?? [0, 0, 0], money: money ?? [0, 0, 0] });
    u.lastPts = { me: pts, uncle: uPts };
    task(S.crashedText(n), f2 ? `Rok ${y} ze ${YEARS}` : `${S.per100(n)} na 100 aut`, true);
    addPoints(pts, uPts ?? 0, band === 0 ? 'Trefa do úzkého pásma!' : undefined);
    await wait(800);
    const hit = S.bandHit(band, tip, n);
    // Tip podle dat pojišťoven (35 ± 3): minutí je smůla, ne chyba úvahy.
    const dataTip = !f2 && Math.abs(tip - S.UNCLE.finTip) <= 3;
    if (y < YEARS) {
      c.year++;
      const line =
        f2
          ? band === 0
            ? hit
              ? 'Trefa do úzkého! Na stovce je to hlavně štěstí.'
              : 'Úzké pásmo na stovce aut je skoro loterie.'
            : hit
              ? 'Sedí. Další rok.'
              : 'Vedle. Na stovce aut počet hodně kolísá.'
          : band === 0
            ? hit
              ? 'Úzké vychází: na tisíci autech kolísá počet relativně méně.'
              : dataTip
                ? 'Smůla. Tip podle dat byl dobrý, úzké pásmo tu vyjde asi 2 roky ze 3.'
                : 'Vedle. Sedí tvůj tip s daty pojišťoven?'
            : hit
              ? 'Sedí. Na tisíci autech si můžeš věřit víc.'
              : dataTip
                ? 'Smůla. Tip podle dat byl dobrý, i na tisíci autech počet trochu kolísá.'
                : 'Vedle. Mrkni na data pojišťoven.';
      // Měkký časovač dostane navíc dobu na přečtení repliky.
      const fresh = line !== u.say;
      if (fresh) say(line);
      cntEdit(fresh ? readMs(line) : 0);
    } else if (f2) {
      say('Na stovce aut počet hodně kolísá, úzké pásmo sedí jen občas.');
      setButtons({ id: 'b-next', label: 'Pokračovat', onClick: act(f3Intro) });
    } else {
      // Podíl velkých škod: malý deník proti 1 000 autům za 3 roky (deník přeceňuje, fáze 3a ukazuje 1 velkou záměrně).
      u.finShare = { counts: g.finCounts.slice(), money: g.finMoney.slice(), n: sum(g.finCounts) };
      const fm = S.bigPct(g.finMoney);
      // Čísla jsou u pruhů (deník, 1 000 aut, data pojišťoven), replika nese jen pointu.
      say(`Na tisíci autech kolísá relativně méně počet i podíl peněz. Velké nehody tu stojí ${fm} %.`);
      reveal(() => document.getElementById('fin-share'));
      setButtons({ id: 'b-next', label: 'Souhrn', onClick: act(endScreen) });
    }
  }

  /* ----- fáze 3a: výše škody podle hlášení ----- */
  const curSevTip = () => S.roundTip(S.sToX(u.sevS / 1000));

  function f3Intro() {
    u.step = 2;
    u.year = null;
    u.gauge = null;
    u.cnt = null;
    const cars = g.lastCrashed.slice(0, 3);
    while (cars.length < 3) {
      const extra = g.cos.sampleK(100, 1, cars)[0];
      cars.push(extra);
    }
    g.f3cars = cars;
    const items: S.SevItem[] = cfg.demo ? S.DEMO.sev.map((d) => ({ sc: S.scenarioById(d.id), x: d.x })) : g.sim.genSev3();
    // Třídní demo: první auto (malá škoda) je červené, aby bylo vidět, že barva nic neznamená.
    if (cfg.demo) u.colors[cars[0]] = S.RED;
    g.sev = items.map((i) => i.x);
    g.scen = items.map((i) => i.sc);
    g.sevTips = [];
    u.sevIdx = 0;
    u.liq = [null, null, null];
    show('sev');
    say('Teď výše škody, kterou řidič způsobil. Napoví hlášení o nehodě.');
    sevCar();
    window.scrollTo({ top: 0 });
  }

  function sevCar() {
    const k = u.sevIdx;
    u.sevS = 500;
    u.sevMoved = false;
    task(`Hlášení ${k + 1} ze 3`, 'Jak velká bude škoda?');
    setButtons({ id: 'b-sev', label: k < 2 ? 'Další hlášení' : 'Odhalit skutečnost', onClick: act(sevNext), disabled: true });
  }

  function onSev(v: number) {
    u.sevS = v;
    if (!u.sevMoved) {
      u.sevMoved = true;
      enable('b-sev', !u.liqBusy);
    } else force();
  }

  function sevNext() {
    if (!u.sevMoved) return;
    g.sevTips.push(curSevTip());
    u.sevIdx++;
    if (u.sevIdx < 3) sevCar();
    else return f3Reveal();
  }

  async function f3Reveal() {
    lock();
    u.reveal = [];
    show('reveal');
    task('Tip a skutečnost');
    if (duel) say('U červených aut přidávám, ty bývají dražší.');
    window.scrollTo({ top: 0 });
    for (let k = 0; k < 3; k++) {
      const x = g.sev[k];
      const t = g.sevTips[k];
      const sc = g.scen[k];
      const color = u.colors[g.f3cars[k]] ?? S.CAR_COLORS[1];
      const uTip = S.uncleSevTip(sc, color);
      const row: RevealRow = {
        tip: t,
        uTip,
        clue: `${sc.place}, ${sc.speed}, ${sc.injury === 'nikdo' ? 'bez zranění' : sc.injury}, ${S.COLOR_NAMES[color] ?? 'jiná'}${u.liq[k] ? ', likvidátor' : ''}`,
        actual: x,
        display: S.XMIN,
        done: false,
        pts: S.sevPoints(t, x),
        uPts: duel ? S.sevPoints(uTip, x) : null,
        color,
      };
      u.reveal = [...u.reveal, row];
      force();
      reveal(() => document.getElementById(`rv-${k}`));
      const t0 = performance.now();
      while (performance.now() - t0 < 600) {
        row.display = S.roundTip(S.sToX(Math.random()));
        force();
        await sleep(60);
      }
      row.display = x;
      row.done = true;
      g.res.f3a.push({
        scenario: sc.id,
        color: S.COLOR_NAMES[color] ?? color,
        tip: t,
        actual: x,
        points: row.pts,
        uncleTip: duel ? uTip : null,
        unclePoints: row.uPts,
        likvidator: !!u.liq[k],
      });
      addPoints(row.pts, row.uPts ?? 0, 'Přesně!');
      await sleep(350);
    }
    const red = g.f3cars.some((i) => u.colors[i] === S.RED);
    say(
      duel && red
        ? 'Červená, a dražší? Kdepak. Rozhoduje, kde a jak se to stalo.'
        : 'Podle hlášení se škoda odhadne, přesně ale ne. Barva nehraje roli.',
    );
    setButtons({ id: 'b-next', label: 'Pokračovat', onClick: act(f3Sprint) });
  }

  /* ----- fáze 3b: likvidátorský sprint (třídění hlášení na čas) ----- */
  const clearSprintTimers = () => {
    g.sprintH.forEach((h) => window.clearTimeout(h));
    g.sprintH = [];
  };

  const curItem = (sp: Sprint): SprintItem => (sp.inTrial && sp.trial ? sp.trial : sp.items[sp.k]);

  function f3Sprint() {
    const [u0, u1] = S.UNCLE_SPRINT_MS;
    const items: SprintItem[] = g.sim
      .genSprint(S.SPRINT_N)
      .map((it) => ({ ...it, color: g.cos.color(), uMs: Math.round(u0 + (u1 - u0) * g.cos.uniform()) }));
    // Test barvy: dvě červená auta s úplně jinou škodou, žádné další červené.
    const redPair = S.plantRedPair(items, () => g.cos.nonRed());
    // Zkušební hlášení: vždy zřetelný ťukanec na parkovišti, aby se hráč v klidu seznámil s ovládáním.
    const trial: SprintItem | null = { sc: S.scenarioById('park-auto'), x: 12000, color: S.CAR_COLORS[1], uMs: 0 };
    u.sprint = {
      k: 0,
      items,
      trial,
      inTrial: false,
      trialDone: !trial,
      limit: 0,
      key: 0,
      started: 0,
      phase: 'intro',
      uDone: false,
      fb: null,
      streak: 0,
      best: 0,
      correct: 0,
      luckless: 0,
      me: 0,
      un: 0,
      uRedMiss: 0,
      redPair,
    };
    g.res.sprint.colorTest = redPair;
    show('sprint');
    window.scrollTo({ top: 0 });
    say(
      duel
        ? 'Třídíme jako v Kahootu: čím rychleji správně, tím víc bodů. Já taky.'
        : 'Třídíme jako v Kahootu: čím rychleji správně, tím víc bodů.',
    );
    task('Likvidátorský sprint', `${S.SPRINT_N} hlášení, rychlost se počítá do bodů`);
    setButtons({ id: 'b-sprint', label: trial ? 'Zkusit nanečisto' : 'Start', onClick: act(sprintNext) });
  }

  function sprintTrial() {
    const sp = u.sprint;
    if (!sp || !sp.trial) return;
    sp.inTrial = true;
    sp.phase = 'live';
    sp.fb = null;
    sp.uDone = false;
    sp.limit = 0;
    sp.key++;
    sp.started = performance.now();
    u.buttons = [];
    task('');
    say('Zkouška nanečisto, čas neběží. Ťukni na přihrádku dole.');
    force();
  }

  function sprintNext() {
    const sp = u.sprint;
    if (!sp || sp.phase === 'live' || sp.phase === 'done') return;
    if (!sp.trialDone) return sprintTrial();
    if (sp.k >= S.SPRINT_N) return sprintEnd();
    clearSprintTimers();
    sp.inTrial = false;
    const it = sp.items[sp.k];
    sp.phase = 'live';
    sp.fb = null;
    sp.uDone = false;
    sp.limit = S.SPRINT_MS;
    sp.key++;
    sp.started = performance.now();
    u.buttons = [];
    task('');
    if (duel)
      g.sprintH.push(
        window.setTimeout(() => {
          if (alive.current && sp.phase === 'live') {
            sp.uDone = true;
            force();
          }
        }, it.uMs),
      );
    g.sprintH.push(window.setTimeout(() => alive.current && act(() => sprintAnswer(null))(), sp.limit));
    force();
  }

  async function sprintAnswer(b: number | null) {
    const sp = u.sprint;
    if (!sp || sp.phase !== 'live') return;
    sp.phase = 'fb';
    clearSprintTimers();
    const it = curItem(sp);
    const ms = b === null ? null : Math.round(performance.now() - sp.started);
    const truth = S.binOf(it.x);
    const ok = b !== null && b === truth;
    if (sp.inTrial) {
      sp.fb = { ans: b, ok, luckless: false, truth, x: it.x, pts: 0, uAns: null, uOk: false, uLuckless: false, uPts: null, ms };
      sp.trialDone = true;
      say(ok ? 'Přesně. Parkoviště, krokem, bez zranění: ťukanec. Teď naostro!' : 'Skoro. Parkoviště, krokem, bez zranění bývá ťukanec. Teď naostro!');
      setButtons({ id: 'b-sprint', label: 'Teď naostro', onClick: act(sprintNext) });
      return;
    }
    // Smůla: hráč přečetl hlášení správně (typická přihrádka scénáře), ale tahle škoda vyšla jinak.
    const luckless = !ok && b !== null && b === it.sc.bin;
    const pts = ok && ms !== null ? S.sprintPoints(ms) : luckless ? S.SPRINT_LUCKLESS_POINTS : 0;
    let uAns: number | null = null;
    let uOk = false;
    let uLuckless = false;
    let uPts: number | null = null;
    if (duel) {
      uAns = S.uncleSprintAnswer(it.sc, it.color);
      uOk = uAns === truth;
      uLuckless = !uOk && uAns === it.sc.bin;
      uPts = uOk ? S.sprintPoints(it.uMs) : uLuckless ? S.SPRINT_LUCKLESS_POINTS : 0;
      if (!uOk && it.color === S.RED && uAns !== it.sc.bin) sp.uRedMiss++;
    }
    sp.streak = ok ? sp.streak + 1 : luckless ? sp.streak : 0;
    sp.best = Math.max(sp.best, sp.streak);
    if (ok) sp.correct++;
    if (luckless) sp.luckless++;
    sp.me += pts;
    if (uPts !== null) sp.un += uPts;
    sp.fb = { ans: b, ok, luckless, truth, x: it.x, pts, uAns, uOk, uLuckless, uPts, ms };
    g.res.sprint.items.push({
      scenario: it.sc.id,
      color: S.COLOR_NAMES[it.color] ?? it.color,
      actual: it.x,
      bin: truth,
      reportBin: it.sc.bin,
      answer: b,
      ms,
      points: pts,
      uncleAnswer: uAns,
      uncleMs: duel ? it.uMs : null,
      unclePoints: uPts,
    });
    u.score.me += pts;
    u.score.uncle += uPts ?? 0;
    toast(
      b === null
        ? 'Čas vypršel'
        : ok
          ? `${pts === 3 ? 'Bleskově! ' : pts === 2 ? 'Rychle! ' : 'Správně! '}+${pts} ${S.pointsWord(pts)}`
          : luckless
            ? 'Smůla, +1 bod za správné čtení'
            : 'Vedle, 0 bodů',
      b === null ? 'info' : ok ? (pts === 3 ? 'big' : 'plus') : luckless ? 'plus' : 'minus',
    );
    task('');
    await wait(1400);
    sp.k++;
    if (sp.k < S.SPRINT_N) sprintNext();
    else sprintEnd();
  }

  function sprintEnd() {
    const sp = u.sprint;
    if (!sp) return;
    clearSprintTimers();
    sp.phase = 'done';
    g.res.sprint.points = sp.me;
    g.res.sprint.unclePoints = duel ? sp.un : null;
    task(
      `Správně ${sp.correct} z ${S.SPRINT_N}${sp.luckless > 0 ? `, smůla ${sp.luckless}×` : ''}`,
      duel ? `sprint: ty ${sp.me}, strýček ${sp.un}` : `body za sprint: ${sp.me}`,
      true,
    );
    const rp = sp.redPair;
    say(
      rp
        ? `Hlášení napoví skoro vždy, barva nikdy. Dvě červená auta: ${S.fmtK(sp.items[rp[0]].x)} a ${S.fmtK(sp.items[rp[1]].x)}.` +
            (duel && sp.uRedMiss > 0 ? ' A já zase vsadil na barvu.' : '')
        : 'Hlášení napoví skoro vždy. Jen skoro: škoda občas vyjde jinak.' + (duel && sp.uRedMiss > 0 ? ' A moje červená? Vedle.' : ''),
    );
    setButtons({ id: 'b-next', label: 'Pokračovat', onClick: act(f3Diary) });
  }

  /* ----- deník nehod (hlášení z fáze 3a a ze sprintu), pak 3c: rozdělení do přihrádek ----- */
  async function f3Diary() {
    lock();
    const claims = g.sev.concat(u.sprint ? u.sprint.items.map((i) => i.x) : []);
    const total = claims.length;
    const money = [0, 0, 0];
    for (const x of claims) money[S.binOf(x)] += x;
    u.bins = { mode: 'show', tip: [0, 0, 0], act: [0, 0, 0], flash: -1, uAlloc: null, round: 0, diary: [0, 0, 0], money: [0, 0, 0] };
    u.kolo = [];
    show('bins');
    task(`Deník nehod: ${total} hlášení`);
    window.scrollTo({ top: 0 });
    for (const x of claims) {
      const b = S.binOf(x);
      u.bins.act = u.bins.act.map((v, i) => (i === b ? v + 1 : v));
      u.bins.flash = b;
      force();
      await sleep(Math.max(45, 1000 / total));
    }
    u.bins.flash = -1;
    u.bins.diary = u.bins.act.slice();
    u.bins.money = money;
    g.diary = { counts: u.bins.diary.slice(), money: money.slice() };
    await sleep(250);
    const big = u.bins.diary[2];
    const bigShare = Math.round((100 * money[2]) / Math.max(1, sum(money)));
    say(
      big > 0
        ? `${big === 1 ? 'Velká nehoda je jen 1' : `Velké nehody jsou jen ${big}`} z ${total}, ale stojí ${bigShare} % všech peněz.`
        : 'Velká nehoda tu žádná není. Přijde ale, a pak stojí nejvíc.',
    );
    f3Alloc(1);
  }

  const allocLeft = () => 10 - sum(u.bins.tip);

  function allocTask() {
    const left = allocLeft();
    const r = u.bins.round;
    task(
      `Kolo ${r} ze ${KOLA}: rozděl 10 nehod`,
      left > 0 ? `Zbývá ${left}` : r > 1 ? 'Rozdělení můžeš změnit' : 'Hotovo',
    );
    enable('b-run3', left === 0);
  }

  function f3Alloc(r: number) {
    u.bins.mode = 'alloc';
    u.bins.round = r;
    u.bins.flash = -1;
    if (r === 1) {
      u.bins.act = [0, 0, 0];
      u.bins.tip = [0, 0, 0];
    } else u.bins.act = [0, 0, 0];
    setButtons({ id: 'b-run3', label: `Spustit kolo ${r}`, onClick: act(f3Run), disabled: true });
    allocTask();
  }

  function allocChange(b: number, d: number) {
    if (u.bins.mode !== 'alloc') return;
    if (d > 0 && allocLeft() === 0) return;
    if (d < 0 && u.bins.tip[b] === 0) return;
    u.bins.tip = u.bins.tip.map((v, i) => (i === b ? v + d : v));
    allocTask();
  }

  async function f3Run() {
    if (u.bins.mode !== 'alloc' || allocLeft() !== 0) return;
    lock();
    u.bins.mode = 'run';
    const r = u.bins.round;
    const tip = u.bins.tip.slice();
    const uAlloc = duel ? S.UNCLE.alloc.slice() : null;
    u.bins.uAlloc = uAlloc;
    if (uAlloc && r === 1) say('Já dám 5, 4, 1. Tak to vychází v datech pojišťoven, deník je malý.');
    const a = [0, 0, 0];
    u.bins.act = a.slice();
    const live = () => `sedí: ty ${S.allocOverlap(tip, a)}${uAlloc ? `, strýček ${S.allocOverlap(uAlloc, a)}` : ''}`;
    task(`Kolo ${r} ze ${KOLA}`, live());
    for (let k = 0; k < 10; k++) {
      const b = S.binOf(g.sim.drawSev());
      a[b]++;
      u.bins.act = a.slice();
      u.bins.flash = b;
      task(`Kolo ${r} ze ${KOLA}`, live());
      await sleep(140);
    }
    const ov = S.allocOverlap(tip, a);
    const uOv = uAlloc ? S.allocOverlap(uAlloc, a) : 0;
    const pts = S.allocPoints(ov);
    const uPts = uAlloc ? S.allocPoints(uOv) : null;
    g.res.f3c.push({ alloc: tip, counts: a.slice(), overlap: ov, points: pts, uncleOverlap: uAlloc ? uOv : null, unclePoints: uPts });
    u.kolo = [...u.kolo, { r, act: a.slice(), tip, ov, uOv, pts, uPts }];
    u.bins.flash = -1;
    task(`Kolo ${r}: sedí ${ov} z 10`, uAlloc ? `strýček ${uOv} z 10` : '', true);
    reveal(() => document.getElementById(`kolo-${r}`));
    addPoints(pts, uPts ?? 0, ov === 10 ? 'Přesně!' : undefined);
    await sleep(900);
    if (r < KOLA) {
      f3Alloc(r + 1);
    } else {
      say('Konkrétní škodu netrefíš, rozložení ano.');
      setButtons({ id: 'b-next', label: 'Pokračovat', onClick: act(finaleIntro) });
    }
  }

  /* ----- finále: deset parkovišť ----- */
  async function finaleIntro() {
    lock();
    u.step = 3;
    u.year = null;
    u.gauge = null;
    u.cnt = null;
    u.fin = { head: 'Tvoje parkoviště' };
    g.colors1000 = Array.from({ length: 1000 }, (_, i) => (i < 100 ? u.colors[i] : g.cos.color()));
    g.warned = false;
    task('');
    show('fin');
    window.scrollTo({ top: 0 });
    say('Tvoje parkoviště je jedno z deseti. Mrkni na data pojišťoven.');
    await sleep(40);
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) throw new Error('Plocha finále se nenačetla.');
    g.finL = await zoomOut(cv, wrap, g.colors1000, () => alive.current);
    if (!alive.current) throw new Aborted();
    u.fin.head = 'Deset parkovišť, tisíc aut';
    u.cnt = { phase: 'fin', year: 1, tip: null, slider: 50, band: null, editing: true, rows: [] };
    cntEdit();
  }

  /* ----- konec ----- */
  function endScreen() {
    u.step = 4;
    u.year = null;
    u.gauge = null;
    const r = g.res;
    const rows: EndRow[] = [
      { label: 'Kolik aut ze 100', me: sum(r.f2.map((x) => x.points)), uncle: sum(r.f2.map((x) => x.unclePoints ?? 0)) },
      { label: 'Výše škody', me: sum(r.f3a.map((x) => x.points)), uncle: sum(r.f3a.map((x) => x.unclePoints ?? 0)) },
      { label: 'Třídění hlášení', me: r.sprint.points, uncle: r.sprint.unclePoints ?? 0 },
      { label: 'Rozložení škod', me: sum(r.f3c.map((x) => x.points)), uncle: sum(r.f3c.map((x) => x.unclePoints ?? 0)) },
      { label: 'Kolik aut z 1 000', me: sum(r.finale.map((x) => x.points)), uncle: sum(r.finale.map((x) => x.unclePoints ?? 0)) },
    ];
    const pts = sum(rows.map((x) => x.me));
    const un = sum(rows.map((x) => x.uncle));
    let winner: 'player' | 'uncle' | 'tie' | null = null;
    let tieBreak: string | null = null;
    if (duel) {
      if (pts !== un) winner = pts > un ? 'player' : 'uncle';
      else {
        // Rozhodnutí remízy: menší součet chyb ve finále, pak ve fázi 2, pak ve fázi 3a.
        const errs: [string, number, number][] = [
          ['finale', sum(r.finale.map((x) => Math.abs(x.crashes - x.tip))), sum(r.finale.map((x) => Math.abs(x.crashes - (x.uncleTip ?? 0))))],
          ['f2', sum(r.f2.map((x) => Math.abs(x.crashes - x.tip))), sum(r.f2.map((x) => Math.abs(x.crashes - (x.uncleTip ?? 0))))],
          ['f3a', sum(r.f3a.map((x) => Math.abs(Math.log(x.tip / x.actual)))), sum(r.f3a.map((x) => Math.abs(Math.log((x.uncleTip ?? x.actual) / x.actual))))],
        ];
        winner = 'tie';
        for (const [k, me, uu] of errs) {
          if (Math.abs(me - uu) > 1e-9) {
            winner = me < uu ? 'player' : 'uncle';
            tieBreak = k;
            break;
          }
        }
      }
    }
    u.end = { pts, sent: false, rows, winner, tieBreak, againReady: false };
    show('end');
    task('');
    say(FREQ_SEV);
    window.scrollTo({ top: 0 });
    setButtons({ id: 'b-continue', label: 'Pokračovat', onClick: act(sendFinish) });
  }

  async function sendFinish() {
    if (!u.end || u.end.sent) return;
    u.end.sent = true;
    const pts = u.end.pts;
    const rate = Math.min(1, Math.max(0, pts) / S.SUCCESS_REF);
    const decisions =
      g.res.f2.length * 2 +
      g.res.f3a.length +
      g.res.sprint.items.length +
      g.res.f3c.length +
      g.res.finale.length * 2 +
      (g.res.cards.likvidator.used ? 1 : 0);
    (preview ? (rr: number, p: unknown) => console.info('[minihra] náhled, FINISH:', rr, p) : finish)(rate, {
      version: 8,
      skillPoints: { points: pts, ref: S.SUCCESS_REF, max: S.MAX_POINTS },
      duel: duel ? { player: u.score.me, uncle: u.score.uncle, winner: u.end.winner, tieBreak: u.end.tieBreak } : null,
      clover: u.clover,
      f1: g.res.f1,
      f2: g.res.f2,
      f3a: g.res.f3a,
      sprint: g.res.sprint,
      f3c: g.res.f3c,
      finale: g.res.finale,
      cards: duel ? g.res.cards : null,
      decisions,
      durationSec: Math.round((performance.now() - g.t0) / 1000),
    });
    if (embedded) {
      lock();
      return;
    }
    // Samostatný režim: Hrát znovu se odemkne až po chvíli (dvojité ťuknutí nespustí hru znovu).
    setButtons({ id: 'b-again', label: 'Hrát znovu', onClick: onRestart, disabled: true });
    await sleep(1200);
    u.end.againReady = true;
    enable('b-again', true);
  }

  useEffect(() => {
    alive.current = true;
    intro();
    return () => {
      alive.current = false;
      if (g.timerH !== null) window.clearTimeout(g.timerH);
      if (g.autoH !== null) window.clearTimeout(g.autoH);
      g.sprintH.forEach((h) => window.clearTimeout(h));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- vykreslení ---------- */
  const has = (p: PanelId) => u.panels.includes(p);
  const year = u.year;
  const cnt = u.cnt;
  const yearEl = year ? (
    <YearBar label={year.label} count={year.count} running={year.running} dur={year.dur} runKey={year.key} />
  ) : null;
  const gaugeEl = u.gauge ? (
    <Gauge
      g={u.gauge}
      count={cnt?.editing ? 0 : (year?.count ?? 0)}
      done={!cnt?.editing && year ? !year.running : false}
      pts={cnt?.editing ? null : u.lastPts}
    />
  ) : null;
  const ptsText = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');
  const cls = (p: number) => (p > 0 ? 'ok' : p < 0 ? 'bad' : '');
  const verdict = (pts: number, uPts: number | null) => (
    <span className="vv">
      <span className={cls(pts)}>ty {ptsText(pts)}</span>
      {duel && uPts !== null && <span className={`u ${cls(uPts)}`}>strýček {ptsText(uPts)}</span>}
    </span>
  );

  const cntEditor = (c: Cnt) => {
    const max = cntMax(c.phase);
    const ranges = S.BANDS.map((_, b) => (c.tip === null ? null : S.rangeText(...S.bandRange(b, c.tip))));
    return (
      <div className="cnt-edit">
        <div className="count-display">
          <button type="button" className="st" id="tip-minus" aria-label="O jedno méně" onClick={() => onCntTip((c.tip ?? c.slider) - 1)}>
            {'−'}
          </button>
          <span className="big-num">{c.tip ?? '?'}</span>
          <span className="big-unit">{c.tip === null ? '' : S.carsWord(c.tip)}</span>
          <button type="button" className="st" id="tip-plus" aria-label="O jedno víc" onClick={() => onCntTip((c.tip ?? c.slider) + 1)}>
            +
          </button>
        </div>
        <input
          type="range"
          id="tip"
          className={c.tip === null ? 'untouched' : ''}
          min={0}
          max={max}
          step={1}
          value={c.tip ?? c.slider}
          aria-label={c.phase === 'f2' ? 'Tip, kolik aut ze stovky nabourá' : 'Tip, kolik aut z tisíce nabourá'}
          onChange={(e) => onCntTip(Number(e.target.value))}
          onPointerUp={() => c.tip === null && onCntTip(c.slider)}
        />
        <Ticks values={c.phase === 'f2' ? [0, 5, 10, 15] : [0, 25, 50, 75, 100]} pos={(v) => v / max} />
        <BandPicker bands={S.BANDS} band={c.band} ranges={ranges} onBand={onCntBand} />
        <p className="hint rule">V pásmu body získáš. Mimo úzké a střední pásmo bod ztratíš.</p>
      </div>
    );
  };

  const cntRows = (c: Cnt) =>
    c.rows.length > 0 && (
      <div className="rows">
        {c.rows.map((r) => (
          <div key={r.y} className="cnt-row">
            <div className="fin-top">
              <span>
                Rok {r.y}: <b>{r.n}</b> {S.carsWord(r.n)}
                {c.phase === 'fin' && <small className="per100"> = {S.per100(r.n)} na 100</small>}
              </span>
              {verdict(r.pts, r.uPts)}
            </div>
            <div className="cnt-sub">
              ty {r.tip}, {S.BANDS[r.band].name.toLowerCase()}
              {duel && r.uTip !== null && r.uBand !== null && (
                <span className="u">
                  {' '}
                  · strýček {r.uTip}, {S.BANDS[r.uBand].name.toLowerCase()}
                </span>
              )}
            </div>
            {r.mix && <Mix shares={r.mix} />}
          </div>
        ))}
      </div>
    );

  return (
    <div className="app">
      <header className="hud">
        <div>
          <h1>Náhoda za volantem</h1>
          <p className="sub">Parkoviště u kavárny</p>
        </div>
        <div className="counters">
          <span className="pill duel" title={duel ? 'Skóre ty proti strýčkovi' : 'Body'}>
            <span className="me">
              Ty <b key={`m${u.score.me}`} className="bump">{u.score.me}</b>
            </span>
            {duel && (
              <>
                <span className="sep">:</span>
                <span className="un">
                  <b key={`u${u.score.uncle}`} className="bump">{u.score.uncle}</b> Strýček
                </span>
              </>
            )}
          </span>
          <span className="pill" title="Čtyřlístky">
            <Clover className="pill-clv" />
            <b>{u.clover}</b>
          </span>
        </div>
      </header>

      <ol className="steps" aria-label="Části minihry">
        {STEPS.map((s, i) => (
          <li key={s} className={i < u.step ? 'is-done' : i === u.step ? 'is-current' : ''}>
            <span className="bar" />
            <span className="lbl">{s}</span>
          </li>
        ))}
      </ol>

      {u.log.length > 0 && u.step <= 1 && (
        <div className="log">
          <span className="log-label">Deník: nabouraná auta za rok</span>
          <div className="chips">
            {u.log.map((n, i) => (
              <span key={i} className="chip" aria-label={`${i + 1}. rok: ${n}`}>
                <b>{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="say" aria-live="polite">
        <Avatar />
        <div className="bubble">
          <span className="who">Strýček</span>
          <p key={u.sayKey} className="text in">
            {u.say}
          </p>
        </div>
      </section>

      {u.task && (
        <div className={`task${u.task.result ? ' is-result' : ''}`}>
          <span className="task-main">{u.task.main}</span>
          <span className="task-meta">{u.task.meta}</span>
        </div>
      )}

      {has('count') && cnt && (cnt.editing || cnt.rows.length > 0) && (
        <section className="panel" ref={cntRef}>
          {cnt.editing && cntEditor(cnt)}
          {cnt.editing && gaugeEl}
          {cntRows(cnt)}
        </section>
      )}

      {has('sev') && (
        <section className="panel">
          {(() => {
            const sc = g.scen[u.sevIdx] ?? S.SCENARIOS[0];
            const color = u.colors[g.f3cars[u.sevIdx]] ?? S.CAR_COLORS[1];
            return (
              <div className="report">
                <div className="report-title">
                  <span>Hlášení o nehodě {u.sevIdx + 1}</span>
                  <span className="report-car">
                    <CarSvg color={color} />
                  </span>
                </div>
                <dl className="report-list">
                  <div>
                    <dt>Kde</dt>
                    <dd>{sc.place}</dd>
                  </div>
                  <div>
                    <dt>Rychlost</dt>
                    <dd>{sc.speed}</dd>
                  </div>
                  <div className="wide">
                    <dt>Co se stalo</dt>
                    <dd>{sc.what}</dd>
                  </div>
                  <div>
                    <dt>Zranění</dt>
                    <dd>{sc.injury}</dd>
                  </div>
                  <div>
                    <dt>Barva auta</dt>
                    <dd>{S.COLOR_NAMES[color] ?? 'jiná'}</dd>
                  </div>
                  {u.liqBusy && (
                    <div className="wide liq busy">
                      <dt>Likvidátor</dt>
                      <dd>prohlíží místo nehody…</dd>
                    </div>
                  )}
                  {u.liq[u.sevIdx] && (
                    <div className="wide liq">
                      <dt>Odhad likvidátora</dt>
                      <dd>
                        {Math.round(u.liq[u.sevIdx]!.lo / 1000)} až {S.fmtK(u.liq[u.sevIdx]!.hi)}
                        {S.hasInjury(g.scen[u.sevIdx]) && <small className="liq-note"> u zranění nejistější</small>}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })()}
          <div className={`sev-val${u.sevMoved ? '' : ' muted'}`}>{u.sevMoved ? S.fmtK(curSevTip()) : 'Posuň jezdec'}</div>
          <input
            type="range"
            id="sev"
            className={u.sevMoved ? '' : 'untouched'}
            min={0}
            max={1000}
            step={1}
            value={u.sevS}
            aria-label="Tip výše škody"
            onChange={(e) => onSev(Number(e.target.value))}
            onPointerUp={() => !u.sevMoved && onSev(u.sevS)}
          />
          {u.sevMoved && <SevBands tip={curSevTip()} pos={(x) => S.xToS(x)} tiers={S.SEV_TIERS} />}
          <Ticks values={[5, 10, 20, 50, 100, 200, 500]} pos={(v) => S.xToS(v * 1000)} />
          <p className="hint rule">Skutečnost v tmavém pásmu: 3 body (nejvýš 1,25krát víc nebo míň), ve středním 2 body (1,5krát), ve světlém 1 bod (2krát). Částky v tis. Kč.</p>
        </section>
      )}

      {has('reveal') && (
        <section className="panel">
          <div className="legend">
            <span>
              <i className="m m-tip" />
              tvůj tip
            </span>
            {duel && (
              <span>
                <i className="m m-uncle" />
                strýček
              </span>
            )}
            <span>
              <i className="m m-real" />
              skutečná škoda
            </span>
          </div>
          <div className="axis-scale">
            <span style={{ left: 0 }}>5 tis.</span>
            <span style={{ left: '50%', transform: 'translateX(-50%)' }}>50 tis.</span>
            <span style={{ right: 0 }}>500 tis. Kč</span>
          </div>
          {u.reveal.map((r, k) => {
            const a = S.xToS(r.tip) * 100;
            const b = S.xToS(r.actual) * 100;
            const c = S.xToS(r.uTip) * 100;
            return (
              <div key={k} className="rv-row" id={`rv-${k}`}>
                <div className="rv-head">
                  <span className="rv-car">
                    <CarSvg color={r.color} />
                    Hlášení {k + 1}
                  </span>
                  {r.done ? verdict(r.pts, r.uPts) : <span className="rv-wait">odhaluji…</span>}
                </div>
                <div className="rv-clue">{r.clue}</div>
                <div className="axis">
                  {r.done && <span className="seg" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                  {duel && <span className="m m-uncle" style={{ left: `${c}%` }} />}
                  <span className="m m-tip" style={{ left: `${a}%` }} />
                  {r.done && <span className="m m-real" style={{ left: `${b}%` }} />}
                </div>
                <div className={`rv-nums${duel ? ' three' : ''}`}>
                  <span>
                    <small>ty</small>
                    <b className="me">{S.fmtK(r.tip)}</b>
                  </span>
                  {duel && (
                    <span>
                      <small>strýček</small>
                      <b className="u">{S.fmtK(r.uTip)}</b>
                    </span>
                  )}
                  <span>
                    <small>skutečnost</small>
                    <b className={r.done ? '' : 'rolling'}>{S.fmtK(r.display)}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {has('sprint') && u.sprint && (
        <section className="panel sprint">
          {(() => {
            const sp = u.sprint;
            if (sp.phase === 'intro')
              return (
                <div className="sp-intro">
                  <div className="sp-bins-info">
                    {[0, 1, 2].map((b) => (
                      <div key={b} className={`sp-bininfo b${b}`}>
                        <b>{S.BIN_NAMES[b]}</b>
                        <span>{S.BIN_RANGES[b]}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="sp-rules">
                    <li>Správná odpověď do 3 s: 3 body, do 6 s: 2 body, do 9 s: 1 bod.</li>
                    <li>Chyba nebo vypršený čas: 0 bodů.</li>
                    <li>{duel ? 'Strýček hraje podle stejných pravidel. ' : ''}Nejdřív si to zkusíš nanečisto.</li>
                  </ul>
                </div>
              );
            if (sp.phase === 'done')
              return (
                <>
                <div className="sp-done">
                  <div className="sp-stat">
                    <b>{sp.correct}</b>
                    <span>
                      správně z {S.SPRINT_N}
                      {sp.luckless > 0 ? `, smůla ${sp.luckless}×` : ''}
                    </span>
                  </div>
                  <div className="sp-stat">
                    <b>{sp.best}</b>
                    <span>nejdelší série</span>
                  </div>
                  <div className="sp-stat">
                    <b className={cls(sp.me)}>{ptsText(sp.me)}</b>
                    <span>{duel ? `tvoje body, strýček ${ptsText(sp.un)}` : 'tvoje body'}</span>
                  </div>
                </div>
                {sp.redPair && (
                  <div className="sp-redtest">
                    <span className="sp-rt-title">Stejná barva, úplně jiná škoda</span>
                    <div className="sp-rt-row">
                      {sp.redPair.map((k) => {
                        const it = sp.items[k];
                        return (
                          <div key={k} className="sp-rt">
                            <span className="report-car">
                              <CarSvg color={it.color} />
                            </span>
                            <span>
                              <b>{S.BIN_NAMES[S.binOf(it.x)]}</b>
                              <br />
                              {S.fmtK(it.x)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
              );
            const it = curItem(sp);
            const fb = sp.fb;
            return (
              <>
                <div className="sp-head">
                  {sp.inTrial ? (
                    <span>
                      <b>Zkouška</b> nanečisto
                    </span>
                  ) : (
                    <span>
                      Hlášení <b>{sp.k + 1}</b> z {S.SPRINT_N}
                    </span>
                  )}
                  {sp.streak >= 2 && <span className="sp-streak">série ×{sp.streak}</span>}
                  <span className={`sp-score${sp.inTrial ? ' hide' : ''}`}>
                    ty <b>{sp.me}</b>
                    {duel && (
                      <>
                        {' '}
                        : <b className="u">{sp.un}</b> strýček
                      </>
                    )}
                  </span>
                </div>
                {sp.inTrial ? (
                  <div className="sp-timer off" aria-hidden="true" />
                ) : (
                  <div
                    className={`sp-clock${sp.phase === 'fb' ? ' stop' : ''}`}
                    key={sp.key}
                    style={{ ['--d' as string]: `${sp.limit}ms` }}
                    aria-hidden="true"
                  >
                    <div className="sp-timer seg">
                      <i />
                    </div>
                    <span className="sp-now">
                      <b className="n3">za 3 body</b>
                      <b className="n2">za 2 body</b>
                      <b className="n1">za 1 bod</b>
                    </span>
                  </div>
                )}
                <div key={`r${sp.key}`} className="sp-card">
                  <div className="sp-clues">
                    <div className="sp-clue">
                      <span>Kde</span>
                      <b>{it.sc.sPlace}</b>
                    </div>
                    <div className="sp-clue">
                      <span>Rychlost</span>
                      <b>{S.shortSpeed(it.sc.speed)}</b>
                    </div>
                    <div className="sp-clue">
                      <span>Co se stalo</span>
                      <b>{it.sc.sWhat}</b>
                    </div>
                    <div className="sp-clue">
                      <span>Zranění</span>
                      <b>{S.shortInjury(it.sc.injury)}</b>
                    </div>
                  </div>
                  <div className="sp-color">
                    <span className="report-car">
                      <CarSvg color={it.color} />
                    </span>
                    auto {(S.COLOR_NAMES[it.color] ?? 'jiná').replace(/á$/, 'é')}
                  </div>
                </div>
                {fb ? (
                  <div className={`sp-fb ${fb.ans === null ? 'late' : fb.ok ? 'good' : fb.luckless ? 'luck' : 'badfb'}`}>
                    <div className="sp-fb-main">
                      {fb.ans === null ? 'Čas vypršel. ' : fb.ok ? 'Správně! ' : fb.luckless ? 'Podle hlášení správně, tahle škoda ale vyšla jinak: ' : 'Vedle. '}
                      {fb.luckless ? S.BIN_NAMES[fb.truth].toLowerCase() : S.BIN_NAMES[fb.truth]}, {S.fmtK(fb.x)}
                      {!sp.inTrial && <span className={`sp-pts ${cls(fb.pts)}`}> {ptsText(fb.pts)}</span>}
                    </div>
                    {duel && fb.uAns !== null && fb.uPts !== null && (
                      <div className="sp-fb-u">
                        strýček: {S.BIN_NAMES[fb.uAns].toLowerCase()} {fb.uOk ? '✓' : fb.uLuckless ? '(smůla)' : '✗'}
                        {it.color === S.RED && fb.uAns !== it.sc.bin ? ' (červená!)' : ''}
                        <span className={`sp-pts ${cls(fb.uPts)}`}> {ptsText(fb.uPts)}</span>

                      </div>
                    )}
                  </div>
                ) : (
                  duel &&
                  !sp.inTrial && (
                    <div className={`sp-uncle${sp.uDone ? ' done' : ''}`}>
                      <Avatar />
                      <span>{sp.uDone ? 'Strýček má odpověď!' : 'Strýček čte hlášení…'}</span>
                    </div>
                  )
                )}
              </>
            );
          })()}
        </section>
      )}

      {has('bins') && (
        <section className="panel">
          <div className="bins">
            {[0, 1, 2].map((b) => (
              <div key={b} className="bin">
                <span className="bin-name">{S.BIN_NAMES[b]}</span>
                <span className="bin-range">{S.BIN_RANGES[b]}</span>
                {u.bins.mode !== 'show' && (
                  <span className="bin-diary">
                    v deníku {u.bins.diary[b]} z {sum(u.bins.diary)}
                    <br />
                    pojišťovny {S.POP_COUNT_PCT[b]} %
                  </span>
                )}
                <Waffle bin={b} tip={u.bins.mode === 'show' ? 0 : u.bins.tip[b]} act={u.bins.act[b]} flash={u.bins.flash === b} />
                <div className="bin-foot">
                  {u.bins.mode === 'show' && <span className="n">{u.bins.act[b]}</span>}
                  {u.bins.mode === 'alloc' && (
                    <div className="stepper">
                      <button
                        type="button"
                        className="st"
                        id={`m${b}`}
                        aria-label={`Ubrat: ${S.BIN_NAMES[b]}`}
                        disabled={u.bins.tip[b] === 0}
                        onClick={() => allocChange(b, -1)}
                      >
                        {'−'}
                      </button>
                      <b>{u.bins.tip[b]}</b>
                      <button
                        type="button"
                        className="st"
                        id={`p${b}`}
                        aria-label={`Přidat: ${S.BIN_NAMES[b]}`}
                        disabled={allocLeft() === 0}
                        onClick={() => allocChange(b, 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {u.bins.mode === 'run' && (
                    <div className="foot-run">
                      <span>
                        ty {u.bins.tip[b]}, <span className="fell">padlo <b>{u.bins.act[b]}</b></span>
                      </span>
                      {u.bins.uAlloc && <span className="u">strýček {u.bins.uAlloc[b]}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {sum(u.bins.money) > 0 && <ShareBars title={`Z tvých ${sum(u.bins.diary)} hlášení`} counts={u.bins.diary} money={u.bins.money} />}
          {u.bins.mode === 'alloc' && <p className="hint rule">Sedí 10 z 10: 3 body, 9: 2 body, 8: 1 bod.</p>}
          {u.kolo.length > 0 && (
            <div className="kolo-list">
              {u.kolo.map((k) => (
                <div key={k.r} className="kolo-row" id={`kolo-${k.r}`}>
                  <span className="res-year">Kolo {k.r}</span>
                  <Mix shares={k.act.map((v) => v / 10)} />
                  <span className="vv">
                    <span className={cls(k.pts)}>
                      ty {k.ov}/10 {ptsText(k.pts)}
                    </span>
                    {duel && k.uPts !== null && (
                      <span className={`u ${cls(k.uPts)}`}>
                        strýček {k.uOv}/10 {ptsText(k.uPts)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {has('lot') && (
        <div className="lot-wrap" ref={lotRef}>
          {yearEl}
          {u.step === 1 && cnt && !cnt.editing && gaugeEl}
          <div className={`lot${u.picking ? '' : ' locked'}`} role="group" aria-label="Parkoviště se stovkou aut">
            {u.colors.map((c, i) => {
              const picked = u.picks.includes(i);
              const up = u.uPicks.includes(i);
              const cr = u.crashed.includes(i);
              const cl = ['cell'];
              if (picked) cl.push('picked');
              if (up) cl.push('upicked');
              if (cr) cl.push('crashed');
              if (cr && picked) cl.push('hit');
              if (cr && up) cl.push('uhit');
              if (u.showMissed && picked && !cr) cl.push('missed');
              if (u.showMissed && up && !cr) cl.push('umissed');
              return (
                <button
                  key={i}
                  id={`car-${i + 1}`}
                  type="button"
                  className={cl.join(' ')}
                  aria-label={`Auto ${i + 1}`}
                  aria-pressed={picked}
                  onClick={() => togglePick(i)}
                >
                  <CarSvg color={c} />
                  <Burst />
                  <span className="ring" />
                  <span className="uring" />
                  <Clover />
                </button>
              );
            })}
          </div>
          {duel && u.uPicks.length > 0 && (
            <p className="lot-legend">
              <span className="lg me" /> tvoje auta <span className="lg u" /> strýčkova auta
            </p>
          )}
        </div>
      )}

      {has('fin') && (
        <section className="panel fin" ref={finRef}>
          <div className="fin-head">{u.fin.head}</div>
          {yearEl}
          <div className="big-wrap" ref={wrapRef}>
            <canvas ref={cvRef} aria-label="Deset parkovišť po stovce aut, nabouraná auta mají kroužek podle výše škody" />
          </div>
          <p className="fin-note">Žlutý rámeček je tvoje parkoviště. Kroužek ukazuje výši škody, dvojitý kroužek škodu nad 500 tis. Kč.</p>
          {cnt && cnt.phase === 'fin' && (
            <div className="fin-block">
              {cnt.editing && (
                <div className="data-note">
                  <b>Data pojišťoven z celé republiky:</b> v průměru 3,5 nehody na 100 aut za rok.
                  <br />
                  Na tvém parkovišti (100 aut) nabouralo: {u.log.join(', ')}.
                </div>
              )}
              {cnt.editing && cntEditor(cnt)}
              {gaugeEl}
              {!cnt.editing && (
                <div className="legend sev-legend">
                  <span>
                    <i className="sw b0" />
                    ťukanec
                  </span>
                  <span>
                    <i className="sw b1" />
                    bouračka
                  </span>
                  <span>
                    <i className="sw b2" />
                    velká bouračka
                  </span>
                </div>
              )}
              {cntRows(cnt)}
              {u.finShare && (
                <p className="hint fin-hint">
                  Úzké pásmo s tipem podle dat vyjde na tisíci autech asi 2 roky ze 3, na stovce aut jen asi 1 rok z 5.
                </p>
              )}
              {u.finShare && (
                <div className="fin-share" id="fin-share">
                  {g.diary && <ShareBars title={`Tvůj deník: ${sum(g.diary.counts)} hlášení`} counts={g.diary.counts} money={g.diary.money} />}
                  <ShareBars title={`1 000 aut za 3 roky: ${u.finShare.n} nehod`} counts={u.finShare.counts} money={u.finShare.money} />
                  <ShareBars title="Data pojišťoven" counts={S.POP_COUNT_PCT} money={S.POP_MONEY_PCT} />
                  <p className="share-explain">
                    Jedna velká nehoda byla v deníku schválně, proto v něm velké nehody obvykle stojí víc peněz. Na pár desítkách nehod podíl
                    pořád kolísá, ustálenou hodnotu ukazují až data pojišťoven.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {has('end') && u.end && (
        <section className="panel end">
          <h2>
            {!duel || u.end.winner === null
              ? 'Konec minihry'
              : u.end.winner === 'player'
                ? 'Vyhráváš!'
                : u.end.winner === 'uncle'
                  ? 'Tentokrát strýček'
                  : 'Remíza'}
          </h2>
          {duel && u.end.tieBreak && (
            <p className="tb">
              Na body remíza, rozhodla přesnost tipů {u.end.tieBreak === 'finale' ? 've finále' : u.end.tieBreak === 'f2' ? 'u stovky aut' : 'u výše škody'}.
            </p>
          )}
          <table className="sum-table">
            <thead>
              <tr>
                <th />
                <th>ty</th>
                {duel && <th>strýček</th>}
              </tr>
            </thead>
            <tbody>
              {u.end.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className={cls(r.me)}>{r.me}</td>
                  {duel && <td className="u">{r.uncle}</td>}
                </tr>
              ))}
              <tr className="tot">
                <td>Celkem</td>
                <td>{u.end.pts}</td>
                {duel && <td>{u.score.uncle}</td>}
              </tr>
            </tbody>
          </table>
          {u.clover > 0 && <p>Šťastná trefa ve fázi 1: čtyřlístek.</p>}
          {u.end.sent && (
            <p className="sent">
              {embedded ? 'Výsledek odeslán, hra pokračuje.' : 'Samostatný režim: výsledek by se teď poslal hlavní hře.'}
            </p>
          )}
        </section>
      )}

      {u.error && (
        <section className="panel end" role="alert">
          <h2>Něco se pokazilo</h2>
          <p>Minihra nemůže pokračovat. Hlavní hra o tom dostala zprávu.</p>
        </section>
      )}

      <div className="controls" ref={ctrlRef}>
        {duel && has('sev') && (
          <button
            type="button"
            id="card-liq"
            className={`card${u.liqCard === 'used' ? ' used' : canLiq() ? ' live' : ''}`}
            disabled={!canLiq()}
            onClick={act(useLiq)}
          >
            <span className="card-name">Karta Likvidátor</span>
            <span className="card-sub">
              {u.liqCard === 'used' ? 'použito' : 'zpřesní odhad u 1 hlášení, jen jednou, strýček ji nemá'}
            </span>
          </button>
        )}
        {onPreviewCfg && u.step === 0 && g.round === 0 && (
          <div className="preview-opts">
            <label className="demo">
              <input type="checkbox" id="demo" checked={cfg.demo} onChange={() => onPreviewCfg({ ...cfg, demo: !cfg.demo })} /> Pevná
              sekvence pro třídní demo
            </label>

          </div>
        )}
        {has('sprint') && u.sprint && (u.sprint.phase === 'live' || (u.sprint.phase === 'fb' && !u.sprint.inTrial)) && (
          <div className="bin-btns" role="group" aria-label="Zatřídit hlášení">
            {[0, 1, 2].map((b) => {
              const sp = u.sprint!;
              const fb = sp.fb;
              const c = ['bin-btn', `b${b}`];
              if (fb && fb.truth === b) c.push('right');
              if (fb && fb.ans === b && !fb.ok) c.push(fb.luckless ? 'luck' : 'wrong');
              return (
                <button key={b} type="button" id={`bin-${b}`} className={c.join(' ')} disabled={sp.phase !== 'live'} onClick={act(() => sprintAnswer(b))}>
                  <span className="bb-name">{S.BIN_NAMES[b]}</span>
                  <span className="bb-range">{S.BIN_RANGES[b]}</span>
                </button>
              );
            })}
          </div>
        )}
        {u.timer && <SoftTimer runKey={u.timer.key} dur={u.timer.dur} />}
        {u.buttons.map((b) => (
          <button key={b.id} id={b.id} type="button" className="btn" disabled={b.disabled} onClick={b.onClick}>
            {b.label}
          </button>
        ))}
      </div>
      <p className="note">
        Minihra 0_cafe_mini_uncertainty. Čísla vycházejí z dat povinného ručení pro osobní auta: řidiči způsobí ročně asi
        3,5 nehody na 100 aut, průměrná škoda 62 tis. Kč.
      </p>

      {u.toastKey > 0 && (
        <div key={u.toastKey} className={`toast ${u.toast.kind}`} role="status">
          {u.toast.text}
        </div>
      )}
    </div>
  );
}
