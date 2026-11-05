import type { Settings, Unit } from '../types';

const LB_PER_KG = 2.20462;

/** Smallest total-weight jump the plates allow (a pair of the smallest plate). */
export function smallestStep(settings: Pick<Settings, 'plates'>): number {
  const smallest = Math.min(...settings.plates);
  return Number.isFinite(smallest) && smallest > 0 ? smallest * 2 : 1;
}

export function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/** Round a weight to something loadable on the bar, never below the empty bar. */
export function roundLoadable(value: number, settings: Pick<Settings, 'plates' | 'barWeight'>): number {
  const { barWeight } = settings;
  if (value <= barWeight) return barWeight;
  return barWeight + roundTo(value - barWeight, smallestStep(settings));
}

export function convertWeight(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

export interface PlateBreakdown {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[];
  /** Weight per side that could not be made with the available plates. */
  remainder: number;
}

export function plateBreakdown(total: number, barWeight: number, plates: number[]): PlateBreakdown {
  let side = Math.max(0, (total - barWeight) / 2);
  const perSide: number[] = [];
  for (const plate of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= plate) {
      perSide.push(plate);
      side -= plate;
    }
  }
  return { perSide, remainder: Math.round(side * 1000) / 1000 };
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/**
 * StrongLifts-style warmup: 2×5 with the empty bar, then ramp up in
 * roughly equal jumps (5, 3, 2 reps) to the work weight.
 */
export function warmupSets(work: number, settings: Pick<Settings, 'plates' | 'barWeight'>): WarmupSet[] {
  const { barWeight } = settings;
  if (work <= barWeight) return [];
  const sets: WarmupSet[] = [
    { weight: barWeight, reps: 5 },
    { weight: barWeight, reps: 5 },
  ];
  const ramp: [number, number][] = [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  for (const [pct, reps] of ramp) {
    const weight = roundLoadable(work * pct, settings);
    const last = sets[sets.length - 1].weight;
    if (weight > last && weight < work) sets.push({ weight, reps });
  }
  return sets;
}

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
