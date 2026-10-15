import type { ReactNode } from 'react';
import { ReadsShell } from '@/components/reads/shell';

export default function ReadsLayout({ children }: { children: ReactNode }) {
  return <ReadsShell>{children}</ReadsShell>;
}
