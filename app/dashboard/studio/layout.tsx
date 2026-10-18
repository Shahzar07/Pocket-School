import { StudioFrame } from '@/components/studio/studio-nav';

/** Sits inside the dashboard shell. It does not cover the shell. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioFrame>{children}</StudioFrame>;
}
