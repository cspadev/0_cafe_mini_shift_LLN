// Kreslení davu aut na canvas: skupina 10 až 10 000 aut, nehody se objevují v průběhu kola.
// Animace se řídí časem (performance.now), ne počtem snímků, takže na 120 Hz displeji běží stejně rychle.

export const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Barvy aut (bez červené, aby nehody byly vidět i u nejmenších teček). */
const PALETTE = ['#3A74D6', '#F4F3EF', '#2E3238', '#A3ADB8', '#3E9C8F'];
export const PALETTE_N = PALETTE.length;

/** Poměr výšky plochy k šířce. */
export const ASPECT = 0.62;

interface Layout {
  n: number;
  cols: number;
  rows: number;
  cell: number;
  ox: number;
  oy: number;
  W: number;
  H: number;
}

const dpr = (): number => Math.min(window.devicePixelRatio || 1, 2);

/** Mřížka co nejvíc vyplní plochu: počet sloupců podle poměru stran. */
export function layoutFor(n: number, W: number, H: number): Layout {
  const cols = Math.ceil(Math.sqrt((n * W) / H));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(W / cols, H / rows);
  return { n, cols, rows, cell, ox: (W - cols * cell) / 2, oy: (H - rows * cell) / 2, W, H };
}

const css = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const r = k % 2 === 0 ? ro : ri;
    const a = (Math.PI * 2 * k) / 16 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export class Crowd {
  private base: HTMLCanvasElement;
  private L: Layout | null = null;
  private colors: Uint8Array | null = null;

  constructor(private cv: HTMLCanvasElement) {
    this.base = document.createElement('canvas');
  }

  /** Nastaví velikost plochy podle šířky rodiče. */
  private size(): { W: number; H: number } {
    const W = Math.max(240, Math.round(this.cv.parentElement?.clientWidth ?? 320));
    const H = Math.round(W * ASPECT);
    const d = dpr();
    for (const c of [this.cv, this.base]) {
      c.width = Math.round(W * d);
      c.height = Math.round(H * d);
    }
    this.cv.style.width = `${W}px`;
    this.cv.style.height = `${H}px`;
    return { W, H };
  }

  private drawBase() {
    const L = this.L;
    const col = this.colors;
    if (!L || !col) return;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    ctx.fillStyle = css('--asphalt', '#3A414B');
    roundRect(ctx, 0, 0, L.W, L.H, 14);
    ctx.fill();
    const c = L.cell;
    for (let i = 0; i < L.n; i++) {
      const x = L.ox + (i % L.cols) * c;
      const y = L.oy + Math.floor(i / L.cols) * c;
      ctx.fillStyle = PALETTE[col[i] % PALETTE.length];
      if (c >= 14) {
        // Auto shora: karoserie, přední a zadní okno.
        const w = c * 0.46;
        const h = c * 0.78;
        const bx = x + (c - w) / 2;
        const by = y + (c - h) / 2;
        roundRect(ctx, bx, by, w, h, w * 0.3);
        ctx.fill();
        ctx.fillStyle = 'rgba(20, 28, 38, .55)';
        roundRect(ctx, bx + w * 0.14, by + h * 0.2, w * 0.72, h * 0.17, w * 0.1);
        ctx.fill();
        roundRect(ctx, bx + w * 0.16, by + h * 0.68, w * 0.68, h * 0.11, w * 0.08);
        ctx.fill();
      } else if (c >= 5) {
        roundRect(ctx, x + c * 0.18, y + c * 0.1, c * 0.64, c * 0.8, c * 0.18);
        ctx.fill();
      } else {
        ctx.fillRect(x + 0.3, y + 0.3, Math.max(1, c - 0.6), Math.max(1, c - 0.6));
      }
    }
  }

  /** Nakreslí základ (auta) a nehody; scale u nehody 0 až 1 kvůli animaci „vyskočení“. */
  private paint(crashes: ArrayLike<number> | null, upto = Infinity, times?: Float64Array, now = 0) {
    const L = this.L;
    if (!L) return;
    const ctx = this.cv.getContext('2d');
    if (!ctx) return;
    const d = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.drawImage(this.base, 0, 0);
    if (!crashes) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const c = L.cell;
    const crash = css('--crash', '#E0512B');
    for (let k = 0; k < crashes.length && k < upto; k++) {
      const i = crashes[k];
      const x = L.ox + (i % L.cols) * c;
      const y = L.oy + Math.floor(i / L.cols) * c;
      const s = times ? Math.min(1, Math.max(0, (now - times[k]) / 180)) : 1;
      if (s <= 0) continue;
      if (c >= 14) {
        ctx.fillStyle = '#FFC233';
        star(ctx, x + c / 2, y + c / 2, c * 0.44 * s, c * 0.2 * s);
        ctx.fill();
        ctx.lineWidth = Math.max(1, c * 0.05);
        ctx.strokeStyle = crash;
        ctx.stroke();
      } else if (c >= 5) {
        ctx.fillStyle = crash;
        ctx.beginPath();
        ctx.arc(x + c / 2, y + c / 2, c * 0.55 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = crash;
        ctx.fillRect(x + 0.3, y + 0.3, Math.max(1, c - 0.6), Math.max(1, c - 0.6));
      }
    }
  }

  /** Přepne na skupinu n aut; s animací plynule prolne starou a novou skupinu. */
  async show(n: number, colors: Uint8Array, crashes: ArrayLike<number> | null, alive: () => boolean, animate: boolean): Promise<void> {
    const old = document.createElement('canvas');
    const hadOld = this.L !== null && this.cv.width > 0;
    if (hadOld && animate && !reducedMotion()) {
      old.width = this.cv.width;
      old.height = this.cv.height;
      old.getContext('2d')?.drawImage(this.cv, 0, 0);
    }
    const { W, H } = this.size();
    this.L = layoutFor(n, W, H);
    this.colors = colors;
    this.drawBase();
    if (!hadOld || !animate || reducedMotion()) {
      this.paint(crashes);
      return;
    }
    const ctx = this.cv.getContext('2d');
    if (!ctx) return;
    const dur = 520;
    await new Promise<void>((res) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        if (!alive()) return res();
        const t = Math.min(1, (now - t0) / dur);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.cv.width, this.cv.height);
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(old, 0, 0, this.cv.width, this.cv.height);
        ctx.globalAlpha = t;
        ctx.drawImage(this.base, 0, 0);
        ctx.globalAlpha = 1;
        if (t < 1) requestAnimationFrame(frame);
        else res();
      };
      requestAnimationFrame(frame);
    });
    this.paint(crashes);
  }

  /** Překreslí aktuální stav (např. po změně šířky okna). */
  redraw(crashes: ArrayLike<number> | null) {
    if (!this.L || !this.colors) return;
    const { W, H } = this.size();
    this.L = layoutFor(this.L.n, W, H);
    this.drawBase();
    this.paint(crashes);
  }

  /** Jedno kolo: nehody se objevují v náhodných okamžicích, onCount dostává průběžný počet. */
  runYear(crashes: Int32Array, dur: number, rnd: () => number, onCount: (k: number) => void, alive: () => boolean): Promise<void> {
    const n = crashes.length;
    if (reducedMotion()) {
      this.paint(crashes);
      onCount(n);
      return new Promise((res) => setTimeout(res, 300));
    }
    const times = new Float64Array(n);
    for (let k = 0; k < n; k++) times[k] = rnd() * (dur - 300);
    // Seřadit nehody podle času, aby počítadlo rostlo plynule.
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => times[a] - times[b]);
    const sc = new Int32Array(n);
    const st = new Float64Array(n);
    order.forEach((k, j) => {
      sc[j] = crashes[k];
      st[j] = times[k];
    });
    return new Promise((res) => {
      const t0 = performance.now();
      let shown = -1;
      const frame = (now: number) => {
        if (!alive()) return res();
        const el = now - t0;
        let m = 0;
        while (m < n && st[m] <= el) m++;
        this.paint(sc, m, st, el);
        if (m !== shown) {
          shown = m;
          onCount(m);
        }
        if (el < dur) requestAnimationFrame(frame);
        else {
          this.paint(sc);
          onCount(n);
          res();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}
