/** Decorative ribbons. Strokes only, never text. */
export function Ribbon() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden>
      <path d="M-40 90C160 10 300 190 520 100s340-90 740 40" fill="none" stroke="#3FE0D0" strokeWidth="34" opacity="0.28" />
      <path d="M-40 250C200 340 420 120 700 240s320 120 560-20" fill="none" stroke="#6FBBCE" strokeWidth="18" opacity="0.45" />
    </svg>
  );
}
