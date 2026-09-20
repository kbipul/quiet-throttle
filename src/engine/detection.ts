import { clamp01, normalCdf, normalQuantile } from './stats';
import type { DetectionResult, EvalConfig } from './types';

/**
 * How long would a silent downgrade hide inside your own eval noise?
 *
 * AA26-251A recommends that providers respond to suspected distillation by
 * serving a downgraded model *without informing the user*, and that they vary
 * the alteration across requests specifically "to complicate response quality
 * evaluations". So the question is not whether a quality drop exists — it is
 * whether your eval suite has the statistical resolution to see one, given
 * that only some fraction of responses are affected.
 *
 * The model is a one-sample one-sided test of an observed pass rate against a
 * known baseline. Normal approximation to the binomial, which is comfortable
 * at the suite sizes anyone actually runs (tens to thousands of cases).
 */

const POWER_TARGET = 0.8;
/** Cumulative confidence the headline blind window is measured to. */
export const HEADLINE_CONFIDENCE = 0.9;
/** Below this per-run power, "expected runs" is a number nobody should act on. */
const HOPELESS_POWER = 1e-4;

export function analyseDetection(cfg: EvalConfig, requestsPerDay: number): DetectionResult {
  const p0 = clamp01(cfg.baseline);
  const intermittency = clamp01(cfg.intermittency);
  const effectiveDrop = clamp01(cfg.degradation) * intermittency;
  const p1 = clamp01(p0 - effectiveDrop);
  const n = Math.max(1, Math.floor(cfg.casesPerRun));
  const alpha = Math.min(0.5, Math.max(1e-6, cfg.alpha));
  const runsPerWeek = Math.max(0.01, cfg.runsPerWeek);

  const perRunPower = power(p0, p1, n, alpha);
  const undetectable = effectiveDrop <= 0 || perRunPower < HOPELESS_POWER;

  const expectedRuns = undetectable ? Infinity : 1 / perRunPower;
  const expectedDays = undetectable ? Infinity : (expectedRuns / runsPerWeek) * 7;
  const runsFor90Pct = undetectable
    ? Infinity
    : perRunPower >= 1
      ? 1
      : Math.ceil(Math.log(1 - HEADLINE_CONFIDENCE) / Math.log(1 - perRunPower));
  const blindWindowDays = undetectable ? Infinity : (runsFor90Pct / runsPerWeek) * 7;

  return {
    observedRate: p1,
    effectiveDrop,
    perRunPower,
    expectedRuns,
    expectedDays,
    runsFor90Pct,
    blindWindowDays,
    degradedRequests: undetectable ? Infinity : blindWindowDays * Math.max(0, requestsPerDay),
    casesForSingleRunPower: requiredCases(p0, p1, alpha, POWER_TARGET),
    undetectable,
  };
}

/**
 * Probability that a single run of n cases rejects "pass rate is still p0"
 * at the given one-sided alpha, when the true rate is p1.
 */
export function power(p0: number, p1: number, n: number, alpha: number): number {
  if (p1 >= p0) return alpha;
  const sd0 = Math.sqrt(p0 * (1 - p0));
  const sd1 = Math.sqrt(p1 * (1 - p1));
  if (sd1 === 0) return p0 >= 1 ? 1 : 1;
  const zAlpha = normalQuantile(1 - alpha);
  const z = (Math.sqrt(n) * (p0 - p1) - zAlpha * sd0) / sd1;
  return clamp01(normalCdf(z));
}

/** Cases per run needed to reach `target` power on a single run. */
export function requiredCases(
  p0: number,
  p1: number,
  alpha: number,
  target: number,
): number {
  if (p1 >= p0) return Infinity;
  const zAlpha = normalQuantile(1 - alpha);
  const zBeta = normalQuantile(target);
  const numerator = zAlpha * Math.sqrt(p0 * (1 - p0)) + zBeta * Math.sqrt(p1 * (1 - p1));
  return Math.ceil((numerator / (p0 - p1)) ** 2);
}

/**
 * Smallest suite size that pulls the blind window — the 90%-confidence one,
 * matching the headline — under `targetDays`, or Infinity if no realistic
 * suite does. This is the "what would it take" counterfactual, not a
 * recommendation.
 */
export function casesForWindow(
  cfg: EvalConfig,
  targetDays: number,
  maxCases = 200_000,
): number {
  const p0 = clamp01(cfg.baseline);
  const p1 = clamp01(p0 - clamp01(cfg.degradation) * clamp01(cfg.intermittency));
  if (p1 >= p0) return Infinity;
  const runsPerWeek = Math.max(0.01, cfg.runsPerWeek);
  const runsAvailable = Math.floor((targetDays / 7) * runsPerWeek);
  if (runsAvailable < 1) return Infinity;
  // Per-run power at which `runsAvailable` runs reach HEADLINE_CONFIDENCE.
  const neededPower = 1 - (1 - HEADLINE_CONFIDENCE) ** (1 / runsAvailable);
  if (neededPower > 1) return Infinity;

  let lo = 1;
  let hi = maxCases;
  if (power(p0, p1, hi, cfg.alpha) < neededPower) return Infinity;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (power(p0, p1, mid, cfg.alpha) >= neededPower) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function formatDays(days: number): string {
  if (!Number.isFinite(days)) return 'never';
  if (days < 1) return 'under a day';
  if (days < 45) return `${Math.round(days)} days`;
  if (days < 730) return `${(days / 30.44).toFixed(1)} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
