import type { Metadata } from 'next';
import { StudioTimetableRoute } from '@/components/timetable/studio';

export const metadata: Metadata = { title: 'ET AI Timetabler' };

/** The grid editor beside the dashboard sidebar. The studio nav is not nested here. */
export default function StudioTimetablePage() {
  return <StudioTimetableRoute />;
}
