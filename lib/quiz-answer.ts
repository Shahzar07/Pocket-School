/**
 * Models give the correct answer as the option text, as a letter ("B"), or as
 * both ("B. 12 cm"). Comparing raw strings marked right answers wrong, so
 * resolve the answer to the index of the option it names.
 */
const stripLabel = (s: string) => s.trim().replace(/^\(?[A-Ha-h][).:\]]\s+/, '').trim().toLowerCase();
export function correctIndex(options: string[], answer: string): number {
  const a = answer.trim();
  const letter = /^\(?([A-Ha-h])\)?[.):]?$/.exec(a);
  if (letter) {
    const i = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (i < options.length) return i;
  }
  const target = stripLabel(a);
  if (!target) return -1;
  const exact = options.findIndex(o => stripLabel(o) === target);
  if (exact !== -1) return exact;
  // Containment only for substantial strings, so "1" never matches "10".
  if (target.length < 4) return -1;
  return options.findIndex(o => {
    const opt = stripLabel(o);
    return opt.length >= 4 && (opt.includes(target) || target.includes(opt));
  });
}
