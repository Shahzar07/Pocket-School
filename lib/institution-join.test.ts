import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyInstitutionJoin,
  bulkMove,
  claimRosterRow,
  claimTokenFor,
  decideJoin,
  defaultJoinPolicy,
  joinReport,
  leaveAcademy,
  linkChild,
  nextLevel,
  overlapCredit,
  parseJoinRoster,
  programmesForLevel,
  rollRoster,
  shareLinks,
  type JoinAttempt,
  type RosterEntry,
  type SeatPool,
} from './institution-join';

const today = '2026-10-17';

function attempt(patch: Partial<JoinAttempt> = {}): JoinAttempt {
  return {
    role: 'student',
    email: 'ada@school.edu.my',
    name: 'Ada Lovelace',
    dob: '2012-04-01',
    today,
    studentId: 'S-14',
    inviteCode: '',
    parentConsent: true,
    programmeId: 'igcse',
    level: 'IGCSE',
    ...patch,
  };
}

const roster: RosterEntry[] = [{
  email: 'ada@school.edu.my',
  name: 'Ada Lovelace',
  role: 'student',
  studentId: 'S-14',
  dob: '2012-04-01',
  level: 'IGCSE',
  className: 'North',
  phone: '',
  childStudentId: '',
  programmeId: 'igcse',
  claimToken: claimTokenFor('north', 'ada@school.edu.my'),
  status: 'unclaimed',
}];

const seats = (patch: Partial<SeatPool> = {}): SeatPool => ({
  programmeId: 'igcse',
  level: 'IGCSE',
  purchased: 2,
  used: 0,
  overage: 'prompt',
  ...patch,
});

