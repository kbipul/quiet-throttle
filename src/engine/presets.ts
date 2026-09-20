import type { EvalConfig, FleetConfig } from './types';

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  fleet: FleetConfig;
  evaluation: EvalConfig;
}

export const DEFAULT_EVAL: EvalConfig = {
  baseline: 0.92,
  degradation: 0.08,
  intermittency: 0.3,
  casesPerRun: 120,
  runsPerWeek: 7,
  alpha: 0.05,
};

export const PRESETS: Preset[] = [
  {
    id: 'platform-team',
    name: 'Enterprise AI platform team',
    blurb:
      'Central gateway, shared CI credential, nightly evals. The shape most internal AI platforms end up in by month six.',
    fleet: {
      enabled: [
        'nightly-eval',
        'ci-code-review',
        'support-chatbot',
        'gateway-proxy',
        'shared-team-key',
        'quality-harness',
      ],
      requestsPerDay: 90_000,
      planTier: 'team',
      accountAgeDays: 210,
    },
    evaluation: { ...DEFAULT_EVAL, casesPerRun: 150, runsPerWeek: 7 },
  },
  {
    id: 'startup-agent',
    name: 'Startup shipping an agent',
    blurb:
      'Brand-new account, one key, a fallback router, and volume that arrived before procurement did.',
    fleet: {
      enabled: [
        'ci-code-review',
        'shared-team-key',
        'fallback-router',
        'newest-model-chase',
        'rag-backfill',
      ],
      requestsPerDay: 40_000,
      planTier: 'individual',
      accountAgeDays: 9,
    },
    evaluation: { ...DEFAULT_EVAL, casesPerRun: 40, runsPerWeek: 1 },
  },
  {
    id: 'research-lab',
    name: 'Research + fine-tuning group',
    blurb:
      'Generating synthetic data and capturing reasoning traces — the two behaviours the advisory describes most directly.',
    fleet: {
      enabled: [
        'synthetic-data',
        'reasoning-capture',
        'nightly-eval',
        'newest-model-chase',
        'quality-harness',
      ],
      requestsPerDay: 250_000,
      planTier: 'team',
      accountAgeDays: 60,
    },
    evaluation: { ...DEFAULT_EVAL, casesPerRun: 500, runsPerWeek: 3 },
  },
  {
    id: 'regulated-shop',
    name: 'Regulated enterprise, done carefully',
    blurb:
      'Enterprise agreement, per-workload credentials, human-paced traffic. Roughly the target state.',
    fleet: {
      enabled: ['support-chatbot', 'nightly-eval', 'reasoning-capture'],
      requestsPerDay: 120_000,
      planTier: 'enterprise',
      accountAgeDays: 540,
    },
    evaluation: { ...DEFAULT_EVAL, casesPerRun: 300, runsPerWeek: 7 },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
