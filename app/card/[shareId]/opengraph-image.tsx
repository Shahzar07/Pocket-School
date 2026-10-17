import { ImageResponse } from 'next/og';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadPublicCard } from '@/lib/cards/server';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Poket School member card';

export default async function CardImage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
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
          background: 'linear-gradient(135deg, #1E6A83 0%, #2786A4 55%, #6FBBCE 100%)',
          padding: 48,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 640,
            borderRadius: 36,
            background: '#0B1417',
            color: '#FFFFFF',
            padding: 40,
          }}
        >
          <div style={{ display: 'flex', color: '#3FE0D0', fontSize: 22, letterSpacing: 4 }}>{title}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>{firstName}</div>
            {level ? <div style={{ display: 'flex', marginTop: 8, fontSize: 28, color: '#E8EFEF' }}>{level}</div> : null}
            <div style={{ display: 'flex', marginTop: 24, fontSize: 26, color: '#203337', background: '#3FE0D0', borderRadius: 999, padding: '10px 18px' }}>{marks}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', color: '#0B1417', fontSize: 42, fontWeight: 700 }}>
          Join Poket School
        </div>
      </div>
    ),
    { ...size },
  );
}
