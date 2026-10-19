import type { ReactElement } from 'react';

/** Branded social card. Blue field, the essay title, and the PoketSchool.Ai mark. */
export function blogOgCard(title: string): ReactElement {
  const line = title.trim().slice(0, 90) || 'Poket School';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #1E6A83 0%, #203337 78%)',
        padding: '64px',
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#3FE0D0', color: '#203337', borderRadius: 999, padding: '10px 22px', fontSize: 24, fontWeight: 700 }}>
          PoketSchool.Ai
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
        {line}
      </div>
    </div>
  );
}
