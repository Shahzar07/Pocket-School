/**
 * Guess the Equation — a daily maths puzzle in the spirit of Wordle.
 * Everyone gets the same 8-character equation each day (e.g. "12+35=47").
 * Feedback per tile: right symbol in the right place, right symbol in the
 * wrong place, or not in the equation.
 */

export const LENGTH = 8;
export const GUESSES = 6;
export type Mark = 'hit' | 'near' | 'miss';

/** Small deterministic PRNG so every student gets the same daily puzzle. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evaluate +, -, *, / with normal precedence. Returns null if invalid. */
export function evaluate(expr: string): number | null {
  if (!/^\d+([+\-*/]\d+)*$/.test(expr)) return null;
  if (/(^|[+\-*/])0\d/.test(expr)) return null; // no leading zeros
  const tokens = expr.match(/\d+|[+\-*/]/g)!;
  // First pass: * and /
  const stack: (number | string)[] = [Number(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i], n = Number(tokens[i + 1]);
    if (op === '*' || op === '/') {
      const prev = stack.pop() as number;
      if (op === '/' && (n === 0 || prev % n !== 0)) return null;
      stack.push(op === '*' ? prev * n : prev / n);
    } else stack.push(op, n);
  }
  let total = stack[0] as number;
  for (let i = 1; i < stack.length; i += 2) total = stack[i] === '+' ? total + (stack[i + 1] as number) : total - (stack[i + 1] as number);
  return total;
}

export function isValidEquation(s: string): boolean {
  if (s.length !== LENGTH || (s.match(/=/g) ?? []).length !== 1) return false;
  const [left, right] = s.split('=');
  if (!/^\d+$/.test(right) || (right.length > 1 && right.startsWith('0'))) return false;
  if (!/[+\-*/]/.test(left)) return false;
  const v = evaluate(left);
  return v !== null && v === Number(right);
}

export function dailyEquation(day: string): string {
  const seed = day.split('-').reduce((a, p) => a * 100 + Number(p), 7);
  const rnd = mulberry32(seed);
  const ops = ['+', '-', '*', '/'];
  const num = (max: number) => 1 + Math.floor(rnd() * max);
  for (let tries = 0; tries < 20000; tries++) {
    const three = rnd() < 0.45;
    const parts = three
      ? [num(30), ops[Math.floor(rnd() * 4)], num(30), ops[Math.floor(rnd() * 4)], num(20)]
      : [num(rnd() < 0.5 ? 99 : 999), ops[Math.floor(rnd() * 4)], num(99)];
    const left = parts.join('');
    const v = evaluate(left);
    if (v === null || v < 0 || !Number.isInteger(v)) continue;
    const eq = `${left}=${v}`;
    if (eq.length === LENGTH && isValidEquation(eq)) return eq;
  }
  return '12+35=47';
}

/** Wordle-style marking, handling repeated symbols correctly. */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(LENGTH).fill('miss');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < LENGTH; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < LENGTH; i++) {
    if (marks[i] === 'hit') continue;
    if (remaining[guess[i]]) { marks[i] = 'near'; remaining[guess[i]]--; }
  }
  return marks;
}
