import { useState } from 'react';
import type { IndicatorOrigin, SignatureResult } from '../engine/types';

const ORIGIN_LABEL: Record<IndicatorOrigin, string> = {
  'detection-indicator': 'detection indicator',
  tactic: 'tactic',
  'novel-technique': 'novel technique',
};

interface Props {
  signature: SignatureResult;
  bandTitle: string;
  bandBody: string;
}

export function SignaturePanel({ signature, bandTitle, bandBody }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="panel" aria-labelledby="sig-h">
      <h2 id="sig-h">
        <span className="step">2</span> Signature match
      </h2>

      <div className={`band band-${signature.band}`}>
        <div className="band-score" aria-label="Overall signature match">
          {Math.round(signature.overall * 100)}
          <span className="pct">%</span>
        </div>
        <div className="band-copy">
          <strong>{bandTitle}</strong>
          <p>{bandBody}</p>
        </div>
      </div>

      <ul className="indicators">
        {signature.scores.map((s) => {
          const pct = Math.round(s.strength * 100);
          const open = openId === s.indicator.id;
          return (
            <li key={s.indicator.id} className={s.strength >= 0.5 ? 'ind tripped' : 'ind'}>
              <button
                type="button"
                className="ind-head"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : s.indicator.id)}
              >
                <span className="ind-label">{s.indicator.label}</span>
                <span className="ind-pct">{pct}%</span>
              </button>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {s.evidence.length > 0 && (
                <ul className="chips">
                  {s.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              {open && (
                <div className="ind-detail">
                  <p>
                    <span className="tag">{ORIGIN_LABEL[s.indicator.origin]}</span>
                    {s.indicator.advisory}
                  </p>
                  <p>
                    <strong>Why yours does this anyway:</strong> {s.indicator.benignCause}
                  </p>
                  <p>
                    <strong>Cheapest fix:</strong> {s.indicator.mitigation}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
