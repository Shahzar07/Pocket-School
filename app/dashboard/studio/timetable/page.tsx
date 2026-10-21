import type { Metadata } from 'next';
import { StudioTimetableRoute } from '@/components/timetable/studio';

export const metadata: Metadata = { title: 'ET AI Timetabler' };

/** The grid editor inside the full-page studio shell. */
export default function StudioTimetablePage() {
  return <StudioTimetableRoute />;
}
