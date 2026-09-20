import { describe, expect, it } from 'vitest';
import {
  analyseDetection,
  casesForWindow,
  formatCount,
  formatDays,
  power,
  requiredCases,
} from '../detection';
import { DEFAULT_EVAL } from '../presets';
import type { EvalConfig } from '../types';

const base: EvalConfig = { ...DEFAULT_EVAL };

describe('power', () => {
  it('collapses to alpha when there is no real drop', () => {
    expect(power(0.9, 0.9, 100, 0.05)).toBeCloseTo(0.05, 10);
    expect(power(0.9, 0.95, 100, 0.05)).toBeCloseTo(0.05, 10);
  });

  it('increases with sample size', () => {
    const small = power(0.92, 0.88, 50, 0.05);
    const medium = power(0.92, 0.88, 200, 0.05);
    const large = power(0.92, 0.88, 1000, 0.05);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  it('increases with the size of the drop', () => {
    expect(power(0.92, 0.85, 200, 0.05)).toBeGreaterThan(power(0.92, 0.9, 200, 0.05));
  });

  it('decreases as alpha tightens', () => {
    expect(power(0.92, 0.86, 200, 0.01)).toBeLessThan(power(0.92, 0.86, 200, 0.05));
  });

  it('stays a probability', () => {
    for (const n of [1, 10, 500, 100_000]) {
      const v = power(0.92, 0.5, n, 0.05);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('requiredCases', () => {
  it('agrees with the closed form it implements', () => {
    // p0=0.92, p1=0.88, alpha=0.05, power=0.8
    // n = ((1.6449*sqrt(.92*.08) + 0.8416*sqrt(.88*.12)) / 0.04)^2
    const zA = 1.6448536;
    const zB = 0.8416212;
    const expected = Math.ceil(
      ((zA * Math.sqrt(0.92 * 0.08) + zB * Math.sqrt(0.88 * 0.12)) / 0.04) ** 2,
    );
    expect(requiredCases(0.92, 0.88, 0.05, 0.8)).toBe(expected);
  });

  it('grows as the drop shrinks', () => {
    const wide = requiredCases(0.92, 0.82, 0.05, 0.8);
    const narrow = requiredCases(0.92, 0.9, 0.05, 0.8);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('is infinite when there is nothing to detect', () => {
    expect(requiredCases(0.9, 0.9, 0.05, 0.8)).toBe(Infinity);
    expect(requiredCases(0.9, 0.95, 0.05, 0.8)).toBe(Infinity);
  });

  it('delivers roughly the power it was sized for', () => {
    const n = requiredCases(0.92, 0.87, 0.05, 0.8);
    expect(power(0.92, 0.87, n, 0.05)).toBeGreaterThanOrEqual(0.8);
    expect(power(0.92, 0.87, n - 1, 0.05)).toBeLessThan(0.81);
  });
});

describe('analyseDetection', () => {
  it('reports no detectable change when nothing is altered', () => {
    const r = analyseDetection({ ...base, intermittency: 0 }, 10_000);
    expect(r.effectiveDrop).toBe(0);
    expect(r.undetectable).toBe(true);
    expect(r.blindWindowDays).toBe(Infinity);
    expect(r.observedRate).toBeCloseTo(base.baseline, 10);
  });

  it('scales the drop by intermittency, as the advisory implies', () => {
    const full = analyseDetection({ ...base, intermittency: 1 }, 10_000);
    const varied = analyseDetection({ ...base, intermittency: 0.25 }, 10_000);
    expect(full.effectiveDrop).toBeCloseTo(base.degradation, 10);
    expect(varied.effectiveDrop).toBeCloseTo(base.degradation * 0.25, 10);
    expect(varied.blindWindowDays).toBeGreaterThan(full.blindWindowDays);
  });

  it('shrinks the blind window as the suite grows', () => {
    const small = analyseDetection({ ...base, casesPerRun: 50 }, 10_000);
    const big = analyseDetection({ ...base, casesPerRun: 2000 }, 10_000);
    expect(big.blindWindowDays).toBeLessThan(small.blindWindowDays);
  });

  it('shrinks the blind window as the suite runs more often', () => {
    const weekly = analyseDetection({ ...base, runsPerWeek: 1 }, 10_000);
    const daily = analyseDetection({ ...base, runsPerWeek: 7 }, 10_000);
    expect(daily.blindWindowDays).toBeLessThan(weekly.blindWindowDays);
  });

  it('counts degraded requests as volume times the window', () => {
    const r = analyseDetection(base, 50_000);
    expect(r.degradedRequests).toBeCloseTo(r.blindWindowDays * 50_000, 6);
  });

  it('needs more runs for 90% confidence than the bare expectation', () => {
    const r = analyseDetection({ ...base, casesPerRun: 60 }, 10_000);
    expect(r.runsFor90Pct).toBeGreaterThanOrEqual(1);
    expect(r.perRunPower).toBeGreaterThan(0);
    expect(r.perRunPower).toBeLessThan(1);
    expect(r.runsFor90Pct).toBeGreaterThan(r.expectedRuns);
    expect(r.blindWindowDays).toBeGreaterThan(r.expectedDays);
  });

  it('headlines the 90% window, not the first-flag expectation', () => {
    const r = analyseDetection(base, 10_000);
    expect(r.blindWindowDays).toBeCloseTo((r.runsFor90Pct / base.runsPerWeek) * 7, 9);
    expect(r.expectedDays).toBeCloseTo((r.expectedRuns / base.runsPerWeek) * 7, 9);
  });

  it('reproduces the geometric run count by hand', () => {
    const r = analyseDetection({ ...base, casesPerRun: 150, runsPerWeek: 7 }, 1);
    const byHand = Math.ceil(Math.log(0.1) / Math.log(1 - r.perRunPower));
    expect(r.runsFor90Pct).toBe(byHand);
  });

  it('never returns a negative observed rate', () => {
    const r = analyseDetection(
      { ...base, baseline: 0.05, degradation: 0.9, intermittency: 1 },
      10,
    );
    expect(r.observedRate).toBeGreaterThanOrEqual(0);
  });

  it('handles a degenerate one-case suite without throwing', () => {
    const r = analyseDetection({ ...base, casesPerRun: 0, runsPerWeek: 0 }, 0);
    expect(Number.isNaN(r.blindWindowDays)).toBe(false);
  });
});

describe('casesForWindow', () => {
  it('is monotone in the target window', () => {
    const tight = casesForWindow(base, 3);
    const loose = casesForWindow(base, 60);
    expect(tight).toBeGreaterThanOrEqual(loose);
  });

  it('actually achieves the window it promises', () => {
    const n = casesForWindow(base, 14);
    expect(Number.isFinite(n)).toBe(true);
    const achieved = analyseDetection({ ...base, casesPerRun: n }, 1000);
    expect(achieved.blindWindowDays).toBeLessThanOrEqual(14 + 1e-6);
  });

  it('gives up rather than inventing a number when nothing is altered', () => {
    expect(casesForWindow({ ...base, intermittency: 0 }, 7)).toBe(Infinity);
  });

  it('gives up when the window is shorter than a single run interval', () => {
    // One run a week cannot resolve anything inside a single day.
    expect(casesForWindow({ ...base, runsPerWeek: 1 }, 1)).toBe(Infinity);
  });

  it('cannot be satisfied by a trivially small suite', () => {
    // The 90%-confidence target is what makes this a real constraint: a
    // one-case run has essentially no power, so it can never qualify.
    expect(casesForWindow(base, 14)).toBeGreaterThan(1);
  });
});

describe('formatters', () => {
  it('formats day counts at sensible scales', () => {
    expect(formatDays(Infinity)).toBe('never');
    expect(formatDays(0.4)).toBe('under a day');
    expect(formatDays(12.4)).toBe('12 days');
    expect(formatDays(90)).toBe('3.0 months');
    expect(formatDays(1096)).toBe('3.0 years');
  });

  it('formats counts with magnitude suffixes', () => {
    expect(formatCount(742)).toBe('742');
    expect(formatCount(12_400)).toBe('12.4K');
    expect(formatCount(3_200_000)).toBe('3.2M');
    expect(formatCount(4_500_000_000)).toBe('4.5B');
    expect(formatCount(Infinity)).toBe('—');
  });
});
