'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut, UserCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { clearViewAs } from '@/components/admin-session';

export function AccountMenu({
  name,
  email,
  roleLabel,
  staffHome,
  children,
}: {
  name: string;
  email: string;
  roleLabel: string;
  staffHome?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const goSettings = () => {
    setOpen(false);
    router.push('/dashboard/profile');
  };

  const leave = () => {
    clearViewAs();
    void signOut(auth).then(() => {
      useAuthSTORE.getState().setUser(null);
      router.push(staffHome ? '/admin/login' : '/login');
    });
  };

  return (
    <div ref={ref} className="relative" data-account-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen(value => !value)}
        className="w-full border-0 bg-transparent p-0 text-left"
      >
        {children}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-lg">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
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
        </div>
      )}
    </div>
  );
}
