import assert from 'node:assert/strict';
import test from 'node:test';
import { seedInstitutionPricing, tierCliff } from './institution-pricing';
import {
  advanceSubscription,
  allocateSparks,
  autoVisibleCourseIds,
  buildSparkPool,
  buySparkTopUp,
  canSeeCourse,
  canSeeStudent,
  certificateCarriesCobrand,
  chargeFor,
  chooseEnrolment,
  defaultSparksConfig,
  entitledProgrammes,
  asVolumePlanId,
  billingMoved,
  blankSubscription,
  cycleSubscription,
  failRenewal,
  institutionEmail,
  institutionsForSelfJoin,
  inviteCodeUsable,
  learningOpen,
  normaliseSparksConfig,
  noticeFor,
  onboardingChecklist,
  onPaymentFailed,
  openSubscription,
  parseRosterCsv,
  periodStartFor,
  partnerRevenue,
  paymentGateway,
  quoteForInstitution,
  readSubscription,
  recordPayment,
  resolveCobrand,
  reviewJoin,
  draftJoinRequest,
  sparksForPlan,
  volumePlanForProgramme,
  type AccessViewer,
  type JoinDirectoryRow,
} from './institution-membership';

const school = (patch: Partial<JoinDirectoryRow> = {}): JoinDirectoryRow => ({
  id: 'north',
  name: 'North Academy',
  country: 'MY',
  state: 'Selangor',
  status: 'active',
  listedForSelfJoin: true,
  billingPhase: 'active',
  ...patch,
});

test('self-join lists only active institutions a super admin has listed', () => {
  const rows = [
    school(),
    school({ id: 'pending', status: 'pending' }),
    school({ id: 'hidden', listedForSelfJoin: false }),
    school({ id: 'paused', billingPhase: 'suspended' }),
    school({ id: 'unpaid', billingPhase: 'pending_payment' }),
    school({ id: 'other', state: 'Penang' }),
    school({ id: 'legacy', billingPhase: '' }),
  ];
  const listed = institutionsForSelfJoin(rows, 'my', 'selangor').map((row) => row.id).sort();
  assert.deepEqual(listed, ['legacy', 'north']);
  assert.equal(institutionsForSelfJoin(rows, 'MY', '').length, 0);
});

test('an unlisted institution falls back to independent online payment', () => {
  const independent = chooseEnrolment({ path: 'independent', country: 'SG', institution: null });
  assert.equal(independent.payment, 'online');
  assert.equal(independent.gateway, 'stripe');
  const missing = chooseEnrolment({ path: 'institution', country: 'MY', institution: school({ listedForSelfJoin: false }) });
  assert.equal(missing.path, 'independent');
  assert.equal(missing.reason, 'not_listed');
  assert.equal(missing.gateway, 'billplz');
  const joined = chooseEnrolment({ path: 'institution', country: 'MY', institution: school() });
  assert.equal(joined.path, 'institution');
  assert.equal(joined.payment, 'institution');
  assert.equal(paymentGateway('my'), 'billplz');
});

test('institution students are not charged for the seat and marketplace stays individual', () => {
  assert.equal(chargeFor({ membership: 'institution', product: 'seat' }), 'waived');
  assert.equal(chargeFor({ membership: 'institution', product: 'marketplace' }), 'individual');
  assert.equal(chargeFor({ membership: 'institution', product: 'marketplace', marketplacePayer: 'institution' }), 'institution');
  assert.equal(chargeFor({ membership: 'institution', product: 'topup' }), 'institution');
  assert.equal(chargeFor({ membership: 'independent', product: 'seat' }), 'individual');
  assert.equal(chargeFor({ membership: 'independent', product: 'seat', role: 'parent' }), 'waived');
  assert.equal(chargeFor({ membership: 'institution', product: 'seat', role: 'teacher' }), 'waived');
});

test('approval assigns a level and rejection does not', () => {
  const draft = draftJoinRequest({
    userId: 'u1', institutionId: 'north', role: 'student', name: 'Amina Yusuf', email: 'amina@school.edu',
  });
  assert.ok(!('error' in draft));
  if ('error' in draft) return;
  const missingLevel = reviewJoin(draft, { status: 'approved' });
  assert.ok('error' in missingLevel);
  const approved = reviewJoin(draft, { status: 'approved', level: 'igcse_alevel', classIds: ['c1'], courseIds: ['bio'] });
  assert.ok(!('error' in approved));
  if ('error' in approved) return;
  assert.equal(approved.level, 'igcse_alevel');
  assert.deepEqual(approved.classIds, ['c1']);
  const rejected = reviewJoin(draft, { status: 'rejected' });
  assert.ok(!('error' in rejected) && rejected.status === 'rejected');
});

test('CSV invites include parents and an invite code is the faster path', () => {
  const parsed = parseRosterCsv('email,name,role,childEmail\nAda@School.edu,Ada,teacher,\nPat@home.test,Pat,parent,bea@school.edu\nbad,No,student,\n');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[1]?.role, 'parent');
  assert.equal(parsed.rows[1]?.childEmail, 'bea@school.edu');
  assert.equal(parsed.errors.length, 1);
  assert.equal(inviteCodeUsable('AB23CD45', 'active'), true);
  assert.equal(inviteCodeUsable('AB23CD45', 'suspended'), false);
});

