import { ImageResponse } from 'next/og';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadPublicCard } from '@/lib/cards/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const size = { width: 1080, height: 1920 };

/** Portrait share image for Stories. Same public card as the page. No plan is read. */
export async function GET(_request: Request, context: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await context.params;
  const card = isAdminConfigured() ? await loadPublicCard(shareId).catch(() => null) : null;
  const firstName = card?.firstName ?? 'Member';
  const title = card?.title ?? 'Poket School member card';
  const level = card?.levelName ?? '';
  const marks = card && card.badges.length > 0
    ? card.badges.join(' · ')
    : card && card.streakDays > 0
      ? `${card.streakDays}-day streak`
      : 'Free for every member';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(160deg, #1E6A83 0%, #2786A4 48%, #6FBBCE 100%)',
          padding: 72,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            borderRadius: 48,
            background: '#0B1417',
            color: '#FFFFFF',
            padding: 64,
          }}
        >
          <div style={{ display: 'flex', color: '#3FE0D0', fontSize: 36, letterSpacing: 6 }}>{title}</div>
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontSize: 108, fontWeight: 700, lineHeight: 1 }}>{firstName}</div>
            {level ? <div style={{ display: 'flex', marginTop: 20, fontSize: 44, color: '#E8EFEF' }}>{level}</div> : null}
            <div style={{ display: 'flex', marginTop: 40, alignSelf: 'flex-start', fontSize: 36, color: '#203337', background: '#3FE0D0', borderRadius: 999, padding: '16px 28px' }}>{marks}</div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 48, color: '#0B1417', fontSize: 64, fontWeight: 700 }}>
          Join Poket School
        </div>
      </div>
    ),
    size,
  );
}
