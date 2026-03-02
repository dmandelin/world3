// ── Random Utilities ────────────────────────────────────────────────

let _seed = 42;

export function setSeed(s: number) {
  _seed = s;
}

// Simple seeded PRNG (mulberry32)
export function random(): number {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return random() * (max - min) + min;
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

export function weightedChoice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function randomGaussian(mean: number, stddev: number): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

export function shuffled<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Math Utilities ──────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ── ID Generation ───────────────────────────────────────────────────

let _nextId = 1;

export function generateId(prefix: string): string {
  return `${prefix}_${_nextId++}`;
}

export function resetIdCounter(start: number = 1) {
  _nextId = start;
}

// ── Formatting ──────────────────────────────────────────────────────

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return `${year} AD`;
}

export function formatPopulation(pop: number): string {
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}k`;
  return pop.toString();
}

export function formatPercent(v: number): string {
  return `${Math.round(v)}%`;
}

export function formatNeed(v: number): string {
  if (v >= 80) return 'Excellent';
  if (v >= 60) return 'Good';
  if (v >= 40) return 'Adequate';
  if (v >= 20) return 'Poor';
  return 'Critical';
}

export function needColor(v: number): string {
  if (v >= 80) return 'var(--color-excellent)';
  if (v >= 60) return 'var(--color-good)';
  if (v >= 40) return 'var(--color-adequate)';
  if (v >= 20) return 'var(--color-poor)';
  return 'var(--color-critical)';
}
