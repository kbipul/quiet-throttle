import { INDICATORS, WORKLOAD_BY_ID } from './catalog';
import { clamp01, noisyOr } from './stats';
import type {
  FleetConfig,
  IndicatorScore,
  PlanTier,
  SignatureBand,
  SignatureResult,
} from './types';

/**
 * Requests per day a plan tier "looks like" from the outside. These are
 * ordinary-scale reference points, not any provider's published limits —
 * they exist so the subscription-to-usage ratio indicator has something to
 * be a ratio against.
 */
export const TIER_REFERENCE_RPD: Record<PlanTier, number> = {
  individual: 2_000,
  team: 25_000,
  enterprise: 400_000,
};

export const TIER_LABEL: Record<PlanTier, string> = {
  individual: 'Individual seat',
  team: 'Team plan',
  enterprise: 'Enterprise agreement',
};

/** An indicator is "tripped" once it is clearly firing rather than murmuring. */
export const TRIP_THRESHOLD = 0.5;

/**
 * Volume pressure on the subscription-to-usage indicator: how far past the
 * tier's reference throughput the fleet is running. Saturates at 8x so a
 * single enormous number cannot pin the whole score on its own.
 */
export function volumePressure(requestsPerDay: number, tier: PlanTier): number {
  const ref = TIER_REFERENCE_RPD[tier];
  const ratio = requestsPerDay / ref;
  if (ratio <= 1) return 0;
  return clamp01(Math.log(ratio) / Math.log(8));
}

/**
 * Ramp pressure on the no-ramp indicator: high volume on a young credential.
 * A month-old account gets essentially no penalty; a day-old one running
 * production volume gets most of it.
 */
export function rampPressure(
  requestsPerDay: number,
  tier: PlanTier,
  accountAgeDays: number,
): number {
  const ref = TIER_REFERENCE_RPD[tier];
  const load = clamp01(requestsPerDay / ref);
  const youth = clamp01((30 - accountAgeDays) / 30);
  return load * youth;
}

export function scoreFleet(config: FleetConfig): SignatureResult {
  const enabled = config.enabled
    .map((id) => WORKLOAD_BY_ID[id])
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  const scores: IndicatorScore[] = INDICATORS.map((indicator) => {
    const contributions: { weight: number; label: string }[] = [];

    for (const workload of enabled) {
      const w = workload.signals[indicator.id];
      if (w && w > 0) contributions.push({ weight: w, label: workload.name });
    }

    if (indicator.id === 'subscription-usage-ratio') {
      const p = volumePressure(config.requestsPerDay, config.planTier);
      if (p > 0) {
        contributions.push({
          weight: p,
          label: `${fmtInt(config.requestsPerDay)} requests/day on a ${TIER_LABEL[
            config.planTier
          ].toLowerCase()}`,
        });
      }
    }

    if (indicator.id === 'no-ramp') {
      const p = rampPressure(
        config.requestsPerDay,
        config.planTier,
        config.accountAgeDays,
      );
      if (p > 0) {
        contributions.push({
          weight: p,
          label: `credential is ${fmtInt(config.accountAgeDays)} day${
            config.accountAgeDays === 1 ? '' : 's'
          } old and already at volume`,
        });
      }
    }

    contributions.sort((a, b) => b.weight - a.weight);

    return {
      indicator,
      strength: noisyOr(contributions.map((c) => c.weight)),
      evidence: contributions.map((c) => c.label),
    };
  });

  const totalWeight = INDICATORS.reduce((sum, i) => sum + i.weight, 0);
  const overall =
    scores.reduce((sum, s) => sum + s.strength * s.indicator.weight, 0) / totalWeight;

  return {
    scores,
    overall,
    band: bandFor(overall),
    tripped: scores
      .filter((s) => s.strength >= TRIP_THRESHOLD)
      .sort((a, b) => b.strength * b.indicator.weight - a.strength * a.indicator.weight),
  };
}

export function bandFor(overall: number): SignatureBand {
  if (overall < 0.25) return 'low';
  if (overall < 0.55) return 'partial';
  return 'strong';
}

export const BAND_COPY: Record<SignatureBand, { title: string; body: string }> = {
  low: {
    title: 'Little overlap',
    body: 'Your fleet emits few of the signals the advisory tells providers to watch for. Nothing here needs changing.',
  },
  partial: {
    title: 'Partial overlap',
    body: 'Several published indicators fire on ordinary workloads you are running deliberately. Worth knowing which, and worth the cheap fixes.',
  },
  strong: {
    title: 'Strong overlap',
    body: 'Your fleet matches most of the published signature. That says nothing about intent and nothing about whether any provider has acted — it says a detector built from this advisory would have plenty to look at.',
  },
};

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
