import type { InsightsView } from './census';

/** Grouped sample for the Insights preview. Every bucket is at least five people. */
export const SAMPLE_INSIGHTS: InsightsView = {
  suppressed: false,
  population: 128,
  roles: { student: 86, parent: 24, teacher: 18, other: 0 },
  gender: { male: 52, female: 64 },
  levels: [
    { name: 'IGCSE', count: 28 },
    { name: 'Lower Secondary', count: 22 },
    { name: 'A-Level', count: 16 },
    { name: 'Primary', count: 14 },
  ],
  ageBands: [
    { band: 'Under 13', count: 18 },
    { band: '13–17', count: 44 },
    { band: '18+', count: 24 },
  ],
  membership: { independent: 31, institution: 55 },
  countries: [
    {
      country: 'MY',
      students: 48,
      parents: 14,
      teachers: 10,
      institutions: 3,
      states: [
        { name: 'Selangor', students: 26, parents: 8, teachers: 6, institutions: 0 },
        { name: 'Penang', students: 16, parents: 6, teachers: 0, institutions: 0 },
      ],
      cities: [],
    },
    {
      country: 'GB',
      students: 22,
      parents: 6,
      teachers: 8,
      institutions: 2,
      states: [
        { name: 'England', students: 22, parents: 6, teachers: 8, institutions: 0 },
      ],
      cities: [],
    },
    {
      country: 'US',
      students: 16,
      parents: 0,
      teachers: 0,
      institutions: 1,
      states: [
        { name: 'California', students: 11, parents: 0, teachers: 0, institutions: 0 },
      ],
      cities: [],
    },
  ],
  states: [
    { name: 'Selangor', students: 26, parents: 8, teachers: 6, institutions: 0 },
    { name: 'England', students: 22, parents: 6, teachers: 8, institutions: 0 },
    { name: 'Penang', students: 16, parents: 6, teachers: 0, institutions: 0 },
    { name: 'California', students: 11, parents: 0, teachers: 0, institutions: 0 },
  ],
  cities: [
    { name: 'Shah Alam', count: 18 },
    { name: 'George Town', count: 12 },
    { name: 'London', count: 9 },
  ],
  schools: [
    { id: 'north', name: 'North Academy', kind: 'verified', count: 24, country: 'MY', state: 'Selangor' },
    { id: 'harbour', name: 'Harbour Tuition', kind: 'unregistered', count: 11, country: 'MY', state: 'Penang' },
    { id: 'lakeside', name: 'Lakeside School', kind: 'verified', count: 8, country: 'GB', state: 'England' },
  ],
  series: [
    { day: '2026-10-06', signups: 6, active: 14, enrolments: 5, sparksSpent: 40, sparksIssued: 90 },
    { day: '2026-10-08', signups: 8, active: 18, enrolments: 7, sparksSpent: 55, sparksIssued: 70 },
    { day: '2026-10-10', signups: 5, active: 22, enrolments: 6, sparksSpent: 30, sparksIssued: 110 },
    { day: '2026-10-13', signups: 9, active: 26, enrolments: 8, sparksSpent: 48, sparksIssued: 60 },
    { day: '2026-10-15', signups: 7, active: 24, enrolments: 5, sparksSpent: 36, sparksIssued: 80 },
    { day: '2026-10-17', signups: 6, active: 22, enrolments: 9, sparksSpent: 42, sparksIssued: 95 },
  ],
  active: { dau: 22, wau: 64, mau: 110 },
  retention: [
    { cohort: '2026-07', size: 18, retained: 12 },
    { cohort: '2026-08', size: 22, retained: 16 },
    { cohort: '2026-09', size: 30, retained: 21 },
  ],
};
