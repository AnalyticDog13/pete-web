import type { NeuralParams, NeuralStats, NeuralStyle } from "./types";

/**
 * NeuralEngine — a self-contained canvas-2D simulation of a growing neural
 * substrate. Neurons drift, extend dendrites toward neighbours (synapses draw
 * themselves into existence), then fire signals that cascade across the
 * network. The pointer acts as a stimulus field: nearby neurons excite and
 * fire, and quick movement leaves an excitation wake.
 *
 * It is framework-agnostic on purpose — React only mutates `params` and reads
 * `getStats()`. No React inside the hot loop.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Activation 0..~1.4, decays each frame. Drives glow + firing. */
  act: number;
  /** Frames until this neuron may fire again. */
  cooldown: number;
  hueJitter: number;
  /** Parallax depth, 0 (far) .. 1 (near). */
  depth: number;
}

interface Edge {
  a: number;
  b: number;
  /** Axon draw progress, 0..1. */
  grown: number;
  /** Synaptic weight, 0..1. */
  weight: number;
  /** When false, the synapse is being pruned (grown reverses). */
  alive: boolean;
}

interface Pulse {
  edge: number;
  /** Position along the edge, 0..1. */
  pos: number;
  /** +1 a→b, -1 b→a. */
  dir: number;
  speed: number;
}

interface StyleSpec {
  nodeScale: number; // multiplies population
  linkRadius: number; // px (pre-scale) within which synapses may form
  maxDegree: number;
  drift: number; // ambient motion
  curvature: number; // 0 straight, 1 curved axons
  trail: number; // fade alpha (lower = longer trails)
  spontaneous: number; // base firing probability multiplier
}

const STYLES: Record<NeuralStyle, StyleSpec> = {
  dendrite: { nodeScale: 1, linkRadius: 168, maxDegree: 4, drift: 0.16, curvature: 0.9, trail: 0.16, spontaneous: 0.7 },
  synapse: { nodeScale: 1.15, linkRadius: 150, maxDegree: 5, drift: 0.1, curvature: 0.25, trail: 0.2, spontaneous: 1.25 },
  constellation: { nodeScale: 0.7, linkRadius: 196, maxDegree: 3, drift: 0.34, curvature: 0, trail: 0.1, spontaneous: 0.5 },
  cortex: { nodeScale: 1.55, linkRadius: 124, maxDegree: 6, drift: 0.08, curvature: 0.5, trail: 0.24, spontaneous: 1.6 },
};

