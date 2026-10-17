import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEMOGRAPHIC_CONSENT,
  cellId,
  censusFacet,
  coarseGeo,
  emptyInsights,
  foldCells,
  indexedCellFilters,
  insightsCsv,
  namedLevel,
  parseGender,
  placesFromFold,
  presentInsights,
  weekKey,
  type CensusCell,
} from './census';

function cell(partial: Partial<CensusCell> & Pick<CensusCell, 'count'>): CensusCell {
  return {
    scope: 'platform',
    country: 'MY',
    state: 'Selangor',
    gender: 'female',
    level: 'IGCSE',
    roles: { student: partial.count },
    ageBands: { teen: partial.count },
    membership: { independent: partial.count },
    days: {},
    weeks: {},
    months: {},
    cohorts: {},
    ...partial,
  };
}

describe('census', () => {
  it('accepts male and female and keeps level names', () => {
    assert.equal(parseGender('Female'), 'female');
    assert.equal(parseGender('other'), '');
    assert.equal(namedLevel('Year 10'), 'IGCSE');
    assert.equal(namedLevel('A-Level'), 'A-Level');
    assert.match(DEMOGRAPHIC_CONSENT, /PDPA/);
    assert.match(DEMOGRAPHIC_CONSENT, /GDPR/);
  });

  it('stores a declared place ahead of the IP hint and never a coordinate', () => {
    const facet = censusFacet({
      role: 'student',
      gender: 'male',
      yearGroup: 'IGCSE',
      country: 'my',
      region: 'Penang',
      geoCountry: 'SG',
      geoCity: 'George Town',
      dateOfBirth: '2012-04-02',
      today: new Date('2026-10-17T00:00:00Z'),
    });
    assert.equal(facet.country, 'MY');
    assert.equal(facet.state, 'Penang');
    assert.equal(facet.ageBand, 'teen');
    assert.equal(facet.membership, 'independent');
    assert.equal(coarseGeo({ get: (name) => name === 'x-vercel-ip-city' ? '3.139' : 'MY' }).city, '');
    assert.equal(weekKey('2026-10-17'), '2026-W42');
  });

  it('hides a bucket smaller than five and keeps a larger one', () => {
    const tiny = presentInsights({
      folded: foldCells([cell({ count: 4, days: { '2026-10-17': { signups: 4, active: 4 } }, weeks: { '2026-W42': 4 } })]),
      places: [],
      schools: [{ name: 'Quiet School', kind: 'unregistered', count: 4, country: 'MY', state: 'Penang' }],
      from: '2026-10-01',
      to: '2026-10-31',
      today: '2026-10-17',
      cities: [{ name: 'Ipoh', count: 4 }],
    });
    assert.equal(tiny.suppressed, true);
    assert.equal(emptyInsights().population, 0);

    const folded = foldCells([
      cell({ count: 6, gender: 'female', days: { '2026-10-17': { signups: 6, active: 6, sparksSpent: 12 } }, weeks: { '2026-W42': 6 }, months: { '2026-10': 6 }, cohorts: { '2026-09': { size: 6, retained: { '2026-10': 6 } } } }),
      cell({ count: 2, gender: 'male', country: 'GB', state: 'England', level: 'A-Level' }),
    ]);
    const view = presentInsights({
      folded,
      places: placesFromFold(folded.places, { MY: 1 }),
      schools: [
        { name: 'North Academy', kind: 'verified', count: 6, country: 'MY', state: 'Selangor' },
        { name: 'Quiet School', kind: 'unregistered', count: 2, country: 'MY', state: 'Penang' },
      ],
      from: '2026-10-01',
      to: '2026-10-31',
      today: '2026-10-17',
      cities: [{ name: 'Shah Alam', count: 6 }],
    });
    assert.equal(view.suppressed, false);
    assert.equal(view.population, 8);
    assert.equal(view.gender.female, 6);
    assert.equal(view.gender.male, 0);
    assert.equal(view.schools.length, 1);
    assert.equal(view.cities[0]?.name, 'Shah Alam');
    assert.equal(view.active.dau, 6);
    assert.equal(view.retention[0]?.cohort, '2026-09');
    assert.match(insightsCsv(['School', 'Students'], [['North Academy', 6]]), /North Academy,6/);
  });

  it('picks an indexed filter prefix', () => {
    const filters = indexedCellFilters({ scope: 'platform', country: 'MY', gender: 'female' });
    assert.deepEqual(filters.query, { scope: 'platform', country: 'MY', gender: 'female' });
    assert.equal(cellId('platform', { country: 'MY', state: 'Penang', gender: 'female', level: 'IGCSE' }).includes('MY'), true);
  });
});
