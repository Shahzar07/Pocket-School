import { StudioFrame } from '@/components/studio/studio-nav';

/** Full width beside the dashboard sidebar. No inner frame. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioFrame>{children}</StudioFrame>;
}
