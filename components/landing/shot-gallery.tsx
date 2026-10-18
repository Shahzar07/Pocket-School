import Image from 'next/image';

export function ShotGallery({ shots }: { shots: { id: string; src: string; alt: string }[] }) {
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {shots.map((shot) => (
        <li key={shot.id}>
          <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="relative aspect-[16/10] bg-muted">
              <Image src={shot.src} alt={shot.alt} fill sizes="(min-width: 1024px) 46vw, 100vw" className="object-cover object-top" quality={50} />
            </div>
          </figure>
        </li>
      ))}
    </ul>
  );
}
