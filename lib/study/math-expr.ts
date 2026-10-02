import { compile, derivative, parse, simplify, type EvalFunction } from 'mathjs';

/**
 * Accept the ways students and models write functions — "y = 2x^2 - 3",
 * "f(x)=sin x", "\frac{1}{x}", "2·x", "√x" — and normalise to mathjs syntax.
 */
export function normaliseExpr(input: string): string {
  let s = input.trim();
  s = s.replace(/^\s*(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=\s*/, '');
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\(sin|cos|tan|ln|log|exp|pi|theta)/g, '$1')
    .replace(/\\cdot|\\times|·|×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\s*\(?([a-z0-9.]+)\)?/gi, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/[{}]/g, m => (m === '{' ? '(' : ')'))
    .replace(/\bln\(/g, 'log(')
    .replace(/\b(sin|cos|tan|log|sqrt|exp|abs)\s+([a-z0-9.]+)/gi, '$1($2)')
    .replace(/\$/g, '')
    .replace(/−/g, '-')
    .replace(/\|([^|]+)\|/g, 'abs($1)');
  return s;
}

export interface CompiledFn { source: string; expr: string; fn: (x: number) => number }

export function compileFn(input: string): CompiledFn {
  const expr = normaliseExpr(input);
  const code: EvalFunction = compile(expr);
  // Validate once so a bad expression fails here, not mid-plot.
  const probe = code.evaluate({ x: 1.2345 });
  if (typeof probe !== 'number' && typeof probe?.re !== 'number') throw new Error(`Can't plot "${input}"`);
  return {
    source: input,
    expr,
    fn: (x: number) => {
      try {
        const v = code.evaluate({ x });
        return typeof v === 'number' ? v : (v && Math.abs(v.im ?? 0) < 1e-9 ? v.re : NaN);
      } catch { return NaN; }
    },
  };
}

export function derivativeOf(expr: string): string {
  return simplify(derivative(parse(normaliseExpr(expr)), 'x')).toString();
}

/** Numerically find roots on [a, b] by sign changes, refined by bisection. */
export function findRoots(fn: (x: number) => number, a: number, b: number, samples = 800): number[] {
  const roots: number[] = [];
  let px = a, py = fn(a);
  for (let i = 1; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples, y = fn(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (py === 0) roots.push(px);
      else if (py * y < 0 && Math.abs(py - y) < 1e3) {
        let lo = px, hi = x;
        for (let k = 0; k < 50; k++) {
          const mid = (lo + hi) / 2;
          if (fn(lo) * fn(mid) <= 0) hi = mid; else lo = mid;
        }
        roots.push((lo + hi) / 2);
      }
    }
    px = x; py = y;
  }
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-6).map(r => Math.round(r * 1e6) / 1e6);
}

/** Evaluate a plain numeric answer the student typed ("3/4", "2.5", "-sqrt(2)"). */
export function numericValue(input: string): number | null {
  try {
    const v = compile(normaliseExpr(input).replace(/^x\s*=\s*/, '')).evaluate({});
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}
