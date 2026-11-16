// Finále: 10 parkovišť po stovce aut (5 × 2), kreslené do canvasu.
// Všechny animace se řídí uplynulým časem, ne počtem snímků (120 Hz displeje běží stejně rychle).

import { XMAX } from './sim';

export interface Layout { W: number; H: number; c: number }
export interface Crash { i: number; x: number; t: number }

const PAD = 6;
const GAP = 7;

export const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const dpr = (): number => Math.min(window.devicePixelRatio || 1, 2);
const tok = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function finLayout(W: number): Layout {
  const c = (W - 2 * PAD - 4 * GAP) / 50;
  return { W, c, H: Math.round(2 * PAD + GAP + 20 * c) };
}

const blockXY = (b: number, L: Layout) => ({
  x: PAD + (b % 5) * (10 * L.c + GAP),
  y: PAD + Math.floor(b / 5) * (10 * L.c + GAP),
});

const carXY = (i: number, L: Layout) => {
  const o = blockXY(Math.floor(i / 100), L);
  const j = i % 100;
  return { x: o.x + (j % 10) * L.c, y: o.y + Math.floor(j / 10) * L.c };
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function setupCanvas(cv: HTMLCanvasElement, w: number, h: number) {
  const d = dpr();
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  cv.width = Math.round(w * d);
  cv.height = Math.round(h * d);
}

/** Nakreslí plochu. s = měřítko zoomu (1 = všech 10 parkovišť), now = čas od začátku roku v ms. */
export function drawFin(cv: HTMLCanvasElement, L: Layout, colors: string[], crashes: Crash[], now: number, s = 1) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const d = dpr();
  const c = L.c;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const o = PAD * (1 - s);
  ctx.setTransform(d * s, 0, 0, d * s, d * o, d * o);
  const asphalt = tok('--asphalt');
  const crash = tok('--crash');
  const mark = tok('--mark');
  const e = 2 / s;
  for (let b = 0; b < 10; b++) {
    const p = blockXY(b, L);
    ctx.fillStyle = asphalt;
    rr(ctx, p.x - e, p.y - e, 10 * c + 2 * e, 10 * c + 2 * e, 4 / s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1 / s;
    ctx.beginPath();
    for (let q = 1; q < 10; q++) {
      ctx.moveTo(p.x + q * c, p.y);
      ctx.lineTo(p.x + q * c, p.y + 10 * c);
    }
    ctx.stroke();
  }
  const detail = c * s >= 14;
  for (let i = 0; i < 1000; i++) {
    const p = carXY(i, L);
    ctx.fillStyle = colors[i];
    rr(ctx, p.x + c * 0.27, p.y + c * 0.08, c * 0.46, c * 0.84, c * 0.14);
    ctx.fill();
    if (detail) {
      ctx.fillStyle = '#22303d';
      ctx.fillRect(p.x + c * 0.33, p.y + c * 0.27, c * 0.34, c * 0.17);
      ctx.fillRect(p.x + c * 0.33, p.y + c * 0.7, c * 0.34, c * 0.1);
    }
  }
  const k = c / 9.5;
  for (const cr of crashes) {
    const age = now - cr.t;
    if (age < 0) continue;
    const t = Math.min(1, age / 320);
    const ease = 1 - Math.pow(1 - t, 3);
    const p = carXY(cr.i, L);
    const R = Math.max(0.6, (3 + 14 * Math.sqrt(Math.min(cr.x, XMAX) / XMAX)) * k * ease);
    ctx.beginPath();
    ctx.arc(p.x + c / 2, p.y + c / 2, R, 0, Math.PI * 2);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = crash;
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(0.7, 1.2 * k);
    ctx.strokeStyle = crash;
    ctx.stroke();
    if (cr.x > XMAX) {
      // Škoda nad 500 tis. Kč (vážné zranění): druhý, větší kruh.
      ctx.beginPath();
      ctx.arc(p.x + c / 2, p.y + c / 2, R * 1.6, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.9, 1.6 * k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    rr(ctx, p.x + c * 0.27, p.y + c * 0.08, c * 0.46, c * 0.84, c * 0.14);
    ctx.fill();
  }
  const p0 = blockXY(0, L);
  const m = 3.5 / s;
  ctx.strokeStyle = mark;
  ctx.lineWidth = 2.5 / s;
  rr(ctx, p0.x - m, p0.y - m, 10 * c + 2 * m, 10 * c + 2 * m, 5 / s);
  ctx.stroke();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ease3 = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Zoom z hráčova parkoviště na všech deset. Vrátí výsledné rozložení plochy. */
export async function zoomOut(cv: HTMLCanvasElement, wrap: HTMLElement, colors: string[], alive: () => boolean): Promise<Layout> {
  const W = Math.floor(wrap.clientWidth);
  const L = finLayout(W);
  const s0 = (W - 2 * PAD) / (10 * L.c);
  const Hs = Math.round(2 * PAD + 10 * L.c * s0);
  setupCanvas(cv, W, Hs);
  wrap.style.height = `${Hs}px`;
  drawFin(cv, L, colors, [], 0, s0);
  const reduced = reducedMotion();
  await sleep(reduced ? 50 : 300);
  const dur = reduced ? 1 : 1100;
  await new Promise<void>((res) => {
    const t0 = performance.now();
    const frame = (now: number) => {
      if (!alive()) return res();
      const t = Math.min(1, (now - t0) / dur);
      const e = ease3(t);
      wrap.style.height = `${Hs + (L.H - Hs) * e}px`;
      drawFin(cv, L, colors, [], 0, s0 + (1 - s0) * e);
      if (t < 1) requestAnimationFrame(frame);
      else res();
    };
    requestAnimationFrame(frame);
  });
  setupCanvas(cv, W, L.H);
  wrap.style.height = '';
  drawFin(cv, L, colors, [], 0, 1);
  return L;
}

/** Jeden rok: nehody se objevují v náhodných okamžicích. onCount dostane průběžný počet. */
export function animateYear(
  cv: HTMLCanvasElement,
  L: Layout,
  colors: string[],
  crashes: Crash[],
  dur: number,
  onCount: (n: number) => void,
  alive: () => boolean,
): Promise<void> {
  if (reducedMotion()) {
    crashes.forEach((c) => (c.t = 0));
    drawFin(cv, L, colors, crashes, Infinity);
    onCount(crashes.length);
    return sleep(300);
  }
  crashes.forEach((c) => (c.t = Math.random() * (dur - 450)));
  return new Promise((res) => {
    const t0 = performance.now();
    let shown = -1;
    const frame = (now: number) => {
      if (!alive()) return res();
      const el = now - t0;
      drawFin(cv, L, colors, crashes, el);
      const n = crashes.reduce((s, c) => s + (c.t <= el ? 1 : 0), 0);
      if (n !== shown) {
        shown = n;
        onCount(n);
      }
      if (el < dur) requestAnimationFrame(frame);
      else res();
    };
    requestAnimationFrame(frame);
  });
}
