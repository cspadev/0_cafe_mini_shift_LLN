import { useEffect, useReducer, useRef, useState } from 'react';
import { fail, finish, startMinihra } from './minihra-protokol';
import { type Config, parseConfig } from './game/config';
import * as S from './game/sim';
import { Crowd, PALETTE_N, reducedMotion } from './game/crowd';
import { Avatar, BandPicker, Funnel, TipScale, YearBar, ptsText } from './ui';

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
  return <Game key={gen} cfg={cfg} onRestart={() => setGen((g) => g + 1)} />;
}

/* ---------- typy ---------- */

interface Btn { id: string; label: string; onClick: () => void; disabled?: boolean }
interface YearState { key: number; dur: number; running: boolean; count: number; label: string }
interface YearRow { y: number; n: number; pts: number; uPts: number | null; hit: boolean; uHit: boolean }
interface Group { band: number | null; started: boolean; done: boolean; rows: YearRow[]; last: Int32Array | null }
type Phase = 'intro' | 'choose' | 'run' | 'done' | 'end';

interface UI {
  say: string;
  sayKey: number;
  task: { main: string; meta: string; result: boolean } | null;
  buttons: Btn[];
  toast: { text: string; kind: 'plus' | 'big' | 'minus' | 'info' };
  toastKey: number;
  score: { me: number; uncle: number };
  /** Poloha posuvníku (index skupiny). */
  view: number;
  /** Nejvyšší poloha, kam už posuvník smí. */
  unlocked: number;
  phase: Phase;
  groups: Group[];
  year: YearState | null;
  live: number | null;
  end: { sent: boolean; winner: 'player' | 'uncle' | 'tie' | null; score: number; best: number; againReady: boolean } | null;
  error: string | null;
}

interface GroupRes {
  cars: number;
  tip: number;
  band: string;
  bestBand: string;
  rounds: { crashes: number; points: number; unclePoints: number | null }[];
  uncleBand: string | null;
}

interface GameData {
  sim: S.Sim;
  cos: S.Sim;
  colors: (Uint8Array | null)[];
  yearKey: number;
  t0: number;
  res: GroupRes[];
}


const initialGame = (cfg: Config): GameData => {
  const s = cfg.seed;
  return {
    sim: new S.Sim(s !== null ? S.mulberry32(s) : Math.random),
    cos: new S.Sim(s !== null ? S.mulberry32((s * 7919 + 13) | 0) : Math.random),
    colors: S.GROUPS.map(() => null),
    yearKey: 0,
    t0: performance.now(),
    res: [],
  };
};

const initialUI = (): UI => ({
  say: '',
  sayKey: 0,
  task: null,
  buttons: [],
  toast: { text: '', kind: 'info' },
  toastKey: 0,
  score: { me: 0, uncle: 0 },
  view: 0,
  unlocked: 0,
  phase: 'intro',
  groups: S.GROUPS.map(() => ({ band: null, started: false, done: false, rows: [], last: null })),
  year: null,
  live: null,
  end: null,
  error: null,
});

class Aborted extends Error {}

const YEAR_MS = [1400, 1500, 1700, 1900];
/** Horní konec stupnice: u 10 aut 5 nehod, jinak dvojnásobek tipu. */
const scaleMax = (g: number) => (g === 0 ? 5 : 2 * S.tipOf(S.GROUPS[g]));
const LABELS = S.GROUPS.map((n) => S.fmtInt(n));

const INTRO = 'Pojišťovna očekává, že nabourá zhruba každé desáté auto. Táhni posuvníkem a přidávej auta. Dívej se, jak se skutečnost blíží tipu.';

/* ---------- hra ---------- */

