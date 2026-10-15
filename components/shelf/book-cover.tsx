import type { CoverStyle } from '@/lib/shelf/types';

export function BookCover({
  title, cover, kicker = 'ET AI', className = '',
}: {
  title: string;
  cover: CoverStyle;
  kicker?: string;
  className?: string;
}) {
  if (cover.image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.image} alt={title} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(165deg, ${cover.from}, ${cover.to})` }}
    >
      <span className="absolute inset-y-0 left-0 w-[7px] bg-black/25" aria-hidden />
      <span
        className="absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-40"
        style={{ background: cover.accent }}
        aria-hidden
      />
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
      <div className="relative flex h-full flex-col justify-between p-3.5 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: cover.accent }}>{kicker}</p>
        <p className="font-heading text-[15px] leading-tight text-white sm:text-[17px]">{title}</p>
      </div>
    </div>
  );
}
