// The LIVE screen, running in the browser. Draws onto a 960x640 canvas (the
// panel at 2x) the same way LoadCellNode_v9/ui.cpp does: the firmware's screen
// render as the base (header and soft keys), the big number in the device's own
// Font7 digits, and the stroke-synced sweep -- every catch wipes the graph and
// the trace restarts at the left edge, the width sized to the last period + 10%.
import { EXAMPLE, hash01, strokeForce } from "./stroke";

const S = 2; // canvas px per panel px
const GRF = { x: 8, y: 118, w: 380, h: 194 };
const NUM_RIGHT = 312;
const NUM_TOP = 48;
const C_FAINT = "rgb(33,36,33)";
const C_TRACE = "rgb(0,255,255)";

// Font7 sprite (public/product/font7.png): glyph order and widths in panel px.
const GLYPHS = " -.0123456789";
const GLYPH_W = [12, 32, 12, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32];
const GLYPH_X = GLYPH_W.map((_, i) => GLYPH_W.slice(0, i).reduce((a, b) => a + b, 0));

const SPS = 80;
const PERIOD = 60 / EXAMPLE.spm;
const THR = EXAMPLE.catchFrac * EXAMPLE.peakKg;
const PEAK_HIST = 64.81;
const VALLEY_HIST = -0.42;
const SPAN = PEAK_HIST - VALLEY_HIST;
const LO = VALLEY_HIST - SPAN * 0.1;
const HI = PEAK_HIST + SPAN * 0.1;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/** Force at session time t: strokes every PERIOD s, each a little different. */
function force(t: number) {
  const k = Math.floor(t / PERIOD);
  const v = { k: 0.94 + 0.08 * hash01(k * 31), pp: 0.36 + 0.04 * hash01(k * 17), ds: 0.97 + 0.06 * hash01(k * 11) };
  return strokeForce(t - k * PERIOD, v);
}

export class LiveScreen {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private font!: HTMLImageElement;
  private t = 0.35;               // session time, s
  private nextSample = 0.35;
  private ema = 0;
  private prevRaw = 0;
  private prevT = 0.35;
  private lastCatch = -PERIOD;    // seeded, as if the crew were already rowing
  private sweepT0 = 0;
  private win = PERIOD * 1.1;
  private last: [number, number] | null = null;
  private shown = "";
  private lastNum = 0;

  private constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 480 * S;
    this.canvas.height = 320 * S;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
  }

  static async create(baseSrc = "/product/live.png", fontSrc = "/product/font7.png") {
    const s = new LiveScreen();
    const [base, font] = await Promise.all([loadImage(baseSrc), loadImage(fontSrc)]);
    s.font = font;
    s.ctx.drawImage(base, 0, 0, s.canvas.width, s.canvas.height);
    s.ctx.fillStyle = "#000";
    s.ctx.fillRect(40 * S, 46 * S, (314 - 40) * S, 52 * S); // the rendered number
    s.frame();
    return s;
  }

  private px(x: number, y: number) {
    this.ctx.fillRect(x * S, y * S, S, S);
  }

  private line(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** drawGraphFrame() */
  private frame() {
    const c = this.ctx;
    c.fillStyle = "#000";
    c.fillRect(GRF.x * S, GRF.y * S, GRF.w * S, GRF.h * S);
    c.fillStyle = C_FAINT;
    c.fillRect((GRF.x - 1) * S, (GRF.y - 1) * S, (GRF.w + 2) * S, S);
    c.fillRect((GRF.x - 1) * S, (GRF.y + GRF.h) * S, (GRF.w + 2) * S, S);
    c.fillRect((GRF.x - 1) * S, (GRF.y - 1) * S, S, (GRF.h + 2) * S);
    c.fillRect((GRF.x + GRF.w) * S, (GRF.y - 1) * S, S, (GRF.h + 2) * S);
    for (let i = 1; i < 4; i++) c.fillRect(GRF.x * S, (GRF.y + Math.floor((GRF.h * i) / 4)) * S, GRF.w * S, S);
    this.last = null;
  }

  private number(v: number) {
    let s = v.toFixed(2);
    if (s.length > 8) s = "--------";
    s = s.padStart(8, " ");
    if (s === this.shown) return;
    this.shown = s;
    const c = this.ctx;
    const w = [...s].reduce((a, ch) => a + GLYPH_W[GLYPHS.indexOf(ch)], 0);
    let x = NUM_RIGHT - w;
    c.fillStyle = "#000";
    c.fillRect(40 * S, NUM_TOP * S, (NUM_RIGHT - 40) * S, 48 * S);
    for (const ch of s) {
      const g = GLYPHS.indexOf(ch);
      c.drawImage(this.font, GLYPH_X[g], 0, GLYPH_W[g], 48, x * S, NUM_TOP * S, GLYPH_W[g] * S, 48 * S);
      x += GLYPH_W[g];
    }
  }

  /** Advance the simulation by dt seconds and draw. Returns true if the canvas changed. */
  step(dt: number) {
    const end = this.t + Math.min(dt, 0.1);
    const c = this.ctx;
    c.fillStyle = C_TRACE;
    // The firmware loop runs every few ms; advance in 4 ms slices.
    for (let now = this.t; now < end; now += 0.004) {
      while (this.nextSample <= now) {
        const raw = force(this.nextSample);
        if (this.prevRaw < THR && raw >= THR) {
          const tc = this.prevT + ((THR - this.prevRaw) / (raw - this.prevRaw)) * (this.nextSample - this.prevT);
          this.win = Math.min(6, Math.max(1.2, (tc - this.lastCatch) * 1.1));
          this.lastCatch = tc;
          this.sweepT0 = tc;
          this.frame();
          c.fillStyle = C_TRACE;
        }
        this.ema += 0.25 * (raw - this.ema);
        this.prevRaw = raw;
        this.prevT = this.nextSample;
        this.nextSample += 1 / SPS;
      }
      let elapsed = now - this.sweepT0;
      if (elapsed >= this.win) {          // no catch in time: time-driven
        this.sweepT0 = now;
        this.win = 6;
        elapsed = 0;
        this.frame();
        c.fillStyle = C_TRACE;
      }
      const x = GRF.x + Math.floor(((GRF.w - 1) * elapsed) / this.win);
      const f = Math.min(1, Math.max(0, (this.ema - LO) / (HI - LO)));
      const y = Math.floor(GRF.y + GRF.h - 1 - f * (GRF.h - 1));
      if (this.last && x >= this.last[0]) this.line(this.last[0], this.last[1], x, y);
      else this.px(x, y);
      this.last = [x, y];
    }
    this.t = end;
    if (this.t - this.lastNum >= 0.05) {   // NUM_REFRESH_MS
      this.lastNum = this.t;
      this.number(this.ema);
    }
    return true;
  }
}
