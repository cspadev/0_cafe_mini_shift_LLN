// Drobné komponenty a grafika minihry.

import { MONTHS } from './game/sim';

const STAR = (() => {
  const p: string[] = [];
  for (let k = 0; k < 16; k++) {
    const r = k % 2 === 0 ? 11 : 5;
    const a = (Math.PI * 2 * k) / 16 - Math.PI / 2;
    p.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return p.join(' ');
})();

export function CarSvg({ color, className = 'car' }: { color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 34" aria-hidden="true">
      <rect x="0.6" y="5" width="2.6" height="6" rx="1" fill="#15181d" />
      <rect x="16.8" y="5" width="2.6" height="6" rx="1" fill="#15181d" />
      <rect x="0.6" y="23" width="2.6" height="6" rx="1" fill="#15181d" />
      <rect x="16.8" y="23" width="2.6" height="6" rx="1" fill="#15181d" />
      <rect x="2" y="1" width="16" height="32" rx="5.5" fill={color} stroke="rgba(0,0,0,.4)" strokeWidth=".8" />
      <rect x="4" y="9" width="12" height="6.5" rx="2" fill="#22303d" />
      <rect x="4.6" y="15.8" width="10.8" height="7.6" rx="1.5" fill="rgba(255,255,255,.16)" />
      <rect x="4.6" y="24" width="10.8" height="4" rx="1.5" fill="#22303d" />
      <rect x="3.6" y="1.8" width="3.4" height="1.6" rx=".8" fill="#fff6c2" />
      <rect x="13" y="1.8" width="3.4" height="1.6" rx=".8" fill="#fff6c2" />
    </svg>
  );
}

export function Burst({ className = 'burst' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={STAR} />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function Clover({ className = 'clv' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path className="clv-stem" d="M12 12 L19 22" strokeWidth="2.2" strokeLinecap="round" />
      <g className="clv-leaf">
        <circle cx="8" cy="8" r="4.6" />
        <circle cx="16" cy="8" r="4.6" />
        <circle cx="8" cy="16" r="4.6" />
        <circle cx="16" cy="16" r="4.6" />
      </g>
    </svg>
  );
}

export function Avatar() {
  return (
    <svg className="avatar" viewBox="0 0 48 48" aria-hidden="true">
      <circle className="av-bg" cx="24" cy="24" r="24" />
      <path d="M9 46c2-8 8-12.5 15-12.5S37 38 39 46z" fill="#3D6B8C" />
      <circle cx="24" cy="22" r="10" fill="#F0C5A2" />
      <path d="M14 20.5c0-7 4.6-10.5 10-10.5s10 3.5 10 10.5c-2-3.2-5-4.4-10-4.4s-8 1.2-10 4.4z" fill="#A2AAB3" />
      <circle cx="20" cy="22.5" r="3" fill="none" stroke="#2A2F36" strokeWidth="1.4" />
      <circle cx="28" cy="22.5" r="3" fill="none" stroke="#2A2F36" strokeWidth="1.4" />
      <path d="M23 22.5h2" stroke="#2A2F36" strokeWidth="1.4" />
      <path d="M19.5 28.3c1.5-1.3 3-1.5 4.5-.6 1.5-.9 3-.7 4.5.6-1.5.9-3 1-4.5.3-1.5.7-3 .6-4.5-.3z" fill="#7C858F" />
    </svg>
  );
}

/** Rok běží po měsících, vpravo živé počítadlo nehod. Animace je časová (CSS), ne po snímcích. */
export function YearBar({ label, count, running, dur, runKey }: { label: string; count: number; running: boolean; dur: number; runKey: number }) {
  return (
    <div className="yb">
      <div className="yb-top">
        <span className="yb-label">{label}</span>
        <span className="yb-count">
          Nehody: <b key={`${runKey}-${count}`} className="bump">{count}</b>
        </span>
      </div>
      <div className="yb-track">
        <div key={runKey} className={running ? 'yb-fill run' : 'yb-fill done'} style={{ animationDuration: `${dur}ms` }} />
      </div>
      <div className="yb-months" aria-hidden="true">
        {MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

export interface GaugeSpec {
  max: number;
  tip: number;
  /** Poloviční šířka pásma hráče v autech. */
  hw: number;
  uTip: number | null;
  uHw: number;
}

const ptsText = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

/** Počítadlo nehod míří k pásmu hráče (žluté) a strýčka (fialové, čárkované). */
export function Gauge({ g, count, done, pts }: { g: GaugeSpec; count: number; done: boolean; pts: { me: number; uncle: number | null } | null }) {
  const clamp = (v: number) => Math.min(Math.max(v, 0), g.max);
  const pct = (v: number) => `${(clamp(v) / g.max) * 100}%`;
  const width = (a: number, b: number) => `${((clamp(b) - clamp(a)) / g.max) * 100}%`;
  const meIn = done && Math.abs(count - g.tip) <= g.hw;
  return (
    <div className="gauge">
      <div className="g-track">
        <div
          className={`g-band me${done ? (meIn ? ' in' : ' out') : ''}`}
          style={{ left: pct(g.tip - g.hw - 0.5), width: width(g.tip - g.hw - 0.5, g.tip + g.hw + 0.5) }}
        />
        {g.uTip !== null && (
          <div className="g-band u" style={{ left: pct(g.uTip - g.uHw - 0.5), width: width(g.uTip - g.uHw - 0.5, g.uTip + g.uHw + 0.5) }} />
        )}
        <div className={`g-fill${done ? ' done' : ''}`} style={{ width: pct(count) }} />
        <div className="g-mark me" style={{ left: pct(g.tip) }}>
          <span>ty {g.tip}</span>
        </div>
        {g.uTip !== null && (
          <div className="g-mark u" style={{ left: pct(g.uTip) }}>
            <span>strýček {g.uTip}</span>
          </div>
        )}
      </div>
      <div className="g-scale" aria-hidden="true">
        <span>0</span>
        <span>{g.max / 2}</span>
        <span>{g.max}</span>
      </div>
      {done && pts && (
        <div className="g-verdict">
          <span className={pts.me > 0 ? 'ok' : pts.me < 0 ? 'bad' : ''}>ty {ptsText(pts.me)}</span>
          {pts.uncle !== null && <span className={pts.uncle > 0 ? 'ok u' : pts.uncle < 0 ? 'bad u' : 'u'}>strýček {ptsText(pts.uncle)}</span>}
        </div>
      )}
    </div>
  );
}

/** Volba šířky pásma: užší pásmo dá víc bodů, ale snáz se mine. */
export function BandPicker({
  bands,
  band,
  ranges,
  onBand,
}: {
  bands: { name: string; win: number; miss: number }[];
  band: number | null;
  ranges: (string | null)[];
  onBand: (b: number) => void;
}) {
  return (
    <div className="bands" role="radiogroup" aria-label="Šířka pásma">
      {bands.map((b, i) => (
        <button
          key={b.name}
          type="button"
          id={`band-${i}`}
          role="radio"
          aria-checked={band === i}
          className={`band-btn${band === i ? ' on' : ''}`}
          onClick={() => onBand(i)}
        >
          <span className="band-name">{b.name}</span>
          <span className="band-pts">
            <b className="ok">+{b.win}</b> / <b className={b.miss < 0 ? 'bad' : ''}>{ptsText(b.miss)}</b>
          </span>
          <span className="band-range">{ranges[i] ?? 'nejdřív tip'}</span>
        </button>
      ))}
    </div>
  );
}

/** Měkký časovač: tenký pruh se zkracuje, po uplynutí se rok spustí sám. */
export function SoftTimer({ runKey, dur }: { runKey: number; dur: number }) {
  return (
    <div className="soft" aria-hidden="true" style={{ ['--d' as string]: `${dur}ms` }}>
      <i key={runKey} />
    </div>
  );
}

/** Pásma bodů kolem tipu výše škody na logaritmické ose posuvníku (3, 2 a 1 bod). */
export function SevBands({ tip, pos, tiers }: { tip: number; pos: (x: number) => number; tiers: [number, number, number] }) {
  const c = (v: number) => Math.min(1, Math.max(0, v)) * 100;
  return (
    <div className="sevbands" aria-hidden="true">
      {[2, 1, 0].map((t) => {
        const a = c(pos(tip / tiers[t]));
        const b = c(pos(tip * tiers[t]));
        return <span key={t} className={`sb t${t}`} style={{ left: `${a}%`, width: `${b - a}%` }} />;
      })}
    </div>
  );
}

/** Přihrádka: obrys = tip, výplň = skutečnost. */
export function Waffle({ bin, tip, act, flash }: { bin: number; tip: number; act: number; flash: boolean }) {
  const n = Math.max(tip, act);
  const sq = [];
  for (let j = 0; j < n; j++) {
    const cls = ['sq'];
    if (j < act) cls.push('fill', `b${bin}`);
    if (j < tip) cls.push('tip');
    if (flash && j === act - 1) cls.push('new');
    sq.push(<i key={`${j}-${j === act - 1 && flash ? act : 0}`} className={cls.join(' ')} />);
  }
  return <div className="waffle">{sq}</div>;
}

/** Podíl přihrádek na počtu nehod a na penězích (těžký chvost: málo velkých škod, hodně peněz). */
export function ShareBars({ counts, money, title }: { counts: number[]; money: number[]; title?: string }) {
  const rows: [string, number[]][] = [
    ['Počet nehod', counts],
    ['Peníze', money],
  ];
  const big = (v: number[]) => Math.round((100 * v[2]) / Math.max(1, v[0] + v[1] + v[2]));
  return (
    <div className="share" aria-label={`${title ? `${title}: ` : ''}podíl přihrádek na počtu nehod a na penězích`}>
      {title && <span className="share-title">{title}</span>}
      {rows.map(([label, v]) => {
        const tot = v.reduce((a, b) => a + b, 0) || 1;
        const pct = v.map((x) => (100 * x) / tot);
        return (
          <div key={label} className="share-row">
            <span className="share-label">{label}</span>
            <div className="share-bar">
              {pct.map((p, b) =>
                p > 0 ? (
                  <span key={b} className={`b${b}`} style={{ width: `${p.toFixed(1)}%` }}>
                    {p >= 14 ? `${Math.round(p)} %` : ''}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        );
      })}
      <span className="share-note">
        Velké bouračky: <b>{big(counts)} %</b> nehod, <b>{big(money)} %</b> peněz
      </span>
    </div>
  );
}

export function Mix({ shares }: { shares: number[] }) {
  return (
    <div className="mix">
      {shares.map((s, b) => (
        <span key={b} className={`b${b}`} style={{ width: `${(s * 100).toFixed(1)}%` }} />
      ))}
    </div>
  );
}