function Game({ cfg, onRestart }: { cfg: Config; onRestart: () => void }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const G = useRef<GameData | null>(null);
  const g = (G.current ??= initialGame(cfg));
  const U = useRef<UI | null>(null);
  const u = (U.current ??= initialUI());
  const alive = useRef(true);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const crowdRef = useRef<Crowd | null>(null);
  const panelRef = useRef<HTMLElement>(null);
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
  const setButtons = (...b: Btn[]) => {
    u.buttons = b;
    force();
  };
  const enable = (id: string, on: boolean) => {
    u.buttons = u.buttons.map((b) => (b.id === id ? { ...b, disabled: !on } : b));
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
    const t = `${S.signed(me)} ${S.pointsWord(me)}`;
    toast(bigText && me >= 4 ? `${bigText} ${t}` : t, me >= 4 ? 'big' : me > 0 ? 'plus' : me < 0 ? 'minus' : 'info');
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

  const colorsFor = (gi: number): Uint8Array => (g.colors[gi] ??= g.cos.colors(S.GROUPS[gi], PALETTE_N));

  async function showGroup(gi: number, animate: boolean) {
    const cr = crowdRef.current;
    if (!cr) throw new Error('Plocha s auty se nenačetla.');
    await cr.show(S.GROUPS[gi], colorsFor(gi), u.groups[gi].last, () => alive.current, animate);
    if (!alive.current) throw new Aborted();
  }

  /* ----- úvod ----- */
  function intro() {
    u.phase = 'intro';
    u.view = 0;
    say(INTRO);
    task('Skupina 10 aut', 'Posuvníkem pak přidáš další auta');
    setButtons({ id: 'b-start', label: 'Jdu na to', onClick: act(() => enterGroup(0)) });
  }

  /* ----- skupina: volba pásma ----- */
  const nextButton = () => {
    const done = u.groups.filter((x) => x.done).length;
    if (done >= S.GROUPS.length) return { id: 'b-end', label: 'Souhrn', onClick: act(endScreen) };
    return { id: 'b-more', label: `Přidat auta: ${S.fmtInt(S.GROUPS[done])}`, onClick: act(() => enterGroup(done)) };
  };

  async function enterGroup(gi: number) {
    if (u.phase === 'run' || u.phase === 'end') return;
    const prev = u.view;
    u.view = gi;
    u.phase = 'choose';
    u.year = null;
    u.live = null;
    const n = S.GROUPS[gi];
    const tip = S.tipOf(n);
    task(`${S.fmtInt(n)} aut: pojišťovna čeká ${S.fmtInt(tip)} ${S.crashAcc(tip)} v každém kole`, 'Jak moc tipu věříš? Zvol pásmo');
    if (gi === 0 && u.groups[0].band === null) say('Tip je daný, každé desáté auto. Otázka je, jak moc mu věřit. Úzké pásmo dá víc bodů, ale snáz mineš.');
    setButtons({ id: 'b-run', label: 'Spustit 3 kola', onClick: act(runGroup), disabled: u.groups[gi].band === null });
    force();
    await showGroup(gi, prev !== gi);
    reveal(() => panelRef.current);
  }

  function onBand(b: number) {
    if (u.phase !== 'choose') return;
    u.groups[u.view].band = b;
    enable('b-run', true);
  }

  /* ----- skupina: tři kola ----- */
  async function runGroup() {
    const gi = u.view;
    const grp = u.groups[gi];
    if (u.phase !== 'choose' || grp.band === null || grp.started) return;
    u.phase = 'run';
    grp.started = true;
    lock();
    const band = grp.band;
    const n = S.GROUPS[gi];
    const tip = S.tipOf(n);
    const uBand = duel ? S.UNCLE_BANDS[gi] : null;
    if (duel && gi === 0) say('Já beru střední, pro jistotu.');
    if (duel && gi === S.GROUPS.length - 1) say('Tady už si věřím, beru úzké.');
    reveal(() => panelRef.current);
    for (let y = 0; y < S.ROUNDS; y++) {
      const k = g.sim.binom(n, S.P);
      const idx = g.sim.sampleK(n, k);
      const yr: YearState = { key: ++g.yearKey, dur: YEAR_MS[gi], running: true, count: 0, label: `Kolo ${y + 1} ze ${S.ROUNDS}` };
      u.year = yr;
      u.live = 0;
      task(`${S.fmtInt(n)} aut`, 'Kolo běží…');
      const cr = crowdRef.current;
      if (!cr) throw new Error('Plocha s auty se nenačetla.');
      await cr.runYear(idx, YEAR_MS[gi], () => g.cos.uniform(), (c) => {
        yr.count = c;
        u.live = c;
        force();
      }, () => alive.current);
      if (!alive.current) throw new Aborted();
      yr.running = false;
      yr.count = k;
      grp.last = idx;
      const pts = S.bandPoints(band, tip, k);
      const uPts = uBand !== null ? S.bandPoints(uBand, tip, k) : null;
      grp.rows = [...grp.rows, { y: y + 1, n: k, pts, uPts, hit: S.bandHit(band, tip, k), uHit: uBand !== null && S.bandHit(uBand, tip, k) }];
      u.live = null;
      task(`${S.fmtInt(k)} ${S.crashWord(k)}`, `odchylka od tipu ${S.devText(S.devPct(k, tip))}`, true);
      addPoints(pts, uPts ?? 0, band === 0 ? 'Úzké sedí!' : undefined);
      await wait(y < S.ROUNDS - 1 ? 900 : 700);
    }
    grp.done = true;
    u.phase = 'done';
    u.unlocked = Math.min(S.GROUPS.length - 1, gi + 1);
    g.res[gi] = {
      cars: n,
      tip,
      band: S.BANDS[band].id,
      bestBand: S.BANDS[S.bestBand(gi)].id,
      rounds: grp.rows.map((r) => ({ crashes: r.n, points: r.pts, unclePoints: r.uPts })),
      uncleBand: uBand !== null ? S.BANDS[uBand].id : null,
    };
    const ns = grp.rows.map((r) => r.n);
    const maxDev = Math.max(...ns.map((v) => Math.abs(S.devPct(v, tip))));
    if (gi === 0) {
      say(
        maxDev >= 50
          ? `${S.verdictLine(maxDev)} Vyšlo ${S.listText(ns)}, tip byl 1. U tak malé skupiny to lítá nahoru dolů a nic z toho nepředvídáš.`
          : `Tentokrát to sedělo (${S.listText(ns)}). Ale u tak malé skupiny to jindy lítá nahoru dolů, jedna nehoda navíc je hned dvojnásobek.`,
      );
    } else {
      say(`${S.verdictLine(maxDev)} Odchylka nejvýš ${S.absDevText(maxDev)}.`);
    }
    task(`${S.fmtInt(n)} aut: ${S.listText(ns)}`, `největší odchylka ${S.absDevText(maxDev)}`, true);
    setButtons(nextButton());
  }

  /* ----- posuvník ----- */
  function onSlide(v: number) {
    if (u.phase === 'run' || u.phase === 'end') return;
    const target = Math.min(v, u.unlocked);
    if (v > u.unlocked) toast('Nejdřív dokonči tuhle skupinu');
    if (target === u.view && u.phase !== 'intro') {
      force();
      return;
    }
    if (u.groups[target].done) act(() => reviewGroup(target))();
    else act(() => enterGroup(target))();
  }

  /** Návrat k hotové skupině: auta z posledního kola a výsledky všech tří kol. */
  async function reviewGroup(gi: number) {
    const prev = u.view;
    u.view = gi;
    u.phase = 'done';
    u.year = null;
    u.live = null;
    const n = S.GROUPS[gi];
    const tip = S.tipOf(n);
    const ns = u.groups[gi].rows.map((r) => r.n);
    const maxDev = Math.max(...ns.map((v) => Math.abs(S.devPct(v, tip))));
    task(`${S.fmtInt(n)} aut: ${S.listText(ns)}`, `největší odchylka ${S.absDevText(maxDev)}`, true);
    setButtons(nextButton());
    await showGroup(gi, prev !== gi);
  }

  /* ----- konec ----- */
  function endScreen() {
    u.phase = 'end';
    u.year = null;
    u.live = null;
    const me = u.score.me;
    const un = u.score.uncle;
    const winner = duel ? (me > un ? 'player' : me < un ? 'uncle' : 'tie') : null;
    const bands = u.groups.map((x) => x.band ?? 1);
    const score = S.choiceScore(bands);
    const best = bands.filter((b, i) => b === S.bestBand(i)).length;
    u.end = { sent: false, winner, score, best, againReady: false };
    const ns = u.groups[0].rows.map((r) => r.n);
    const mx = Math.max(...ns);
    const mn = Math.min(...ns);
    const amount = (v: number) => (v === 0 ? 'nulu' : `${v} ${S.claimsAcc(v)}`);
    const part = mx - mn >= 2 ? `jednou máš ${amount(mx)}, jindy ${amount(mn)}` : 'jednou máš třeba tři škody, jindy nulu';
    say(
      `Vidíš to? U deseti aut je tip k ničemu, ${part}. U deseti tisíc sedí skoro přesně pokaždé. Proto chce pojišťovna klientů co nejvíc, u velké skupiny se skoro nesplete.`,
    );
    task('');
    window.scrollTo({ top: 0 });
    setButtons({ id: 'b-continue', label: 'Pokračovat', onClick: act(sendFinish) });
  }

  async function sendFinish() {
    if (!u.end || u.end.sent) return;
    u.end.sent = true;
    const rate = u.end.score;
    (preview ? (rr: number, p: unknown) => console.info('[minihra] náhled, FINISH:', rr, p) : finish)(rate, {
      version: 1,
      choiceScore: Math.round(rate * 1000) / 1000,
      bestBands: u.end.best,
      skillPoints: { points: u.score.me, max: S.MAX_POINTS },
      duel: duel ? { player: u.score.me, uncle: u.score.uncle, winner: u.end.winner } : null,
      groups: g.res,
      decisions: g.res.length,
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

  /* ----- spuštění ----- */
  useEffect(() => {
    alive.current = true;
    const cv = cvRef.current;
    if (cv) crowdRef.current = new Crowd(cv);
    intro();
    act(() => showGroup(0, false))();
    let h: number | null = null;
    const onResize = () => {
      if (h !== null) window.clearTimeout(h);
      h = window.setTimeout(() => {
        const ui = U.current;
        if (ui && ui.phase !== 'run') crowdRef.current?.redraw(ui.groups[ui.view].last);
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      alive.current = false;
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- vykreslení ----- */
  const cls = (p: number) => (p > 0 ? 'ok' : p < 0 ? 'bad' : '');
  const gi = u.view;
  const grp = u.groups[gi];
  const n = S.GROUPS[gi];
  const tip = S.tipOf(n);
  const showUncleBand = duel && grp.started;
  const ranges = S.BANDS.map((_, b) => S.rangeText(...S.bandRange(b, tip)));

  return (
    <div className="app">
      <header className="hud">
        <div>
          <h1>Náhoda v davu mizí</h1>
          <p className="sub">Zastávka MHD</p>
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
        </div>
      </header>

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

      <section className={`panel crowd${u.phase === 'end' ? ' hidden' : ''}`} ref={panelRef}>
        <div className="ln-slider">
          <div className="ln-head">
            <span>Počet aut</span>
            <b>{S.fmtInt(n)}</b>
          </div>
          <input
            type="range"
            id="cars"
            className="ln-range"
            min={0}
            max={S.GROUPS.length - 1}
            step={1}
            value={gi}
            disabled={u.phase === 'run' || u.phase === 'end'}
            aria-label="Počet aut"
            aria-valuetext={`${S.fmtInt(n)} aut`}
            onChange={(e) => onSlide(Number(e.target.value))}
            style={{ ['--unl' as string]: `${(u.unlocked / (S.GROUPS.length - 1)) * 100}%` }}
          />
          <div className="ln-stops">
            {LABELS.map((l, i) => (
              <button
                key={l}
                type="button"
                id={`stop-${i}`}
                className={`ln-stop${i === gi ? ' on' : ''}${u.groups[i].done ? ' done' : ''}`}
                disabled={i > u.unlocked || u.phase === 'run' || u.phase === 'end'}
                onClick={() => onSlide(i)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="crowd-wrap">
          <canvas ref={cvRef} aria-label={`Skupina ${S.fmtInt(n)} aut, nabouraná auta jsou označená`} />
        </div>
        {u.year && <YearBar label={u.year.label} count={u.year.count} running={u.year.running} dur={u.year.dur} runKey={u.year.key} />}
        {u.phase !== 'intro' && (
          <TipScale
            tip={tip}
            max={scaleMax(gi)}
            band={grp.band !== null ? S.bandRange(grp.band, tip) : null}
            uBand={showUncleBand ? S.bandRange(S.UNCLE_BANDS[gi], tip) : null}
            years={grp.rows.map((r) => r.n)}
            hits={grp.rows.map((r) => r.hit)}
            live={u.live}
          />
        )}
        {u.phase === 'choose' && (
          <>
            <BandPicker bands={S.BANDS} band={grp.band} ranges={ranges} onBand={onBand} />
            <p className="hint rule">Pásmo platí pro všechna 3 kola. V pásmu body získáš, mimo úzké a střední pásmo bod ztratíš.</p>
          </>
        )}
        {grp.rows.length > 0 && (
          <div className="rows">
            {grp.rows.map((r) => (
              <div key={r.y} className="cnt-row">
                <div className="fin-top">
                  <span>
                    Kolo {r.y}: <b>{S.fmtInt(r.n)}</b> {S.crashWord(r.n)}
                  </span>
                  <span className="vv">
                    <span className={cls(r.pts)}>ty {ptsText(r.pts)}</span>
                    {duel && r.uPts !== null && <span className={`u ${cls(r.uPts)}`}>strýček {ptsText(r.uPts)}</span>}
                  </span>
                </div>
                <div className="cnt-sub">odchylka od tipu {S.devText(S.devPct(r.n, tip))}</div>
              </div>
            ))}
            <div className="cnt-sub band-sum">
              pásmo ty: {grp.band !== null ? S.BANDS[grp.band].name.toLowerCase() : ''}
              {showUncleBand && <span className="u"> · strýček: {S.BANDS[S.UNCLE_BANDS[gi]].name.toLowerCase()}</span>}
            </div>
          </div>
        )}
      </section>

      {u.phase === 'end' && u.end && (
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
          <table className="sum-table">
            <thead>
              <tr>
                <th />
                <th className="yrs">nehody</th>
                <th>ty</th>
                {duel && <th>strýček</th>}
              </tr>
            </thead>
            <tbody>
              {u.groups.map((x, i) => {
                const me = x.rows.reduce((s, r) => s + r.pts, 0);
                const un = x.rows.reduce((s, r) => s + (r.uPts ?? 0), 0);
                return (
                  <tr key={i}>
                    <td>{LABELS[i]} aut</td>
                    <td className="yrs">{x.rows.map((r) => S.fmtInt(r.n)).join(', ')}</td>
                    <td className={cls(me)}>{me}</td>
                    {duel && <td className="u">{un}</td>}
                  </tr>
                );
              })}
              <tr className="tot">
                <td>Celkem</td>
                <td />
                <td>{u.score.me}</td>
                {duel && <td>{u.score.uncle}</td>}
              </tr>
            </tbody>
          </table>
          <h3 className="fn-title">Odchylka skutečnosti od tipu</h3>
          <Funnel rows={u.groups.map((x, i) => ({ label: `${LABELS[i]} aut`, devs: x.rows.map((r) => S.devPct(r.n, S.tipOf(S.GROUPS[i]))) }))} />
          <p className="fn-note">
            Nejvýhodnější pásmo: {u.end.best} ze {S.GROUPS.length} skupin. U malých skupin se vyplatí střední, od tisíce aut úzké.
          </p>
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
        {u.buttons.map((b) => (
          <button key={b.id} id={b.id} type="button" className="btn" disabled={b.disabled} onClick={b.onClick}>
            {b.label}
          </button>
        ))}
      </div>
      <p className="note">
        Minihra 0_cafe_mini_shift_LLN. Pro jednoduchost tu pojišťovna čeká nehodu u každého desátého auta, v povinném ručení
        připadá asi 3,5 nehody na 100 aut.
      </p>

      {u.toastKey > 0 && (
        <div key={u.toastKey} className={`toast ${u.toast.kind}`} role="status">
          {u.toast.text}
        </div>
      )}
    </div>
  );
}
