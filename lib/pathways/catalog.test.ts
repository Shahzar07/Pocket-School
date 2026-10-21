import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AI_TEACHERS } from '../ai-teachers';
import { HOME } from '../marketing/home';
import { PROGRAMMES } from '../programmes';
import {
  PATHWAYS,
  parsePathway,
  pathwayBySlug,
  pathwayTeacher,
} from './catalog';

function programmeSubjects(value: string): string[] {
  return [...(PROGRAMMES.find((item) => item.value === value)?.subjects ?? [])];
}

function names(slug: string): string[] {
  const pathway = pathwayBySlug(slug);
  assert.ok(pathway);
  return pathway.stages.flatMap((stage) => stage.subjects.map((subject) => subject.name));
}

test('every homepage pathway card has stages, subjects, and a real ET teacher', () => {
  assert.equal(PATHWAYS.length, HOME.levels.length);
  for (const card of HOME.levels) {
    const slug = card.href.replace(/^\//, '');
    const pathway = pathwayBySlug(slug);
    assert.ok(pathway, card.href);
    assert.equal(pathway.priceLabel, card.price);
    assert.ok(pathway.stages.length > 0);
    assert.ok(pathway.faqs.length > 0);
    assert.ok(pathway.ctas.some((item) => item.label.toLowerCase().includes('start') || item.href.includes('signup')));
    assert.ok(pathway.ctas.some((item) => item.label === 'Talk to us'));
    for (const stage of pathway.stages) {
      assert.ok(stage.subjects.length > 0, stage.title);
      for (const subject of stage.subjects) {
        assert.ok(pathwayTeacher(subject.teacherId), subject.name);
        assert.ok(AI_TEACHERS.some((teacher) => teacher.id === subject.teacherId));
      }
    }
    assert.ok(parsePathway(pathway, slug));
  }
});

test('school and degree subjects follow the catalogue', () => {
  for (const name of programmeSubjects('Primary')) {
    assert.ok(names('primary').includes(name), name);
  }
  for (const name of programmeSubjects('IGCSE')) {
    assert.ok(names('igcse').includes(name), name);
  }
  const alevel = pathwayBySlug('alevel');
  assert.ok(alevel);
  for (const stage of alevel.stages) {
    const stageNames = stage.subjects.map((subject) => subject.name);
    for (const name of programmeSubjects('A-Level')) {
      assert.ok(stageNames.includes(name), `${stage.title} ${name}`);
    }
  }
  for (const name of programmeSubjects('LLB Law')) {
    assert.ok(names('llb').includes(name), name);
  }
  for (const name of programmeSubjects('MBBS Medicine')) {
    assert.ok(names('mbbs').includes(name), name);
  }
  for (const name of programmeSubjects('Independent Learning')) {
    assert.ok(names('independent').includes(name), name);
  }
});

test('LLB lists years and qualifying subjects without a partnership claim', () => {
  const llb = pathwayBySlug('llb');
  assert.ok(llb);
  assert.deepEqual(llb.stages.map((stage) => stage.title), ['Year 1', 'Year 2', 'Year 3']);
  const year1 = llb.stages[0]?.subjects.map((subject) => subject.name) ?? [];
  assert.ok(year1.includes('Contract Law'));
  assert.ok(year1.includes('Legal System and Method'));
  assert.equal(llb.disclaimer, 'Degree pathway. Not a university enrolment.');
  const source = JSON.stringify(llb);
  assert.equal(source.includes('University of London'), false);
  assert.equal(names('llb').includes('EU Law'), false);
  assert.equal(names('llb').includes('International Law'), true);
});

test('MBBS stays a pre-clinical foundation and keeps the licence line', () => {
  const mbbs = pathwayBySlug('mbbs');
  assert.ok(mbbs);
  assert.equal(mbbs.disclaimer, 'Not a clinical licence.');
  assert.ok(mbbs.stages[0]?.subjects.some((subject) => subject.name === 'Anatomy'));
  assert.equal(mbbs.stages.some((stage) => stage.title === 'Later study topics'), true);
  assert.match(JSON.stringify(mbbs), /not a clinical placement/i);
  assert.equal(/includes a clinical placement/i.test(JSON.stringify(mbbs)), false);
});

test('pathway copy avoids gold, pass rates, and accreditation claims', () => {
  const source = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('#C8820A'), false);
  assert.equal(source.toLowerCase().includes('pass rate'), false);
  assert.equal(source.toLowerCase().includes('accredit'), false);
  assert.equal(source.toLowerCase().includes('partnership'), false);
});

test('admins can write pathway pages and guests cannot list them', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const start = rules.indexOf('match /pathwayPages/');
  const end = rules.indexOf('match /blogPosts/');
  const block = rules.slice(start, end);
  assert.ok(start > 0);
  assert.match(block, /allow get, list: if isAdmin\(\) \|\| callerIsSuper\(\)/);
  assert.match(block, /allow delete: if callerIsSuper\(\)/);
  assert.match(block, /slug in \['primary', 'igcse', 'alevel', 'llb', 'mbbs', 'independent'\]/);
});

test('a broken admin save is ignored', () => {
  assert.equal(parsePathway({ slug: 'llb', title: 'LLB' }, 'llb'), null);
  assert.equal(parsePathway({ ...pathwayBySlug('igcse'), slug: 'llb' }, 'igcse'), null);
});
