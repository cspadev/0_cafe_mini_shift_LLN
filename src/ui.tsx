// Drobné komponenty minihry Náhoda v davu mizí.

import { fmtInt } from './game/sim';

export const ptsText = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

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

export function YearBar({ label, count, running, dur, runKey }: { label: string; count: number; running: boolean; dur: number; runKey: number }) {
  return (
    <div className="yb">
      <div className="yb-top">
        <span className="yb-label">{label}</span>
        <span className="yb-count">
          Nehody: <b key={`${runKey}-${count}`} className="bump">{fmtInt(count)}</b>
        </span>
      </div>
      <div className="yb-track">
        <div key={runKey} className={running ? 'yb-fill run' : 'yb-fill done'} style={{ animationDuration: `${dur}ms` }} />
      </div>
    </div>
  );
}

export function BandPicker({
  bands,
  band,
  ranges,
  onBand,
  disabled,
}: {
  bands: { name: string; win: number; miss: number }[];
  band: number | null;
  ranges: string[];
  onBand: (b: number) => void;
  disabled?: boolean;
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
          disabled={disabled}
          onClick={() => onBand(i)}
        >
          <span className="band-name">{b.name}</span>
          <span className="band-pts">
            <b className="ok">+{b.win}</b> / <b className={b.miss < 0 ? 'bad' : ''}>{ptsText(b.miss)}</b>
          </span>
          <span className="band-range">{ranges[i]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Stupnice kolem tipu pojišťovny: pásmo hráče (žluté), strýčka (fialové čárkované), výsledky kol (tečky)
 * a průběžný počet během kola.
 */
export function TipScale({
  tip,
  max,
  band,
  uBand,
  years,
  live,
  hits,
}: {
  tip: number;
  max: number;
  band: [number, number] | null;
  uBand: [number, number] | null;
  years: number[];
  live: number | null;
  hits: boolean[];
}) {
  const half = max <= 20 ? 0.5 : 0;
  const pos = (v: number) => (Math.min(Math.max(v, 0), max) / max) * 100;
  const span = (r: [number, number]) => ({ left: `${pos(r[0] - half)}%`, width: `${pos(r[1] + half) - pos(r[0] - half)}%` });
  return (
    <div className="ts" aria-hidden="true">
      <div className="ts-track">
        {band && <div className="ts-band me" style={span(band)} />}
        {uBand && <div className="ts-band u" style={span(uBand)} />}
        {live !== null && <div className="ts-fill" style={{ width: `${pos(live)}%` }} />}
        <div className="ts-tip" style={{ left: `${pos(tip)}%` }}>
          <span>tip {fmtInt(tip)}</span>
        </div>
        {years.map((v, i) => (
          <div key={i} className={`ts-dot y${i}${hits[i] ? ' in' : ' out'}${v > max ? ' over' : ''}`} style={{ left: `${pos(v)}%` }}>
            <span>{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="ts-scale">
        <span>0</span>
        <span>{fmtInt(Math.round(max / 2))}</span>
        <span>{fmtInt(max)}</span>
      </div>
    </div>
  );
}

/** Trychtýř: odchylky skutečnosti od tipu (v %) pro všechny skupiny a kola. */
export function Funnel({ rows }: { rows: { label: string; devs: number[] }[] }) {
  const x0 = 74;
  const x1 = 312;
  const lo = -100;
  const hi = 200;
  const X = (d: number) => x0 + ((Math.min(Math.max(d, lo), hi) - lo) / (hi - lo)) * (x1 - x0);
  const rowH = 34;
  const top = 18;
  const H = top + rows.length * rowH + 22;
  return (
    <svg className="funnel" viewBox={`0 0 320 ${H}`} role="img" aria-label="Odchylka skutečnosti od tipu podle velikosti skupiny">
      <rect className="fn-zone" x={X(-15)} y={top - 6} width={X(15) - X(-15)} height={rows.length * rowH} rx="4" />
      <line className="fn-zero" x1={X(0)} x2={X(0)} y1={top - 8} y2={top + rows.length * rowH - 4} />
      <text className="fn-lbl" x={X(0)} y={10} textAnchor="middle">
        tip
      </text>
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2 - 4;
        return (
          <g key={r.label}>
            <line className="fn-row" x1={x0} x2={x1} y1={y} y2={y} />
            <text className="fn-name" x={x0 - 8} y={y + 4} textAnchor="end">
              {r.label}
            </text>
            {r.devs.map((d, k) => (
              <circle key={k} className={`fn-dot y${k}`} cx={X(d)} cy={y} r="6" />
            ))}
          </g>
        );
      })}
      {[-100, 0, 100, 200].map((d) => (
        <text key={d} className="fn-axis" x={X(d)} y={H - 4} textAnchor="middle">
          {d > 0 ? `+${d} %` : d < 0 ? `−${-d} %` : '0 %'}
        </text>
      ))}
    </svg>
  );
}
