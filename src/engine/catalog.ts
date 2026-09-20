import type { Indicator, IndicatorId, Workload, WorkloadId } from './types';

/**
 * The ten signals, paraphrased from AA26-251A (8 Sep 2026).
 *
 * The first four are the advisory's own enumerated detection indicators — the
 * things it tells providers to monitor — so they carry the most weight. The
 * rest come from its "tactics and techniques" and "novel techniques" sections.
 */
export const INDICATORS: Indicator[] = [
  {
    id: 'sustained-247',
    label: 'Round-the-clock usage with no human rhythm',
    advisory:
      'Sustained usage around the clock without human variation or idle periods.',
    origin: 'detection-indicator',
    weight: 3,
    benignCause:
      'Any scheduled job does this. A nightly eval suite is machine-paced by design — that is the entire point of automating it.',
    mitigation:
      'Jitter scheduled start times and let batch jobs idle between phases. It costs nothing and restores a usage curve that looks like a system rather than a scraper.',
  },
  {
    id: 'no-ramp',
    label: 'New account straight to maximum throughput',
    advisory:
      'New subscriptions immediately running at maximum usage, with no gradual ramp.',
    origin: 'detection-indicator',
    weight: 3,
    benignCause:
      'You migrated an existing workload onto a new key. The workload is old; the credential is one day old.',
    mitigation:
      'Cut over gradually, or open the account, tell your account team the expected volume, and let the first week ramp.',
  },
  {
    id: 'shared-credential',
    label: 'One credential, many IPs and user agents',
    advisory:
      'Shared accounts accessed from multiple IP addresses and user agents.',
    origin: 'detection-indicator',
    weight: 3,
    benignCause:
      'A single team key in CI. Every ephemeral runner is a fresh IP and a different user agent, and nobody thinks of that as sharing.',
    mitigation:
      'One credential per workload, and pin egress through a stable NAT or static outbound IP so the fleet reads as one system.',
  },
  {
    id: 'subscription-usage-ratio',
    label: 'Enterprise-scale throughput on a non-enterprise plan',
    advisory:
      'Anomalous subscription-to-usage ratios: enterprise-scale throughput from accounts that are not enterprise customers.',
    origin: 'detection-indicator',
    weight: 3,
    benignCause:
      'A small team can generate genuinely enterprise volume from one seat. Procurement lags engineering by a quarter or two.',
    mitigation:
      'Move production volume onto the commercial agreement that matches it. This is the single largest lever on the score.',
  },
  {
    id: 'proxy-routing',
    label: 'Traffic routed through an aggregator or gateway',
    advisory:
      'Requests routed through remote cloud providers and third-party aggregators that obfuscate user metadata.',
    origin: 'tactic',
    weight: 2,
    benignCause:
      'An LLM gateway is standard practice for cost control, key management and routing. It also strips exactly the metadata the advisory wants preserved.',
    mitigation:
      'Configure the gateway to forward per-team attribution headers rather than presenting the whole company as one anonymous caller.',
  },
  {
    id: 'metadata-sanitization',
    label: 'Automated request-metadata stripping',
    advisory:
      'Automated request metadata sanitization — named in the advisory as one of four novel techniques.',
    origin: 'novel-technique',
    weight: 2,
    benignCause:
      'Privacy engineering. Stripping identifiers before they leave your network is what your own DPO asked for.',
    mitigation:
      'Strip user-level PII, keep tenant-level attribution. Those are different things and only one of them looks like evasion.',
  },
  {
    id: 'cot-extraction',
    label: 'Prompts that ask the model to expose its reasoning',
    advisory:
      'Prompts instructing models to articulate the internal reasoning behind a completed response, used to extract chain-of-thought.',
    origin: 'tactic',
    weight: 2,
    benignCause:
      'Explainability. Asking a model to justify a decision is how regulated teams produce an audit trail, and it is table stakes for debugging an agent.',
    mitigation:
      'Nothing to change in what you ask for — but know that "explain your reasoning step by step, then restate it" at batch scale is on the list.',
  },
  {
    id: 'automated-failover',
    label: 'Automatic failover between providers',
    advisory:
      'Automated failover between pathways during blocking attempts, so throughput never stops.',
    origin: 'tactic',
    weight: 2,
    benignCause:
      'Resilience. A multi-provider router is the availability control your architecture review asked for.',
    mitigation:
      'Failover on 5xx and timeouts. Failing over on 429 and 403 is the behaviour the advisory describes; back off instead.',
  },
  {
    id: 'day-one-retarget',
    label: 'Retargeting a new model within a day of release',
    advisory:
      'Redirecting exchanges to a newly released model within 24 hours of its launch.',
    origin: 'tactic',
    weight: 1,
    benignCause:
      'Being good at your job. Everyone benchmarks the new model on release day.',
    mitigation:
      'Low weight on its own. It only matters as corroboration when the volume indicators are already firing.',
  },
  {
    id: 'countermeasure-eval',
    label: 'A harness that measures response quality over time',
    advisory:
      'Quality evaluation frameworks designed to detect defensive countermeasures.',
    origin: 'tactic',
    weight: 1,
    benignCause:
      'This is the uncomfortable one: a regression suite that watches for output quality drift is both ordinary engineering hygiene and, described from the other side of the API, the exact capability the advisory flags.',
    mitigation:
      'No mitigation offered, and none should be. Run the suite. Just be aware that the tool which would catch a silent downgrade is itself on the list.',
  },
];

