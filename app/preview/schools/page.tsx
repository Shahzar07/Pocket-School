import { SchoolMarquee } from '@/components/landing/school-strip';

const NAMES = ['North Academy', 'Harbour Tuition', 'Lakeside School', 'East Court', 'Sri Kuala'];

/** Static homepage strip and lead list. Names here are samples, not live records. */
export default function SchoolPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F6F1E7]">
      <SchoolMarquee names={NAMES} />
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1E6A83]">Super admin</p>
        <h1 className="mt-2 font-heading text-3xl text-[#203337]">School leads</h1>
        <p className="mt-2 text-sm text-[#203337]/80">Self-reported schools are not institution members. Homepage toggles start off.</p>
        <table className="mt-4 w-full overflow-hidden rounded-2xl bg-white text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#203337]/60">
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Place</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Homepage</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#203337]/10">
              <td className="px-4 py-3 font-semibold text-[#203337]">Harbour Tuition</td>
              <td className="px-4 py-3">MY · Penang</td>
              <td className="px-4 py-3">4</td>
              <td className="px-4 py-3 text-[#1E6A83]">On</td>
            </tr>
            <tr className="border-t border-[#203337]/10">
              <td className="px-4 py-3 font-semibold text-[#203337]">Quiet School</td>
              <td className="px-4 py-3">MY · Selangor</td>
              <td className="px-4 py-3">9</td>
              <td className="px-4 py-3">Off</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
