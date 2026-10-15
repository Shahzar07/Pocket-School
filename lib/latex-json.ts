/**
 * LaTeX inside JSON is a trap. `\f`, `\t`, `\n`, `\b` and `\r` are valid JSON
 * escapes, so when a model writes "\frac{1}{2}" or "\theta" with a single
 * backslash, JSON.parse succeeds — and quietly turns them into a form-feed
 * plus "rac", or a tab plus "heta". The formula is destroyed with no error.
 *
 * Before parsing, double the backslash in front of known LaTeX commands. The
 * list is explicit and each name must end at a non-letter, so a genuine
 * newline before a word ("\nThe…") is left alone.
 */
const COMMANDS = [
  'frac', 'dfrac', 'tfrac', 'times', 'theta', 'Theta', 'text', 'textbf', 'textit', 'tan', 'tanh', 'to', 'top', 'triangle',
  'neq', 'ne', 'nabla', 'nu', 'not', 'notin', 'newline', 'ngtr', 'nless',
  'right', 'rho', 'rightarrow', 'Rightarrow', 'rangle', 'rfloor', 'rceil', 'rm',
  'beta', 'bar', 'begin', 'binom', 'boxed', 'bigg', 'big', 'Big', 'bot', 'because', 'bmod', 'bf',
  'forall', 'frown', 'flat',
];
const RE = new RegExp(`(?<!\\\\)\\\\(?=(?:${COMMANDS.join('|')})(?![a-zA-Z]))`, 'g');

export function protectLatexInJson(raw: string): string {
  return raw.replace(RE, '\\\\');
}

/** JSON.parse that keeps LaTeX intact. */
export function parseLatexJson<T = unknown>(raw: string): T {
  return JSON.parse(protectLatexInJson(raw)) as T;
}
