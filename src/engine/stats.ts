/**
 * The small amount of statistics the blind-window calculation needs.
 *
 * Deliberately hand-rolled rather than pulled from a stats package: the whole
 * point of this tool is that the arithmetic is auditable, so it lives in
 * thirty lines you can read, with tests pinning it to published values.
 */

/**
 * Standard normal CDF, accurate to roughly machine epsilon.
 *
 * The usual one-line rational fits for erf top out near 1.5e-7, which is not
 * enough to reproduce published z-values to six decimals — and a tool whose
 * whole argument is "check my arithmetic" should reproduce them. So erf goes
 * through the regularized lower incomplete gamma function instead:
 *
 *   erf(x) = sign(x) · P(1/2, x²)
 *
 * evaluated by the standard pairing of a power series below the transition
 * point and a Lentz continued fraction above it.
 */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function erf(x: number): number {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  return sign * gammaPHalf(x * x);
}

/** ln Γ(1/2) = ln √π — the only gamma value this file needs. */
const LN_GAMMA_HALF = 0.5723649429247001;
const A = 0.5;
const EPS = 1e-16;
const TINY = 1e-300;
const MAX_ITER = 400;

/** Regularized lower incomplete gamma P(1/2, x) for x >= 0. */
function gammaPHalf(x: number): number {
  if (!(x > 0)) return 0;
  const lead = Math.exp(-x + A * Math.log(x) - LN_GAMMA_HALF);

  if (x < A + 1) {
    // Series expansion: P(a,x) = lead · Σ xⁿ / (a(a+1)…(a+n))
    let ap = A;
    let term = 1 / A;
    let sum = term;
    for (let i = 0; i < MAX_ITER; i++) {
      ap += 1;
      term *= x / ap;
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPS) break;
    }
    return sum * lead;
  }

  // Modified Lentz continued fraction for Q(a,x), then P = 1 - Q.
  let b = x + 1 - A;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITER; i++) {
    const an = -i * (i - A);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return 1 - lead * h;
}

/**
 * Inverse standard normal CDF (probit).
 * Acklam's rational approximation, refined by one Halley step against the
 * accurate normalCdf above, which takes it from ~1e-9 to near machine
 * precision across the range this tool uses.
 */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let x: number;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One Halley refinement against the CDF above.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Combine independent 0..1 evidence weights without ever exceeding 1. */
export function noisyOr(weights: number[]): number {
  let miss = 1;
  for (const w of weights) miss *= 1 - clamp01(w);
  return 1 - miss;
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
