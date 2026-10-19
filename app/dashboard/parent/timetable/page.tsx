import type { Metadata } from 'next';
import { TimetableRoute } from '@/components/timetable/route';

export const metadata: Metadata = { title: 'ET AI Timetabler' };

export default function ParentTimetablePage() {
  return <TimetableRoute surface="parent" />;
}
