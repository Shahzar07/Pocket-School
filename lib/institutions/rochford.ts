/**
 * Rochford's International School. A flagged test fixture, not a live tenant.
 * Poket School chrome stays on the cyan tokens. This record does not copy
 * the school's own colours onto the product.
 */

export const ROCHFORD_SLUG = 'rochfords-international-school';

export interface RochfordFixture {
  slug: string;
  name: string;
  group: string;
  city: string;
  state: string;
  country: string;
  campuses: readonly string[];
  website: string;
  levels: string;
  type: 'school';
  plan: 'team';
  test: true;
}

export const ROCHFORD_SCHOOL: RochfordFixture = {
  slug: ROCHFORD_SLUG,
  name: "Rochford's International School",
  group: "Rochford's Education Group",
  city: 'Ipoh',
  state: 'Perak',
  country: 'MY',
  campuses: ['Falim', 'Ipoh Garden'],
  website: 'https://www.edquest.edu.my',
  levels: 'Primary to secondary IGCSE',
  type: 'school',
  plan: 'team',
  test: true,
};

export const INSTITUTION_KEY_MESSAGE = 'Adding an institution needs the Firebase Admin key. This admin tool is coming soon.';
