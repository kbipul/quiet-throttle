import { describe, expect, it } from 'vitest';
import { clamp01, erf, noisyOr, normalCdf, normalQuantile } from '../stats';

describe('erf', () => {
  it('matches published values to twelve decimals', () => {
    expect(erf(0)).toBe(0);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 12);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erf(2)).toBeCloseTo(0.995322265018953, 12);
    expect(erf(3)).toBeCloseTo(0.9999779095030014, 12);
  });

  it('is odd', () => {
    for (const x of [0.25, 1.3, 2.7]) expect(erf(-x)).toBeCloseTo(-erf(x), 14);
  });

  it('saturates without overshooting one', () => {
    expect(erf(10)).toBeLessThanOrEqual(1);
    expect(erf(10)).toBeGreaterThan(0.999999);
  });
});

describe('normalCdf', () => {
  it('is exactly 0.5 at the mean', () => {
    expect(normalCdf(0)).toBe(0.5);
  });

  it('matches published table values to ten decimals', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 10);
    expect(normalCdf(1.6448536269514722)).toBeCloseTo(0.95, 10);
    expect(normalCdf(1.9599639845400545)).toBeCloseTo(0.975, 10);
    expect(normalCdf(2.5758293035489004)).toBeCloseTo(0.995, 10);
  });

  it('is symmetric', () => {
    for (const x of [0.3, 1.1, 2.4, 3.7]) {
      expect(normalCdf(-x)).toBeCloseTo(1 - normalCdf(x), 9);
    }
  });

  it('is monotonically increasing', () => {
    let prev = -1;
    for (let x = -4; x <= 4; x += 0.25) {
      const v = normalCdf(x);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
});

describe('normalQuantile', () => {
  it('matches published critical values to eight decimals', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 10);
    expect(normalQuantile(0.95)).toBeCloseTo(1.6448536269514722, 8);
    expect(normalQuantile(0.975)).toBeCloseTo(1.9599639845400545, 8);
    expect(normalQuantile(0.99)).toBeCloseTo(2.3263478740408408, 8);
    expect(normalQuantile(0.8)).toBeCloseTo(0.8416212335729143, 8);
  });

  it('round-trips through the CDF', () => {
    for (const p of [0.001, 0.02, 0.1, 0.33, 0.5, 0.67, 0.9, 0.98, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 10);
    }
  });

  it('returns infinities outside the open unit interval', () => {
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
  });
});

describe('noisyOr', () => {
  it('is zero for no evidence', () => {
    expect(noisyOr([])).toBe(0);
  });

  it('passes a single weight through unchanged', () => {
    expect(noisyOr([0.4])).toBeCloseTo(0.4, 10);
  });

  it('combines two weak sources into a stronger one', () => {
    expect(noisyOr([0.5, 0.5])).toBeCloseTo(0.75, 10);
  });

  it('never exceeds one', () => {
    expect(noisyOr([0.9, 0.9, 0.9, 0.9])).toBeLessThanOrEqual(1);
    expect(noisyOr([1, 0.5])).toBe(1);
  });

  it('is order independent', () => {
    expect(noisyOr([0.2, 0.7, 0.4])).toBeCloseTo(noisyOr([0.7, 0.4, 0.2]), 12);
  });
});

describe('clamp01', () => {
  it('clamps both ends and rejects non-finite input', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});
