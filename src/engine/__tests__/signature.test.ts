import { describe, expect, it } from 'vitest';
import { INDICATORS, WORKLOADS } from '../catalog';
import {
  bandFor,
  rampPressure,
  scoreFleet,
  TIER_REFERENCE_RPD,
  TRIP_THRESHOLD,
  volumePressure,
} from '../signature';
import { PRESETS } from '../presets';
import type { FleetConfig } from '../types';

const empty: FleetConfig = {
  enabled: [],
  requestsPerDay: 100,
  planTier: 'enterprise',
  accountAgeDays: 900,
};

describe('catalog integrity', () => {
  it('has unique indicator ids', () => {
    const ids = INDICATORS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique workload ids', () => {
    const ids = WORKLOADS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references indicators that exist', () => {
    const known = new Set(INDICATORS.map((i) => i.id));
    for (const w of WORKLOADS) {
      for (const key of Object.keys(w.signals)) {
        expect(known.has(key as never)).toBe(true);
      }
    }
  });

  it('keeps every signal weight inside the unit interval', () => {
    for (const w of WORKLOADS) {
      for (const v of Object.values(w.signals)) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every indicator prose a reader can act on', () => {
    for (const i of INDICATORS) {
      expect(i.advisory.length).toBeGreaterThan(20);
      expect(i.benignCause.length).toBeGreaterThan(20);
      expect(i.mitigation.length).toBeGreaterThan(20);
      expect(i.weight).toBeGreaterThan(0);
    }
  });

  it('covers every indicator with at least one workload', () => {
    const covered = new Set(WORKLOADS.flatMap((w) => Object.keys(w.signals)));
    // subscription-usage-ratio and no-ramp can also come from volume alone.
    for (const i of INDICATORS) {
      expect(covered.has(i.id)).toBe(true);
    }
  });
});

describe('volumePressure', () => {
  it('is zero at or below the tier reference', () => {
    expect(volumePressure(TIER_REFERENCE_RPD.team, 'team')).toBe(0);
    expect(volumePressure(100, 'team')).toBe(0);
  });

  it('rises with volume and saturates at one', () => {
    const a = volumePressure(TIER_REFERENCE_RPD.team * 2, 'team');
    const b = volumePressure(TIER_REFERENCE_RPD.team * 6, 'team');
    expect(b).toBeGreaterThan(a);
    expect(volumePressure(TIER_REFERENCE_RPD.team * 1000, 'team')).toBe(1);
  });

  it('is lower on a bigger plan for the same traffic', () => {
    const rpd = 300_000;
    expect(volumePressure(rpd, 'enterprise')).toBeLessThan(volumePressure(rpd, 'team'));
  });
});

describe('rampPressure', () => {
  it('is zero once the credential has aged past a month', () => {
    expect(rampPressure(500_000, 'individual', 30)).toBe(0);
    expect(rampPressure(500_000, 'individual', 400)).toBe(0);
  });

  it('is highest on a brand-new credential at full volume', () => {
    const day1 = rampPressure(50_000, 'team', 1);
    const day20 = rampPressure(50_000, 'team', 20);
    expect(day1).toBeGreaterThan(day20);
    expect(day1).toBeLessThanOrEqual(1);
  });

  it('needs volume as well as youth', () => {
    expect(rampPressure(0, 'team', 1)).toBe(0);
  });
});

describe('scoreFleet', () => {
  it('scores an empty fleet at zero with no evidence', () => {
    const r = scoreFleet(empty);
    expect(r.overall).toBe(0);
    expect(r.band).toBe('low');
    expect(r.tripped).toHaveLength(0);
    for (const s of r.scores) {
      expect(s.strength).toBe(0);
      expect(s.evidence).toHaveLength(0);
    }
  });

  it('returns one score per indicator, in catalog order', () => {
    const r = scoreFleet(PRESETS[0].fleet);
    expect(r.scores.map((s) => s.indicator.id)).toEqual(INDICATORS.map((i) => i.id));
  });

  it('keeps the overall score in the unit interval for every preset', () => {
    for (const p of PRESETS) {
      const r = scoreFleet(p.fleet);
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(1);
    }
  });

  it('never lowers the score when a workload is added', () => {
    const before = scoreFleet({ ...empty, enabled: ['nightly-eval'] });
    const after = scoreFleet({ ...empty, enabled: ['nightly-eval', 'shared-team-key'] });
    expect(after.overall).toBeGreaterThanOrEqual(before.overall);
  });

  it('attributes every non-zero indicator to a named cause', () => {
    const r = scoreFleet(PRESETS[2].fleet);
    for (const s of r.scores) {
      if (s.strength > 0) expect(s.evidence.length).toBeGreaterThan(0);
      else expect(s.evidence).toHaveLength(0);
    }
  });

  it('sorts evidence strongest first', () => {
    const r = scoreFleet({
      ...empty,
      enabled: ['ci-code-review', 'shared-team-key'],
    });
    const shared = r.scores.find((s) => s.indicator.id === 'shared-credential');
    expect(shared?.evidence[0]).toBe('One API key shared across the team');
  });

  it('trips an indicator only at or above the threshold', () => {
    const r = scoreFleet(PRESETS[0].fleet);
    for (const s of r.tripped) expect(s.strength).toBeGreaterThanOrEqual(TRIP_THRESHOLD);
    const untripped = r.scores.filter((s) => !r.tripped.includes(s));
    for (const s of untripped) expect(s.strength).toBeLessThan(TRIP_THRESHOLD);
  });

  it('rates a careful enterprise setup below a sprawling one', () => {
    const careful = scoreFleet(PRESETS[3].fleet);
    const platform = scoreFleet(PRESETS[0].fleet);
    expect(careful.overall).toBeLessThan(platform.overall);
  });

  it('makes the plan tier a real lever on the same traffic', () => {
    const onTeam = scoreFleet({ ...PRESETS[0].fleet, planTier: 'individual' });
    const onEnterprise = scoreFleet({ ...PRESETS[0].fleet, planTier: 'enterprise' });
    expect(onEnterprise.overall).toBeLessThan(onTeam.overall);
  });

  it('ignores unknown workload ids instead of throwing', () => {
    const r = scoreFleet({ ...empty, enabled: ['not-a-workload' as never] });
    expect(r.overall).toBe(0);
  });
});

describe('bandFor', () => {
  it('splits the range into three ordered bands', () => {
    expect(bandFor(0)).toBe('low');
    expect(bandFor(0.24)).toBe('low');
    expect(bandFor(0.25)).toBe('partial');
    expect(bandFor(0.54)).toBe('partial');
    expect(bandFor(0.55)).toBe('strong');
    expect(bandFor(1)).toBe('strong');
  });
});
