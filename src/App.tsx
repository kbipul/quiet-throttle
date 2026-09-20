import { useMemo, useState } from 'react';
import './App.css';
import { WORKLOADS } from './engine/catalog';
import {
  analyseDetection,
  casesForWindow,
  formatCount,
  formatDays,
} from './engine/detection';
import { DEFAULT_PRESET, PRESETS } from './engine/presets';
import { BAND_COPY, scoreFleet, TIER_LABEL } from './engine/signature';
import type { EvalConfig, FleetConfig, PlanTier, WorkloadId } from './engine/types';
import { FleetPanel } from './components/FleetPanel';
import { SignaturePanel } from './components/SignaturePanel';
import { BlindWindowPanel } from './components/BlindWindowPanel';

const ADVISORY_URL =
  'https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-251a';

export default function App() {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [fleet, setFleet] = useState<FleetConfig>(DEFAULT_PRESET.fleet);
  const [evaluation, setEvaluation] = useState<EvalConfig>(DEFAULT_PRESET.evaluation);

  const signature = useMemo(() => scoreFleet(fleet), [fleet]);
  const detection = useMemo(
    () => analyseDetection(evaluation, fleet.requestsPerDay),
    [evaluation, fleet.requestsPerDay],
  );
  const casesFor14Days = useMemo(() => casesForWindow(evaluation, 14), [evaluation]);

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(preset.id);
    setFleet(preset.fleet);
    setEvaluation(preset.evaluation);
  }

  function toggleWorkload(id: WorkloadId) {
    setPresetId('custom');
    setFleet((f) => ({
      ...f,
      enabled: f.enabled.includes(id)
        ? f.enabled.filter((w) => w !== id)
        : [...f.enabled, id],
    }));
  }

  function patchFleet(patch: Partial<FleetConfig>) {
    setPresetId('custom');
    setFleet((f) => ({ ...f, ...patch }));
  }

  function patchEval(patch: Partial<EvalConfig>) {
    setPresetId('custom');
    setEvaluation((e) => ({ ...e, ...patch }));
  }

  const band = BAND_COPY[signature.band];

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">
          Advisory{' '}
          <a href={ADVISORY_URL} target="_blank" rel="noreferrer">
            AA26-251A
          </a>{' '}
          · NSA / CISA / FBI · 8 September 2026
        </p>
        <h1>Quiet Throttle</h1>
        <p className="deck">
          The advisory tells US model providers to answer suspected distillation by
          serving a <strong>downgraded model without telling the customer</strong>, and to
          vary the alteration so quality evaluation cannot pin it down. Its published
          detection indicators describe an ordinary enterprise AI fleet almost exactly.
          Lay yours out, then find out how long a silent downgrade would hide inside your
          own eval noise.
        </p>
        <div className="presets" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === presetId ? 'preset on' : 'preset'}
              onClick={() => applyPreset(p.id)}
              title={p.blurb}
            >
              {p.name}
            </button>
          ))}
          {presetId === 'custom' && <span className="preset custom">Custom</span>}
        </div>
      </header>

      <main className="grid">
        <FleetPanel
          fleet={fleet}
          workloads={WORKLOADS}
          tierLabel={TIER_LABEL}
          onToggle={toggleWorkload}
          onPatch={patchFleet}
        />

        <SignaturePanel signature={signature} bandTitle={band.title} bandBody={band.body} />

        <BlindWindowPanel
          evaluation={evaluation}
          detection={detection}
          requestsPerDay={fleet.requestsPerDay}
          casesFor14Days={casesFor14Days}
          onPatch={patchEval}
        />
      </main>

      <section className="verdict" aria-live="polite">
        <div className="verdict-inner">
          <p className="verdict-lead">
            A fleet with {signature.tripped.length} of 10 published indicators firing,
            running {fleet.requestsPerDay.toLocaleString('en-US')} requests a day on a{' '}
            {TIER_LABEL[fleet.planTier as PlanTier].toLowerCase()}.
          </p>
          <p className="verdict-body">
            If a provider acted on that and started degrading{' '}
            {Math.round(evaluation.intermittency * 100)}% of responses, your suite would
            need <strong>{formatDays(detection.blindWindowDays)}</strong> to be 90% sure
            it had seen it — <strong>{formatCount(detection.degradedRequests)}</strong>{' '}
            requests answered by a weaker model in the meantime, with no error, no rate
            limit and no notification.
          </p>
        </div>
      </section>

      <footer className="foot">
        <h2>What this is, and what it is not</h2>
        <ul>
          <li>
            <strong>It is not a prediction.</strong> No provider publishes its detection
            thresholds, and nothing here claims any account has been flagged or degraded.
            The score measures overlap with the indicators the advisory published — that
            is all it can honestly measure.
          </li>
          <li>
            <strong>The plan tier reference volumes are illustrative.</strong> They exist
            so the subscription-to-usage indicator has a denominator. Substitute your own
            contracted numbers when you use this seriously.
          </li>
          <li>
            <strong>The blind-window arithmetic is real and checkable.</strong> A
            one-sided one-sample test of an observed pass rate against a known baseline,
            normal approximation to the binomial, in{' '}
            <code>src/engine/detection.ts</code> with the critical values pinned to
            published tables in the tests.
          </li>
          <li>
            <strong>The uncomfortable part is indicator ten.</strong> A harness that
            watches output quality for drift is the one tool that would catch a silent
            downgrade — and the advisory lists exactly that capability, in the hands of a
            distiller, as a thing to detect.
          </li>
        </ul>
        <p className="cite">
          Indicators paraphrased from{' '}
          <a href={ADVISORY_URL} target="_blank" rel="noreferrer">
            CISA AA26-251A
          </a>
          . Everything runs in this tab; nothing is uploaded.
        </p>
      </footer>
    </div>
  );
}