test('failed payment duns during a 7-day grace, then suspends, and payment restores', () => {
  const opened = openSubscription({
    subject: 'institution', planId: 'igcse_alevel', interval: 'annual', seats: 40,
    currency: 'USD', total: 580.99, payerEmail: 'finance@north.edu', on: '2026-01-01',
  });
  assert.equal(opened.state.phase, 'pending_payment');
  assert.equal(opened.notices[0]?.kind, 'payment_link');
  const paid = recordPayment(opened.state, '2026-01-02', 'annual');
  assert.equal(paid.state.phase, 'active');
  assert.equal(paid.state.periodEnd, '2027-01-02');
  const failed = failRenewal(paid.state, '2027-01-02');
  assert.equal(failed.state.phase, 'grace');
  assert.equal(failed.state.graceEndsOn, '2027-01-09');
  assert.equal(failed.notices.length, 0);
  const later = advanceSubscription(failed.state, '2027-01-08');
  assert.equal(later.state.phase, 'grace');
  assert.deepEqual(later.notices.map((notice) => notice.day), [1, 3, 6]);
  const suspended = advanceSubscription(later.state, '2027-01-09');
  assert.equal(suspended.state.phase, 'suspended');
  assert.equal(learningOpen(suspended.state.phase), false);
  const restored = recordPayment(suspended.state, '2027-01-10', 'annual');
  assert.equal(restored.state.phase, 'active');
  assert.equal(restored.notices[0]?.kind, 'restore');
  assert.equal(learningOpen('grace'), true);

  const person = openSubscription({
    subject: 'individual', planId: 'primary_secondary', interval: 'monthly', seats: 1,
    currency: 'USD', total: 19, payerEmail: 'ada@example.com', on: '2026-03-01',
  });
  const personPaid = recordPayment(person.state, '2026-03-01', 'monthly');
  const personFailed = failRenewal(personPaid.state, '2026-04-01');
  assert.equal(personFailed.state.subject, 'individual');
  assert.equal(personFailed.state.graceEndsOn, '2026-04-08');
  assert.equal(periodStartFor(paid.state.periodEnd, 'annual'), '2026-01-02');
  assert.equal(periodStartFor(personPaid.state.periodEnd, 'monthly'), '2026-03-01');
  const idle = cycleSubscription(paid.state, '2026-06-01');
  assert.equal(billingMoved(paid.state, idle), false);
  const due = cycleSubscription(paid.state, '2027-01-03');
  assert.equal(due.state.phase, 'grace');
  assert.equal(onPaymentFailed(paid.state, '2026-06-01').state.phase, 'grace');
  const read = readSubscription(
    { phase: 'grace', planId: 'professional', seats: 3, remindersSent: ['2026-01-01', 4] },
    blankSubscription('institution', '2026-01-01'),
  );
  assert.equal(read.phase, 'grace');
  assert.equal(read.planId, 'professional');
  assert.equal(asVolumePlanId('nope'), '');
  assert.deepEqual(read.remindersSent, ['2026-01-01']);
});

test('Sparks defaults are finite and the pool cannot be allocated past its seats', () => {
  const config = defaultSparksConfig();
  assert.equal(sparksForPlan(config, 'primary_secondary'), 300);
  assert.equal(sparksForPlan(config, 'igcse_alevel'), 800);
  assert.equal(sparksForPlan(config, 'professional'), 1000);
  const rejected = normaliseSparksConfig({ professional: Number.POSITIVE_INFINITY });
  assert.match(rejected.error ?? '', /unlimited/i);
  const pool = buildSparkPool({ planId: 'igcse_alevel', seats: 2, perSeat: 800 });
  assert.ok(!('error' in pool));
  if ('error' in pool) return;
  assert.equal(pool.allowance, 1600);
  const first = allocateSparks(pool, [], { subjectId: 'a', amount: 1000, classId: 'c1' });
  assert.ok(!('error' in first));
  if ('error' in first) return;
  const over = allocateSparks(first.pool, first.allocations, { subjectId: 'b', amount: 700, classId: 'c1' });
  assert.ok('error' in over);
  const topped = buySparkTopUp(first.pool, 700);
  assert.ok(!('error' in topped));
  if ('error' in topped) return;
  const second = allocateSparks(topped, first.allocations, { subjectId: 'b', amount: 700, classId: 'c1' });
  assert.ok(!('error' in second));
});

