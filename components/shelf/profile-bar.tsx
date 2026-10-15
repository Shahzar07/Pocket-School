'use client';

import { useEffect, useState } from 'react';
import {
  SHELF_PROFILES, currentProfile, ensureDemoShelf, setCurrentProfile, type ShelfProfile,
} from '@/lib/shelf/storage';

const PROFILE_EVENT = 'poket-shelf-profile-change';

export function useShelfProfile(): { profile: ShelfProfile; choose: (id: string) => void; ready: boolean } {
  const [profile, setProfile] = useState<ShelfProfile>(SHELF_PROFILES[0]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureDemoShelf();
    setProfile(currentProfile());
    setReady(true);
    const sync = () => setProfile(currentProfile());
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return {
    ready,
    profile,
    choose: (id: string) => {
      setCurrentProfile(id);
      window.dispatchEvent(new Event(PROFILE_EVENT));
    },
  };
}

export function ProfileSwitch({
  profile, onChoose, label,
}: {
  profile: ShelfProfile;
  onChoose: (id: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      {SHELF_PROFILES.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChoose(p.id)}
          aria-pressed={p.id === profile.id}
          title={p.name}
          className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-primary-foreground ${p.id === profile.id ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-70'}`}
          style={{ background: p.tint }}
        >
          {p.name.slice(0, 1)}
        </button>
      ))}
    </div>
  );
}
