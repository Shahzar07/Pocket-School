import type { PublicCard } from '@/lib/cards/model';

/**
 * The face people share. It shows a first name, a level, and badges or a streak.
 * It does not show a student number, a QR code, or a date of birth.
 */
export function MemberCardFace({
  card,
  schoolOnCard = false,
  sample = false,
}: {
  card: PublicCard;
  /** Owner view may name the school. The public face passes the card's own schoolName, which is already hidden for under-18s. */
  schoolOnCard?: boolean;
  /** Sample faces add the cyan chip and a light watermark. */
  sample?: boolean;
}) {
  const school = schoolOnCard ? card.schoolName : null;
  const marks = card.badges.length > 0
    ? card.badges
    : card.streakDays > 0
      ? [`${card.streakDays}-day streak`]
      : ['Poket School'];
  const initial = card.firstName.slice(0, 1).toUpperCase();

  return (
    <article
      className="relative overflow-hidden rounded-[28px] text-white shadow-xl"
      style={{ background: 'var(--ps-card-face)' }}
    >
      {sample ? (
        <>
          <p className="absolute left-4 top-4 z-20 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-3 py-1 text-xs font-semibold text-[#203337]">Sample card</p>
          <p aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-5xl font-black uppercase tracking-[0.28em] text-[#203337]" style={{ opacity: 0.18 }}>SAMPLE</p>
        </>
      ) : null}
      <div className="grid gap-6 p-6 sm:grid-cols-[1.1fr_0.9fr] sm:p-8">
        <div className="rounded-3xl bg-[#0B1417] p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#3FE0D0]">{card.title}</p>
          <div className="mt-5 flex items-center gap-4">
            {card.showPhoto && card.avatarUrl ? (
              <img src={card.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E6A83] text-2xl font-semibold text-white" aria-hidden>
                {initial}
              </div>
            )}
            <div>
              <h2 className="font-heading text-3xl leading-none">{card.firstName}</h2>
              {card.levelName ? <p className="mt-2 text-sm text-white/80">{card.levelName}</p> : null}
              {school ? <p className="mt-1 text-sm text-white/70">{school}</p> : null}
            </div>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {marks.map((mark) => (
              <li key={mark} className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-3 py-1 text-xs font-semibold text-[#203337]">
                {mark}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-end">
          <p className="font-heading text-4xl leading-none text-[#0B1417] sm:text-5xl">Poket School</p>
          <p className="mt-3 max-w-xs text-sm font-medium text-[#203337]">A free card for every member. Bring a friend.</p>
        </div>
      </div>
    </article>
  );
}