const TAU = Math.PI * 2;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class NeuralEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private params: NeuralParams;

  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private pulses: Pulse[] = [];

  private w = 0;
  private h = 0;
  private dpr = 1;

  private raf = 0;
  private running = false;
  private lastT = 0;
  private growTimer = 0;

  // pointer (canvas-space, css px)
  private px = -9999;
  private py = -9999;
  private pvx = 0;
  private pvy = 0;
  private lastPx = -9999;
  private lastPy = -9999;
  private pointerInside = false;
  // pointer mapped into world space (accounts for zoom + parallax)
  private pwx = -9999;
  private pwy = -9999;
  // smoothed parallax target
  private parX = 0;
  private parY = 0;
  // view transform
  private zoom = 1;
  private targetZoom = 1;
  private shiftX = 0;
  private shiftY = 0;
  // intro boot-up reveal, 0 → 1
  private boot = 0;

  // stats
  private signalCount = 0;
  private signalWindow = 0;
  private signalsPerSecond = 0;

  constructor(canvas: HTMLCanvasElement, params: NeuralParams) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.params = params;
    this.resize();
  }

  setParams(p: NeuralParams) {
    const styleChanged = p.style !== this.params.style;
    const densityChanged = p.density !== this.params.density;
    this.params = p;
    if (styleChanged || densityChanged) this.reseedPopulation();
  }

  // ---- population ----------------------------------------------------------

  private targetNodeCount() {
    const spec = STYLES[this.params.style];
    const area = this.w * this.h;
    // scale population with viewport area so density reads consistently
    const base = Math.round((area / 16000) * lerp(0.45, 1.5, this.params.density) * spec.nodeScale);
    return Math.max(28, Math.min(260, base));
  }

  private spawnNode(): Node {
    return {
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: lerp(1.1, 2.8, Math.random() ** 1.5),
      act: 0,
      cooldown: Math.random() * 120,
      hueJitter: (Math.random() - 0.5) * 36,
      depth: Math.random(),
    };
  }

  private reseedPopulation() {
    const target = this.targetNodeCount();
    if (this.nodes.length === 0) {
      for (let i = 0; i < target; i++) this.nodes.push(this.spawnNode());
    } else if (this.nodes.length < target) {
      while (this.nodes.length < target) this.nodes.push(this.spawnNode());
    } else if (this.nodes.length > target) {
      this.nodes.length = target;
      this.edges = this.edges.filter((e) => e.a < target && e.b < target);
      this.pulses = this.pulses.filter((p) => p.edge < this.edges.length);
    }
  }

  // ---- lifecycle -----------------------------------------------------------

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.reseedPopulation();
    // paint substrate immediately to avoid a white flash
    this.ctx.fillStyle = "#04060d";
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(2.4, (t - this.lastT) / 16.6667 || 1);
      this.lastT = t;
      this.step(dt, t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pointerMove(x: number, y: number) {
    this.px = x;
    this.py = y;
    this.pointerInside = true;
  }

  pointerLeave() {
    this.pointerInside = false;
    this.px = -9999;
    this.py = -9999;
    this.pwx = -9999;
    this.pwy = -9999;
    this.pvx = 0;
    this.pvy = 0;
  }

  // ---- view / interaction --------------------------------------------------

  /** Map a screen-space (css px) point into simulation/world space. */
  private screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.w / 2) / this.zoom + this.w / 2 - this.shiftX,
      y: (sy - this.h / 2) / this.zoom + this.h / 2 - this.shiftY,
    };
  }

  getZoom() {
    return this.zoom;
  }

  setZoom(z: number) {
    this.targetZoom = Math.max(0.5, Math.min(3, z));
  }

  zoomBy(factor: number) {
    this.setZoom(this.targetZoom * factor);
  }

  resetZoom() {
    this.targetZoom = 1;
  }

  /** Spawn a neuron at a screen-space point and fire it for instant feedback. */
  addNeuronAt(sx: number, sy: number) {
    const { x, y } = this.screenToWorld(sx, sy);
    const n = this.spawnNode();
    n.x = x;
    n.y = y;
    n.size = 2.4;
    n.depth = 0.85;
    n.act = 1.2;
    n.cooldown = 0;
    this.nodes.push(n);
    // hard ceiling so manual spamming can't melt the device
    if (this.nodes.length > 380) {
      this.nodes.shift();
      this.edges = this.edges
        .map((e) => ({ ...e, a: e.a - 1, b: e.b - 1 }))
        .filter((e) => e.a >= 0 && e.b >= 0);
      this.pulses = this.pulses.filter((p) => p.edge < this.edges.length);
    }
    this.fireNode(this.nodes.length - 1);
  }

  getStats(): NeuralStats {
    return {
      neurons: this.nodes.length,
      synapses: this.edges.filter((e) => e.grown > 0.5).length,
      signalsPerSecond: Math.round(this.signalsPerSecond),
    };
  }

  // ---- simulation ----------------------------------------------------------

  private step(dt: number, t: number) {
    const p = this.params;
    const spec = STYLES[p.style];
    const reduced = p.reducedMotion;
    const motion = reduced ? 0.18 : 1;

    // pointer velocity (smoothed)
    if (this.pointerInside && this.lastPx > -9000) {
      this.pvx = lerp(this.pvx, this.px - this.lastPx, 0.4);
      this.pvy = lerp(this.pvy, this.py - this.lastPy, 0.4);
    } else {
      this.pvx *= 0.85;
      this.pvy *= 0.85;
    }
    this.lastPx = this.px;
    this.lastPy = this.py;
    const speed = Math.hypot(this.pvx, this.pvy);

    // parallax target from pointer offset
    const tx = this.pointerInside ? (this.px / this.w - 0.5) : 0;
    const ty = this.pointerInside ? (this.py / this.h - 0.5) : 0;
    this.parX = lerp(this.parX, tx, 0.05);
    this.parY = lerp(this.parY, ty, 0.05);

    // ease zoom + recompute view shift, then map pointer into world space
    this.zoom = lerp(this.zoom, this.targetZoom, 0.12);
    this.shiftX = -this.parX * 26;
    this.shiftY = -this.parY * 26;
    if (this.pointerInside) {
      const wp = this.screenToWorld(this.px, this.py);
      this.pwx = wp.x;
      this.pwy = wp.y;
    }

    // intro boot-up
    this.boot = Math.min(1, this.boot + dt * (reduced ? 0.1 : 0.018));

    this.updateNodes(dt, spec, motion, speed);
    this.growNetwork(dt);
    this.updatePulses(dt, motion);
    this.fire(dt, spec, t);
    this.render(spec);

    // signals/second rolling window
    this.signalWindow += dt * 16.6667;
    if (this.signalWindow >= 500) {
      this.signalsPerSecond = (this.signalCount / this.signalWindow) * 1000;
      this.signalCount = 0;
      this.signalWindow = 0;
    }
  }

  private updateNodes(dt: number, spec: StyleSpec, motion: number, speed: number) {
    const p = this.params;
    const cursorR = 180;
    const pull = p.cursorPull;
    for (const n of this.nodes) {
      // ambient drift
      n.vx += (Math.random() - 0.5) * 0.04 * spec.drift * motion;
      n.vy += (Math.random() - 0.5) * 0.04 * spec.drift * motion;

      // cursor stimulus / attraction (world space)
      if (this.pointerInside) {
        const dx = this.pwx - n.x;
        const dy = this.pwy - n.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < cursorR) {
          const falloff = 1 - d / cursorR;
          // gentle attraction (depth-weighted so near nodes respond more)
          const f = (pull * 0.16 * falloff * (0.4 + n.depth)) / d;
          n.vx += dx * f;
          n.vy += dy * f;
          // excitation grows with proximity and pointer speed
          n.act += (0.012 + speed * 0.004) * falloff * (0.6 + p.glow);
        }
      }

      n.vx *= 0.94;
      n.vy *= 0.94;
      const damp = motion;
      n.x += n.vx * dt * damp;
      n.y += n.vy * dt * damp;

      // soft-wrap with margin so the field feels boundless
      const m = 40;
      if (n.x < -m) n.x = this.w + m;
      else if (n.x > this.w + m) n.x = -m;
      if (n.y < -m) n.y = this.h + m;
      else if (n.y > this.h + m) n.y = -m;

      // activation decay
      n.act *= 0.94;
      if (n.cooldown > 0) n.cooldown -= dt;
    }
  }

  private connected(a: number, b: number) {
    for (const e of this.edges) {
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return true;
    }
    return false;
  }

  private degree(i: number) {
    let d = 0;
    for (const e of this.edges) if (e.alive && (e.a === i || e.b === i)) d++;
    return d;
  }

  /** Periodically grow new synapses toward nearby neurons and prune stretched ones. */
  private growNetwork(dt: number) {
    const p = this.params;
    const spec = STYLES[p.style];
    const radius = spec.linkRadius;

    // animate growth / pruning of existing edges
    const rate = lerp(0.004, 0.03, p.growth);
    for (let i = this.edges.length - 1; i >= 0; i--) {
      const e = this.edges[i];
      const a = this.nodes[e.a];
      const b = this.nodes[e.b];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > radius * 1.35) e.alive = false; // stretched too far → prune
      if (e.alive) {
        e.grown = Math.min(1, e.grown + rate * dt);
        e.weight = lerp(e.weight, 0.4 + 0.6 * (1 - dist / (radius * 1.35)), 0.02);
      } else {
        e.grown -= rate * 1.6 * dt;
        if (e.grown <= 0) {
          this.edges.splice(i, 1);
          this.pulses = this.pulses.filter((pl) => pl.edge !== i);
          for (const pl of this.pulses) if (pl.edge > i) pl.edge--;
        }
      }
    }

    // throttle new connections
    this.growTimer -= dt;
    if (this.growTimer > 0) return;
    this.growTimer = lerp(14, 2, p.growth);

    const attempts = 2 + Math.round(p.growth * 4);
    for (let k = 0; k < attempts; k++) {
      const ai = (Math.random() * this.nodes.length) | 0;
      const a = this.nodes[ai];
      if (this.degree(ai) >= spec.maxDegree) continue;
      let best = -1;
      let bestD = radius;
      for (let bi = 0; bi < this.nodes.length; bi++) {
        if (bi === ai) continue;
        const b = this.nodes[bi];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bestD && this.degree(bi) < spec.maxDegree && !this.connected(ai, bi)) {
          bestD = d;
          best = bi;
        }
      }
      if (best >= 0) {
        this.edges.push({ a: ai, b: best, grown: 0, weight: 0.3, alive: true });
      }
    }
  }

  private emitPulse(edgeIndex: number, fromNode: number) {
    const e = this.edges[edgeIndex];
    if (!e || e.grown < 0.85) return;
    const dir = e.a === fromNode ? 1 : -1;
    this.pulses.push({
      edge: edgeIndex,
      pos: dir === 1 ? 0 : 1,
      dir,
      speed: lerp(0.006, 0.03, this.params.pulseSpeed),
    });
    this.signalCount++;
  }

  private updatePulses(dt: number, motion: number) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pl = this.pulses[i];
      const e = this.edges[pl.edge];
      if (!e || !e.alive) {
        this.pulses.splice(i, 1);
        continue;
      }
      pl.pos += pl.dir * pl.speed * dt * (0.4 + motion);
      const arrived = pl.dir === 1 ? pl.pos >= 1 : pl.pos <= 0;
      if (arrived) {
        // deliver charge to the target neuron → may trigger a cascade
        const target = pl.dir === 1 ? e.b : e.a;
        this.nodes[target].act += 0.55 * e.weight;
        this.pulses.splice(i, 1);
      }
    }
  }

  /** Spontaneous + activation-driven firing. */
  private fire(dt: number, spec: StyleSpec, _t: number) {
    const p = this.params;
    if (p.reducedMotion) {
      // calm, occasional firing only
      if (Math.random() < 0.01 * p.pulseSpeed) this.fireNode((Math.random() * this.nodes.length) | 0);
      return;
    }
    const spont = 0.0009 * spec.spontaneous * lerp(0.2, 2.2, p.pulseSpeed) * dt;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const trigger = n.act > 0.8 || Math.random() < spont;
      if (trigger && n.cooldown <= 0) this.fireNode(i);
    }
  }

  private fireNode(i: number) {
    const n = this.nodes[i];
    if (!n) return;
    n.act = Math.max(n.act, 1.15);
    n.cooldown = lerp(46, 10, this.params.pulseSpeed);
    for (let ei = 0; ei < this.edges.length; ei++) {
      const e = this.edges[ei];
      if (e.alive && (e.a === i || e.b === i)) this.emitPulse(ei, i);
    }
  }

  // ---- rendering -----------------------------------------------------------

  private render(spec: StyleSpec) {
    const ctx = this.ctx;
    const p = this.params;

    // trail fade — lower alpha leaves longer comet trails
    const fade = p.reducedMotion ? 1 : lerp(spec.trail * 0.6, spec.trail * 1.4, 1 - p.glow * 0.4);
    ctx.fillStyle = `rgba(4, 6, 13, ${fade})`;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    // zoom about the viewport centre, then parallax-shift for depth
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.w / 2, -this.h / 2);
    ctx.translate(this.shiftX, this.shiftY);

    const hue = p.hue;
    // boot reveal eases everything up from black on first load
    const boot = p.reducedMotion ? 1 : this.boot * this.boot * (3 - 2 * this.boot);
    const glow = p.glow * (0.2 + 0.8 * boot);
    ctx.globalAlpha = 0.15 + 0.85 * boot;

    // 1) synapses (edges)
    ctx.lineCap = "round";
    for (const e of this.edges) {
      if (e.grown <= 0.001) continue;
      const a = this.nodes[e.a];
      const b = this.nodes[e.b];
      const act = Math.min(1.2, (a.act + b.act) * 0.5);
      const ex = lerp(a.x, b.x, e.grown);
      const ey = lerp(a.y, b.y, e.grown);
      const baseAlpha = (0.05 + e.weight * 0.16 + act * 0.4) * (0.5 + glow * 0.8);
      ctx.lineWidth = 0.6 + act * 1.4 + e.weight * 0.5;
      ctx.strokeStyle = `hsla(${hue + (a.hueJitter + b.hueJitter) * 0.5}, 90%, ${52 + act * 28}%, ${baseAlpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (spec.curvature > 0) {
        // bowed axon for an organic, dendritic feel
        const mx = (a.x + ex) / 2;
        const my = (a.y + ey) / 2;
        const nx = -(ey - a.y);
        const ny = ex - a.x;
        const len = Math.hypot(nx, ny) || 1;
        const bow = spec.curvature * 14 * Math.sin((a.x + a.y) * 0.01);
        ctx.quadraticCurveTo(mx + (nx / len) * bow, my + (ny / len) * bow, ex, ey);
      } else {
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
    }

    // 2) signals (pulses) — bright, additive
    ctx.globalCompositeOperation = "lighter";
    for (const pl of this.pulses) {
      const e = this.edges[pl.edge];
      if (!e) continue;
      const a = this.nodes[e.a];
      const b = this.nodes[e.b];
      const t = Math.max(0, Math.min(e.grown, pl.pos));
      const x = lerp(a.x, b.x, t);
      const y = lerp(a.y, b.y, t);
      const r = 2.4 + glow * 2.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, `hsla(${hue + 20}, 100%, 86%, ${0.9})`);
      g.addColorStop(0.4, `hsla(${hue}, 100%, 64%, ${0.5})`);
      g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, TAU);
      ctx.fill();
    }

    // 3) neurons (nodes)
    for (const n of this.nodes) {
      const act = Math.min(1.3, n.act);
      const r = n.size * (1 + act * 1.3) * (0.7 + n.depth * 0.6);
      if (act > 0.05 || glow > 0.3) {
        const halo = r * (3 + glow * 4);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, halo);
        g.addColorStop(0, `hsla(${hue + n.hueJitter}, 95%, 70%, ${(0.12 + act * 0.5) * (0.4 + glow)})`);
        g.addColorStop(1, `hsla(${hue + n.hueJitter}, 95%, 60%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, halo, 0, TAU);
        ctx.fill();
      }
      // bright core
      ctx.fillStyle = `hsla(${hue + n.hueJitter}, 100%, ${lerp(78, 96, act)}%, ${0.7 + act * 0.3})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fill();
    }

    // 4) cursor stimulus halo (world space)
    if (this.pointerInside) {
      const speed = Math.hypot(this.pvx, this.pvy) / this.zoom;
      const cx = this.pwx;
      const cy = this.pwy;
      const r = 70 + Math.min(60, speed * 6);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `hsla(${hue + 30}, 100%, 80%, ${0.16 + Math.min(0.2, speed * 0.02)})`);
      g.addColorStop(0.5, `hsla(${hue}, 100%, 60%, 0.05)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();

      // thin reticle ring
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = `hsla(${hue + 30}, 100%, 78%, 0.18)`;
      ctx.lineWidth = 1 / this.zoom;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, TAU);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }
}
