'use client';

import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { flowCopy } from '@/lib/flow/copy';
import { PATHWAY_STEPS, pathwayHref } from '@/lib/flow/pathways';
import { flowNeighbor } from '@/lib/flow/steps';

export function PathwayFlow({ currentId }: { currentId: string }) {
  const back = flowNeighbor(PATHWAY_STEPS, currentId, -1);
  const next = flowNeighbor(PATHWAY_STEPS, currentId, 1);
  return (
    <div className="space-y-3">
      <FlowTrail steps={PATHWAY_STEPS} currentId={currentId} hrefFor={pathwayHref} label={flowCopy.trail} />
      <FlowNav
        backHref={back ? pathwayHref(back.id) ?? undefined : undefined}
        nextHref={next ? pathwayHref(next.id) ?? undefined : undefined}
        backDisabled={!back}
        nextDisabled={!next}
      />
    </div>
  );
}