test('students see core programmes for their level, teachers see their classes, parents see their children', () => {
  const programmes = entitledProgrammes(['igcse_alevel'], [
    { id: 'p', level: 'primary_secondary', title: 'Primary mathematics' },
    { id: 'i', level: 'igcse_alevel', title: 'IGCSE biology' },
  ]);
  assert.deepEqual(programmes.map((row) => row.id), ['i']);
  assert.equal(volumePlanForProgramme('IGCSE'), 'igcse_alevel');
  const student: AccessViewer = {
    userId: 's', role: 'student', institutionId: 'north', level: 'igcse_alevel',
    classIds: ['c1'], childIds: [], purchasedCourseIds: ['paid'], entitledLevels: ['igcse_alevel'],
  };
  assert.equal(canSeeCourse(student, { id: 'i', visibility: 'core', level: 'igcse_alevel' }), true);
  assert.equal(canSeeCourse(student, { id: 'p', visibility: 'core', level: 'primary_secondary' }), false);
  assert.equal(canSeeCourse(student, { id: 'own', visibility: 'institution', institutionId: 'north', classIds: ['c1'] }), true);
  assert.equal(canSeeCourse(student, { id: 'draft', visibility: 'institution', institutionId: 'north', classIds: ['c1'], libraryApproved: false }), false);
  assert.equal(canSeeCourse(student, { id: 'secret', visibility: 'institution', institutionId: 'south' }), false);
  assert.equal(canSeeCourse(student, { id: 'market', visibility: 'marketplace', institutionId: 'north', marketplaceApproved: false }), false);
  assert.equal(canSeeCourse(student, { id: 'market', visibility: 'marketplace', institutionId: 'north', marketplaceApproved: true }), true);
  const teacher: AccessViewer = { ...student, userId: 't', role: 'teacher', classIds: ['c2'] };
  assert.equal(canSeeCourse(teacher, { id: 'own', visibility: 'institution', institutionId: 'north', classIds: ['c1'] }), false);
  assert.equal(canSeeCourse(teacher, { id: 'mine', visibility: 'institution', institutionId: 'north', classIds: ['c2'], ownerId: 'other' }), true);
  assert.equal(canSeeCourse(teacher, { id: 'draft', visibility: 'institution', institutionId: 'north', ownerId: 't', libraryApproved: false }), true);
  const parent: AccessViewer = { ...student, userId: 'p', role: 'parent', childIds: ['s'] };
  assert.equal(canSeeStudent(parent, { id: 's', institutionId: 'north', classIds: ['c1'] }), true);
  assert.equal(canSeeStudent(parent, { id: 'other', institutionId: 'north', classIds: ['c1'] }), false);
  assert.equal(canSeeStudent(teacher, { id: 's', institutionId: 'north', classIds: ['c1'] }), false);
  assert.deepEqual(autoVisibleCourseIds(student, [{ id: 'i', visibility: 'core', level: 'igcse_alevel' }]), ['i']);
});

test('co-brand keeps Poket School as creator and counts both revenue channels', () => {
  const partners = [{ id: 'acme', name: 'Acme', logoUrl: 'https://cdn.example/acme.png', recognisedBy: 'Recognised by Acme' }];
  const mark = resolveCobrand({ enabled: true, partnerId: 'acme' }, partners);
  assert.equal(mark?.creator, 'Poket School');
  assert.equal(mark?.recognisedBy, 'Recognised by Acme');
  assert.equal(resolveCobrand({ enabled: true, partnerId: 'missing' }, partners), null);
  assert.equal(certificateCarriesCobrand({ enabled: true, partnerId: 'acme' }, partners)?.partnerName, 'Acme');
  const totals = partnerRevenue([
    { partnerId: 'acme', channel: 'enterprise_invoice', amount: 1000, currency: 'USD', seats: 20 },
    { partnerId: 'acme', channel: 'individual', amount: 99, currency: 'USD', seats: 1 },
  ]);
  assert.equal(totals[0]?.total, 1099);
  assert.equal(totals[0]?.seats, 21);
});

test('onboarding, notices, and the payment email are ready for a new academy', () => {
  const steps = onboardingChecklist({ profile: true, billing: true });
  assert.equal(steps.find((step) => step.id === 'profile')?.done, true);
  assert.equal(steps.find((step) => step.id === 'logo')?.done, false);
  assert.match(noticeFor('suspend', 'North Academy').body, /suspended/);
  const mail = institutionEmail('payment_link', {
    institutionName: 'North Academy', plan: 'IGCSE & A-Level', seats: 40, total: 'USD 580.99', link: 'https://poketschool.ai/pay',
  });
  assert.match(mail.subject, /North Academy/);
  assert.match(mail.text, /not charged/);
  const quote = quoteForInstitution({ seats: 40, planId: 'igcse_alevel', interval: 'annual' });
  assert.equal(quote.total, 580.99);
});

test('banded prices do not fall when the next tier starts', () => {
  assert.equal(tierCliff(seedInstitutionPricing(), 'igcse_alevel', 'annual'), null);
  const schedule = seedInstitutionPricing();
  const plan = schedule.plans.find((row) => row.id === 'igcse_alevel');
  const band = plan?.tiers.find((row) => row.tierId === '100-300');
  if (band) band.flatAnnual = 10;
  const cliff = tierCliff(schedule, 'igcse_alevel', 'annual');
  assert.equal(cliff?.toLabel, '100–300');
});
