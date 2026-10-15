import { LEGAL_COMPANY_NO, LEGAL_ENTITY } from '../legal';

export function copyrightNotice(year = new Date().getFullYear()): string {
  return `© ${year} ${LEGAL_ENTITY} (${LEGAL_COMPANY_NO}). All rights reserved.`;
}

export const WORDMARK = 'Poket School';