export const INDICATOR_BY_ID: Record<IndicatorId, Indicator> = Object.fromEntries(
  INDICATORS.map((i) => [i.id, i]),
) as Record<IndicatorId, Indicator>;

/** Ordinary enterprise AI workloads, and the signals each one emits. */
export const WORKLOADS: Workload[] = [
  {
    id: 'nightly-eval',
    name: 'Nightly regression eval suite',
    blurb: 'Fixed schedule, machine-paced, identical volume every night.',
    signals: { 'sustained-247': 0.75, 'countermeasure-eval': 0.6 },
  },
  {
    id: 'synthetic-data',
    name: 'Synthetic training-data generation',
    blurb: 'Bulk generation of examples to fine-tune a smaller in-house model.',
    signals: { 'sustained-247': 0.5, 'subscription-usage-ratio': 0.55 },
  },
  {
    id: 'ci-code-review',
    name: 'CI code-review agent',
    blurb: 'Fires on every push, from a fresh ephemeral runner each time.',
    signals: { 'shared-credential': 0.8, 'sustained-247': 0.35 },
  },
  {
    id: 'support-chatbot',
    name: 'Customer support assistant',
    blurb: 'Human-paced traffic that follows business hours in each region.',
    signals: {},
  },
  {
    id: 'rag-backfill',
    name: 'RAG corpus embedding backfill',
    blurb: 'A one-off burst that reprocesses the whole document estate.',
    signals: { 'subscription-usage-ratio': 0.6, 'no-ramp': 0.45 },
  },
  {
    id: 'fallback-router',
    name: 'Multi-provider fallback router',
    blurb: 'Reroutes to the next provider the moment one starts refusing.',
    signals: { 'automated-failover': 0.85, 'proxy-routing': 0.3 },
  },
  {
    id: 'quality-harness',
    name: 'Output-quality drift monitor',
    blurb: 'Tracks answer quality per model version to catch silent regressions.',
    signals: { 'countermeasure-eval': 0.85, 'sustained-247': 0.25 },
  },
  {
    id: 'shared-team-key',
    name: 'One API key shared across the team',
    blurb: 'Developers, CI and staging all authenticate as the same principal.',
    signals: { 'shared-credential': 0.9, 'subscription-usage-ratio': 0.35 },
  },
  {
    id: 'gateway-proxy',
    name: 'LLM gateway in front of the provider',
    blurb: 'Central egress for cost control, key rotation and routing.',
    signals: { 'proxy-routing': 0.8, 'metadata-sanitization': 0.65 },
  },
  {
    id: 'newest-model-chase',
    name: 'Benchmark every new model on release day',
    blurb: 'A standing job that repoints the eval suite at whatever just shipped.',
    signals: { 'day-one-retarget': 0.9, 'countermeasure-eval': 0.3 },
  },
  {
    id: 'reasoning-capture',
    name: 'Reasoning capture for audit trails',
    blurb: 'Asks the model to restate the reasoning behind each decision it made.',
    signals: { 'cot-extraction': 0.85 },
  },
];

export const WORKLOAD_BY_ID: Record<WorkloadId, Workload> = Object.fromEntries(
  WORKLOADS.map((w) => [w.id, w]),
) as Record<WorkloadId, Workload>;
