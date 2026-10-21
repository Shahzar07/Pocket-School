import type { FlowStep } from './steps';

/** Public learner pathways, in the order a family reads them. */
export const PATHWAY_STEPS: readonly (FlowStep & { href: string })[] = [
  { id: 'primary', label: 'Primary', href: '/primary' },
  { id: 'igcse', label: 'IGCSE', href: '/igcse' },
  { id: 'alevel', label: 'A-Level', href: '/alevel' },
  { id: 'llb', label: 'LLB', href: '/llb' },
  { id: 'mbbs', label: 'MBBS', href: '/mbbs' },
  { id: 'independent', label: 'Independent', href: '/independent' },
];

export function pathwayHref(id: string): string | null {
  return PATHWAY_STEPS.find((step) => step.id === id)?.href ?? null;
}
