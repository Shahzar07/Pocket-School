import { RESULT_COPY as COPY } from '@/lib/results/copy';
import type { PublicResult, SessionProgress } from '@/lib/results/model';

const shell = 'min-h-screen bg-[#F4FBFA] px-5 py-12 text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]';
const card = 'mx-auto w-full max-w-2xl rounded-2xl border border-[#1E6A83]/20 bg-white p-5 dark:border-[#3FE0D0]/25 dark:bg-[#1A1918]';

export function PublicPortfolio({
  state,
  rows,
  progress,
}: {
  state: 'private' | 'open';
  rows: PublicResult[];
  progress: SessionProgress[];
}) {
  return (
    <main className={shell} data-results-public={state}>
      <article className={card}>
        <h1 className="text-2xl font-semibold">{COPY.title}</h1>
        <p data-results-disclaimer className="mt-2 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.disclaimer}</p>
        {state === 'private' ? <p className="mt-4 text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.privatePortfolio}</p> : null}
        {state === 'open' ? (
          <div className="mt-4 flex flex-col gap-4">
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={`${row.subject}-${row.session}-${row.grade}`} className="rounded-xl border border-[#1E6A83]/20 p-3">
                  <p className="font-semibold">{row.subject}</p>
                  <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{row.levelLabel} · {row.board} · {row.grade} · {row.session}</p>
                  <p className="mt-1 text-sm font-semibold">{row.statusLabel}</p>
                </li>
              ))}
            </ul>
            <section>
              <h2 className="text-lg font-semibold">{COPY.progress}</h2>
              {progress.length === 0 ? <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.progressEmpty}</p> : null}
              {progress.map((group) => (
                <div key={group.session} data-results-progress={group.session} className="mt-2">
                  <p className="text-sm font-semibold">{group.session}</p>
                  <ul>
                    {group.entries.map((entry) => (
                      <li key={`${group.session}-${entry.subject}`} className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{entry.levelLabel} · {entry.subject} · {entry.grade}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </article>
    </main>
  );
}
