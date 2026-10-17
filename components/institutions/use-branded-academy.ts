'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInstitutionBySubdomain, type Institution } from '@/lib/db';
import { brandingFor, type Branding } from '@/lib/white-label';

export function useBrandedAcademy(): {
  slug: string;
  institution: Institution | null;
  branding: Branding;
  status: 'loading' | 'missing' | 'ready';
} {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.toLowerCase() : '';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');

  useEffect(() => {
    if (!slug) {
      setStatus('missing');
      return;
    }
    let cancelled = false;
    getInstitutionBySubdomain(slug)
      .then((found) => {
        if (cancelled) return;
        setInstitution(found);
        setStatus(found ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });
    return () => { cancelled = true; };
  }, [slug]);

  return { slug, institution, branding: brandingFor(institution), status };
}
