import { formatCount, formatDays } from '../engine/detection';
import type { DetectionResult, EvalConfig } from '../engine/types';

interface Props {
  evaluation: EvalConfig;
  detection: DetectionResult;
  requestsPerDay: number;
  casesFor14Days: number;
  onPatch: (patch: Partial<EvalConfig>) => void;
}

export function BlindWindowPanel({
  evaluation,
  detection,
  casesFor14Days,
  onPatch,
}: Props) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <section className="panel" aria-labelledby="blind-h">
      <h2 id="blind-h">
        <span className="step">3</span> Your blind window
      </h2>
      <p className="panel-note">
        How long a silent downgrade survives inside the noise of your own regression
        suite.
      </p>

      <div className="field">
        <label htmlFor="baseline">
          Suite pass rate today <output>{pct(evaluation.baseline)}</output>
        </label>
        <input
          id="baseline"
          type="range"
          min={0.5}
          max={0.99}
          step={0.01}
          value={evaluation.baseline}
          onChange={(e) => onPatch({ baseline: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="degradation">
          Quality drop on an altered response <output>{pct(evaluation.degradation)}</output>
        </label>
        <input
          id="degradation"
          type="range"
          min={0.01}
          max={0.4}
          step={0.01}
          value={evaluation.degradation}
          onChange={(e) => onPatch({ degradation: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="intermittency">
          Share of responses altered <output>{pct(evaluation.intermittency)}</output>
        </label>
        <input
          id="intermittency"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={evaluation.intermittency}
          onChange={(e) => onPatch({ intermittency: Number(e.target.value) })}
        />
        <span className="hint">
          The advisory tells providers to vary this precisely so quality evaluation
          cannot lock on.
        </span>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="cases">
            Cases per run <output>{evaluation.casesPerRun}</output>
          </label>
          <input
            id="cases"
            type="range"
            min={10}
            max={2000}
            step={10}
            value={evaluation.casesPerRun}
            onChange={(e) => onPatch({ casesPerRun: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="runs">
            Runs per week <output>{evaluation.runsPerWeek}</output>
          </label>
          <input
            id="runs"
            type="range"
            min={1}
            max={14}
            step={1}
            value={evaluation.runsPerWeek}
            onChange={(e) => onPatch({ runsPerWeek: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className={detection.undetectable ? 'readout dire' : 'readout'}>
        <div className="readout-hero">
          <span className="readout-value">{formatDays(detection.blindWindowDays)}</span>
          <span className="readout-caption">
            before your suite could tell this apart from noise, at 90% confidence
          </span>
        </div>
        <dl className="readout-grid">
          <div>
            <dt>Observed pass rate</dt>
            <dd>{(detection.observedRate * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Effective drop</dt>
            <dd>{(detection.effectiveDrop * 100).toFixed(1)} pts</dd>
          </div>
          <div>
            <dt>Power per run</dt>
            <dd>{(detection.perRunPower * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Runs needed</dt>
            <dd>
              {Number.isFinite(detection.runsFor90Pct)
                ? detection.runsFor90Pct.toLocaleString('en-US')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>First flag, on average</dt>
            <dd>{formatDays(detection.expectedDays)}</dd>
          </div>
          <div>
            <dt>Degraded requests served</dt>
            <dd>{formatCount(detection.degradedRequests)}</dd>
          </div>
        </dl>
        {!detection.undetectable && (
        <p className="readout-aside">
          One run reaching significance is a signal, not a finding — at{' '}
          {(detection.perRunPower * 100).toFixed(0)}% power per run and a{' '}
          {(evaluation.alpha * 100).toFixed(0)}% false-positive rate, the first flag
          arrives around {formatDays(detection.expectedDays)} and needs confirming. A
          suite of {formatCount(detection.casesForSingleRunPower)} cases would settle it
          in a single run.
        </p>
        )}

        {detection.undetectable ? (
          <p className="readout-foot">
            At this drop and this cadence there is nothing for the suite to find. That is
            the design goal of the recommended countermeasure, not a flaw in your evals.
          </p>
        ) : (
          <p className="readout-foot">
            To pull the window under two weeks you would need{' '}
            <strong>
              {Number.isFinite(casesFor14Days)
                ? `${casesFor14Days.toLocaleString('en-US')} cases per run`
                : 'more runs per week than this schedule allows'}
            </strong>
            {Number.isFinite(casesFor14Days) && casesFor14Days > evaluation.casesPerRun
              ? ` — ${(casesFor14Days / evaluation.casesPerRun).toFixed(1)}× your current suite.`
              : '.'}
          </p>
        )}
      </div>
    </section>
  );
}
