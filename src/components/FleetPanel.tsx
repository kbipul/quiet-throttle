import type { FleetConfig, PlanTier, Workload, WorkloadId } from '../engine/types';

const TIERS: PlanTier[] = ['individual', 'team', 'enterprise'];

interface Props {
  fleet: FleetConfig;
  workloads: Workload[];
  tierLabel: Record<PlanTier, string>;
  onToggle: (id: WorkloadId) => void;
  onPatch: (patch: Partial<FleetConfig>) => void;
}

export function FleetPanel({ fleet, workloads, tierLabel, onToggle, onPatch }: Props) {
  return (
    <section className="panel" aria-labelledby="fleet-h">
      <h2 id="fleet-h">
        <span className="step">1</span> Your fleet
      </h2>
      <p className="panel-note">
        Tick everything you actually run. None of these is unusual; that is the point.
      </p>

      <ul className="workloads">
        {workloads.map((w) => {
          const on = fleet.enabled.includes(w.id);
          return (
            <li key={w.id}>
              <label className={on ? 'workload on' : 'workload'}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(w.id)}
                  aria-label={w.name}
                />
                <span className="workload-text">
                  <span className="workload-name">{w.name}</span>
                  <span className="workload-blurb">{w.blurb}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="field">
        <label htmlFor="rpd">
          Requests per day <output>{fleet.requestsPerDay.toLocaleString('en-US')}</output>
        </label>
        <input
          id="rpd"
          type="range"
          min={3}
          max={6}
          step={0.02}
          value={Math.log10(Math.max(1000, fleet.requestsPerDay))}
          onChange={(e) =>
            onPatch({
              requestsPerDay: Math.round(10 ** Number(e.target.value) / 1000) * 1000,
            })
          }
        />
        <span className="scale">
          <span>1K</span>
          <span>1M</span>
        </span>
      </div>

      <div className="field">
        <span className="field-label">Commercial relationship</span>
        <div className="segmented" role="group" aria-label="Plan tier">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              className={fleet.planTier === t ? 'seg on' : 'seg'}
              onClick={() => onPatch({ planTier: t })}
            >
              {tierLabel[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="age">
          Credential age <output>{fleet.accountAgeDays} days</output>
        </label>
        <input
          id="age"
          type="range"
          min={1}
          max={365}
          step={1}
          value={fleet.accountAgeDays}
          onChange={(e) => onPatch({ accountAgeDays: Number(e.target.value) })}
        />
        <span className="scale">
          <span>1 day</span>
          <span>1 year</span>
        </span>
      </div>
    </section>
  );
}