test('a school email, a class code, or a roster row can approve, and the queue is the fallback', () => {
  const domain = decideJoin({
    policy: { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'], rosterMatch: false, acceptInviteCode: false },
    attempt: attempt(),
    seats: seats(),
  });
  assert.equal(domain.status, 'approved');
  assert.equal(domain.method, 'domain');
  assert.equal(domain.seat, 'seated');
  assert.equal(domain.enrolWelcome, true);

  const code = decideJoin({
    policy: { ...defaultJoinPolicy(), rosterMatch: false },
    attempt: attempt({ email: 'bee@gmail.com', inviteCode: 'IGCSE1' }),
    codes: [{ code: 'IGCSE1', level: 'IGCSE', className: 'North', programmeId: 'igcse' }],
    seats: seats(),
  });
  assert.equal(code.method, 'code');
  assert.equal(code.className, 'North');

  const matched = decideJoin({
    policy: defaultJoinPolicy(),
    attempt: attempt({ email: 'other@gmail.com', studentId: '', name: 'Ada Lovelace', dob: '2012-04-01' }),
    roster,
    seats: seats(),
  });
  assert.equal(matched.method, 'roster');
  assert.equal(matched.level, 'IGCSE');

  const queued = decideJoin({
    policy: defaultJoinPolicy(),
    attempt: attempt({ email: 'new@gmail.com', studentId: '', name: 'New Learner', dob: '2008-01-01' }),
    seats: seats(),
  });
  assert.equal(queued.status, 'pending');
  assert.equal(queued.method, 'manual');
});

test('under 13 needs parent consent, and a full level waits or adds a seat', () => {
  const young = decideJoin({
    policy: defaultJoinPolicy(),
    attempt: attempt({ dob: '2016-01-01', parentConsent: false }),
    roster,
    seats: seats(),
  });
  assert.equal(young.status, 'needs_consent');
  const waiting = decideJoin({
    policy: { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'] },
    attempt: attempt(),
    seats: seats({ purchased: 1, used: 1, overage: 'prompt' }),
  });
  assert.equal(waiting.status, 'waiting_for_seat');
  assert.equal(waiting.promptAdmin, true);
  const added = decideJoin({
    policy: { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'] },
    attempt: attempt(),
    seats: seats({ purchased: 1, used: 1, overage: 'auto_add' }),
  });
  assert.equal(added.seat, 'auto_add');
  assert.equal(added.status, 'approved');
});

test('parents link several children, and a personal plan can credit the unused days', () => {
  const first = linkChild([], { studentNumber: 'PS-AB12-CD34', institutionId: 'north', name: 'Ada' });
  assert.ok(!('error' in first));
  if ('error' in first) return;
  const both = linkChild(first, { studentNumber: 'PS-ZZ98-YY76', institutionId: 'south', name: 'Bee' });
  assert.ok(!('error' in both));
  if ('error' in both) return;
  assert.equal(both.length, 2);
  const credit = overlapCredit({ personalTotal: 365, periodStart: '2026-01-01', periodEnd: '2027-01-01', on: '2026-07-02' });
  assert.ok(!('error' in credit));
  if (!('error' in credit)) assert.ok(credit.credit > 0 && credit.credit < 365);
  assert.deepEqual(leaveAcademy(), { progressKept: true, institutionAccess: 'ended' });
});

test('roster claim, rollover, bulk move, and the join report use level names', () => {
  const parsed = parseJoinRoster('email,name,role,studentId,dob,level,class,phone,childStudentId\nada@school.edu.my,Ada,student,S-14,2012-04-01,IGCSE,North,,\nparent@school.edu.my,Grace,parent,,,,, ,S-14', 'north');
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows[0]?.level, 'IGCSE');
  assert.equal(parsed.rows[1]?.childStudentId, 'S-14');
  const token = claimTokenFor('north', 'ada@school.edu.my');
  const claimed = claimRosterRow(parsed.rows, token);
  assert.ok(!('error' in claimed));
  const rolled = rollRoster([{ ...roster[0]!, status: 'joined' }]);
  assert.equal(rolled.rows[0]?.level, 'A-Level');
  assert.equal(nextLevel('Professional').graduated, true);
  const moved = bulkMove(roster, ['S-14'], 'Lower Secondary', 'South');
  assert.equal(moved[0]?.level, 'Lower Secondary');
  assert.equal(moved[0]?.className, 'South');
  const report = joinReport([
    { ...roster[0]!, status: 'unclaimed' },
    { ...roster[0]!, email: 'b@school.edu.my', status: 'joined' },
    { ...roster[0]!, email: 'c@school.edu.my', status: 'pending' },
    { ...roster[0]!, email: 'd@school.edu.my', status: 'waiting' },
  ]);
  assert.deepEqual(report, { pending: 1, joined: 1, unclaimed: 1, waiting: 1, leavers: 0 });
  const links = shareLinks('https://poketschool.ai/i/north/join', 'North Academy');
  assert.match(links.whatsapp, /wa\.me/);
  assert.match(links.email, /^mailto:/);
});

test('a student sees the programmes for their level, and a paused rule waits', () => {
  const seen = programmesForLevel('IGCSE', [
    { id: 'igcse', title: 'IGCSE core', level: 'IGCSE', kind: 'programme' },
    { id: 'primary', title: 'Primary', level: 'Primary', kind: 'programme' },
    { id: 'maths', title: 'Mathematics', level: '', kind: 'category' },
  ], ['igcse', 'primary', 'maths']);
  assert.deepEqual(seen, [{ id: 'igcse', title: 'IGCSE core' }]);
  const held = decideJoin({
    policy: { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'] },
    attempt: attempt(),
    seats: seats(),
    automationOn: false,
  });
  assert.equal(held.status, 'pending');
  assert.equal(held.method, 'manual');
});

test('joinPolicy selects one check and institution.domains supplies the hosts', () => {
  const open = decideJoin({
    policy: { ...defaultJoinPolicy(), verification: 'open', emailDomains: [], rosterMatch: false, acceptInviteCode: false, manualFallback: false },
    attempt: attempt({ email: 'ada@gmail.com' }),
    seats: seats(),
  });
  assert.equal(open.status, 'approved');
  assert.equal(open.method, 'open');

  const domainPolicy = applyInstitutionJoin(
    { ...defaultJoinPolicy(), emailDomains: ['old.example'], rosterMatch: true, acceptInviteCode: true },
    { domains: ['@school.edu.my'], joinPolicy: 'domain', signupPolicy: 'invite' },
  );
  assert.deepEqual(domainPolicy.emailDomains, ['school.edu.my']);
  assert.equal(domainPolicy.verification, 'domain');
  const domainOnly = decideJoin({
    policy: domainPolicy,
    attempt: attempt({ inviteCode: 'IGCSE1' }),
    roster,
    codes: [{ code: 'IGCSE1', level: 'IGCSE', className: 'North', programmeId: 'igcse' }],
    seats: seats(),
  });
  assert.equal(domainOnly.method, 'domain');
  const wrongHost = decideJoin({
    policy: domainPolicy,
    attempt: attempt({ email: 'ada@gmail.com', inviteCode: 'IGCSE1' }),
    roster,
    codes: [{ code: 'IGCSE1', level: 'IGCSE', className: 'North', programmeId: 'igcse' }],
    seats: seats(),
  });
  assert.equal(wrongHost.status, 'pending');
  assert.equal(wrongHost.method, 'manual');

  const legacy = applyInstitutionJoin(
    { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'] },
    { signupPolicy: 'invite', allowedEmailDomains: ['other.example'] },
  );
  assert.equal(legacy.verification, undefined);
  assert.deepEqual(legacy.emailDomains, ['school.edu.my']);

  const manual = decideJoin({
    policy: { ...defaultJoinPolicy(), verification: 'manual', emailDomains: ['school.edu.my'], manualFallback: false },
    attempt: attempt(),
    roster,
    seats: seats(),
  });
  assert.equal(manual.status, 'pending');
  assert.equal(manual.method, 'manual');
});
