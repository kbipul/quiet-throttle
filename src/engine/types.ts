/**
 * Types for the AA26-251A signature model.
 *
 * Source: NSA / CISA / FBI joint advisory AA26-251A, "China-Based Artificial
 * Intelligence Companies Conducting Industrial-Scale Distillation Campaigns
 * Against U.S. AI Companies", published 8 September 2026.
 * https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-251a
 *
 * Every indicator below is paraphrased from that advisory's published
 * "detection indicators", "tactics and techniques" and "novel techniques"
 * sections. Nothing here is a claim about any provider's actual internal
 * thresholds — no provider publishes those.
 */

export type IndicatorId =
  | 'sustained-247'
  | 'no-ramp'
  | 'shared-credential'
  | 'subscription-usage-ratio'
  | 'proxy-routing'
  | 'metadata-sanitization'
  | 'cot-extraction'
  | 'automated-failover'
  | 'day-one-retarget'
  | 'countermeasure-eval';

/** Which part of the advisory the indicator comes from. */
export type IndicatorOrigin = 'detection-indicator' | 'tactic' | 'novel-technique';

export interface Indicator {
  id: IndicatorId;
  label: string;
  /** What the advisory says providers should look for. */
  advisory: string;
  origin: IndicatorOrigin;
  /**
   * Relative weight in the overall signature match. The advisory's own
   * enumerated "detection indicators" carry more weight than tactics
   * described in the narrative, because those are the ones providers are
   * explicitly told to monitor.
   */
  weight: number;
  /** Why a legitimate enterprise fleet produces this signal anyway. */
  benignCause: string;
  /** Concrete step that reduces this signal without changing what you build. */
  mitigation: string;
}

export type WorkloadId =
  | 'nightly-eval'
  | 'synthetic-data'
  | 'ci-code-review'
  | 'support-chatbot'
  | 'rag-backfill'
  | 'fallback-router'
  | 'quality-harness'
  | 'shared-team-key'
  | 'gateway-proxy'
  | 'newest-model-chase'
  | 'reasoning-capture';

export interface Workload {
  id: WorkloadId;
  name: string;
  blurb: string;
  /**
   * Evidence this workload contributes to each indicator, 0..1.
   * Combined across workloads with a noisy-OR, so two weak sources
   * add up but never exceed 1.
   */
  signals: Partial<Record<IndicatorId, number>>;
}

export type PlanTier = 'individual' | 'team' | 'enterprise';

export interface FleetConfig {
  enabled: WorkloadId[];
  /** Total requests per day across the whole fleet. */
  requestsPerDay: number;
  planTier: PlanTier;
  /** Days the account has existed. Short life + high volume = the "no ramp" signal. */
  accountAgeDays: number;
}

export interface IndicatorScore {
  indicator: Indicator;
  /** 0..1 combined evidence strength. */
  strength: number;
  /** Human-readable causes, strongest first. */
  evidence: string[];
}

export type SignatureBand = 'low' | 'partial' | 'strong';

export interface SignatureResult {
  scores: IndicatorScore[];
  /** Weighted mean of indicator strengths, 0..1. */
  overall: number;
  band: SignatureBand;
  /** Indicators at or above the "this is visibly firing" line. */
  tripped: IndicatorScore[];
}

export interface EvalConfig {
  /** Baseline pass rate of your own eval suite, 0..1. */
  baseline: number;
  /** Absolute drop in pass rate on an altered response, 0..1. */
  degradation: number;
  /**
   * Fraction of requests altered. The advisory tells providers to vary the
   * alteration across requests specifically to defeat quality evaluation,
   * so this is normally well below 1.
   */
  intermittency: number;
  /** Cases per eval run. */
  casesPerRun: number;
  /** Eval runs per week. */
  runsPerWeek: number;
  /** One-sided significance level. */
  alpha: number;
}

export interface DetectionResult {
  /** Pass rate you would actually observe, 0..1. */
  observedRate: number;
  /** Absolute effective drop, 0..1. */
  effectiveDrop: number;
  /** Probability a single eval run reaches significance. */
  perRunPower: number;
  /** Expected runs until the first significant run. Infinity when hopeless. */
  expectedRuns: number;
  /** Calendar days of that expectation — the optimistic read. Infinity when hopeless. */
  expectedDays: number;
  /** Runs needed for a 90% cumulative chance of catching it. */
  runsFor90Pct: number;
  /**
   * Calendar days to a 90% cumulative chance of having caught it. This is the
   * headline number: the expectation above is the run that happens to cross
   * the line first, which is not a result anyone would act on alone.
   */
  blindWindowDays: number;
  /** Requests served on degraded output inside the blind window. */
  degradedRequests: number;
  /** Cases per run needed to hit 80% power on a single run. */
  casesForSingleRunPower: number;
  /** True when the drop is too small for this suite to ever resolve. */
  undetectable: boolean;
}
