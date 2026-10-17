import type { PublicVerification } from '@/lib/student-id/model';

export function VerifyFace({ face }: { face: PublicVerification }) {
  const when = new Date(face.validUntil).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <article className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] text-[#203337] shadow-xl" style={{ background: 'var(--ps-card-face)' }}>
      <div className="p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0B1417]">Poket School</p>
        <div className="mt-5 rounded-3xl bg-[#0B1417] p-6 text-white">
          <div className="flex items-center gap-4">
            {face.showPhoto && face.avatarUrl ? (
              <img src={face.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E6A83] text-2xl font-semibold text-white" aria-hidden>
                {face.initial}
              </div>
            )}
            <div>
              <h1 className="font-heading text-3xl leading-none">{face.firstName}</h1>
              <p className="mt-2 text-sm text-[#3FE0D0]">{face.label}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">Status</dt>
              <dd className="font-semibold">{face.state === 'active' ? 'Active' : 'Expired'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">Valid until</dt>
              <dd className="font-semibold">{when}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">Age band</dt>
              <dd className="font-semibold">{face.ageBand}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
