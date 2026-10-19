'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut, UserCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { reportActivity } from '@/lib/audit/report';
import { useAuthSTORE } from '@/hooks/use-auth';
import { clearViewAs } from '@/components/admin-session';
import { ModeSwitch } from '@/components/account/mode-switch';
import type { AccountMode } from '@/lib/account-modes';
import { menuPosition } from '@/lib/ui/menu-position';

export function AccountMenu({
  name,
  email,
  roleLabel,
  staffHome,
  modes,
  activeMode,
  onSwitchMode,
  onBecomeInstructor,
  children,
}: {
  name: string;
  email: string;
  roleLabel: string;
  staffHome?: boolean;
  modes?: readonly AccountMode[];
  activeMode?: AccountMode | null;
  onSwitchMode?: (mode: AccountMode) => void;
  onBecomeInstructor?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ left: 12, top: 12 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox(menuPosition(
      { left: rect.left, top: rect.top, bottom: rect.bottom },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = (event: MouseEvent) => {
      const node = event.target as Node;
      if (ref.current?.contains(node) || panelRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const goSettings = () => {
    setOpen(false);
    router.push('/dashboard/profile');
  };

  const leave = () => {
    clearViewAs();
    const uid = useAuthSTORE.getState().user?.uid || '';
    void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: uid }).finally(() => {
      void signOut(auth).then(() => {
        useAuthSTORE.getState().setUser(null);
        router.push(staffHome ? '/admin/login' : '/login');
      });
    });
  };

  return (
    <div ref={ref} className="relative" data-account-menu>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen(value => !value)}
        className="w-full border-0 bg-transparent p-0 text-left"
      >
        {children}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={panelRef}
          role="menu"
          data-account-menu-panel
          style={{ position: 'fixed', left: box.left, top: box.top, zIndex: 80 }}
          className="w-72 rounded-2xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          {onSwitchMode && (
            <ModeSwitch
              layout="menu"
              modes={modes ?? []}
              active={activeMode ?? null}
              onSwitch={mode => { setOpen(false); onSwitchMode(mode); }}
              onBecomeInstructor={onBecomeInstructor ? () => { setOpen(false); onBecomeInstructor(); } : undefined}
            />
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-muted"
            onClick={goSettings}
          >
            <UserCircle className="h-4 w-4" /> My profile & settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            onClick={leave}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
