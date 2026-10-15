'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getInstitution, listAcademyClasses, listAcademyInvites, listAcademyMembers, listOemLicences,
  saveAcademyClass, saveAcademyInvites, saveJoinCode, updateInstitution, type Institution,
} from '@/lib/db';
import { brandedInvite, licencePhase, makeJoinCode, parseInviteCsv, seatsRemaining, type OemLicence } from '@/lib/oem';
import { PROGRAMMES, allocationYearsFor } from '@/lib/programmes';
import { AllocationPicker } from '@/components/allocation-picker';
import { describeTargets } from '@/lib/allocation-targets';
import { institutionOrigin } from '@/lib/white-label';
import { Button } from '@/components/ui/button';
import { DashPage, DashHeader, Panel } from '@/components/dash-ui';
import { friendlyError } from '@/lib/design/system';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const today = () => new Date().toISOString().slice(0, 10);

export default function InstitutionAcademyPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [licences, setLicences] = useState<OemLicence[]>([]);
  const [members, setMembers] = useState(0);
  const [invites, setInvites] = useState(0);
  const [csv, setCsv] = useState('email,name,role\n');
  const [joinCode, setJoinCode] = useState('');
  const [className, setClassName] = useState('');
  const [classProgrammes, setClassProgrammes] = useState<string[]>([]);
  const [classCount, setClassCount] = useState(0);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      getInstitution(institutionId),
      listOemLicences(institutionId),
      listAcademyMembers(institutionId),
      listAcademyInvites(institutionId),
      listAcademyClasses(institutionId),
    ]).then(([inst, rows, people, pending, classes]) => {
      setInstitution(inst);
      setLicences(rows);
      setMembers(people.length);
      setInvites(pending.length);
      setClassCount(classes.length);
      setDisplayName(inst?.branding?.displayName ?? inst?.name ?? '');
    }).catch(() => toast.error('Could not load the academy.'));
  }, [institutionId]);

  const live = useMemo(() => licences.filter(licence => {
    const phase = licencePhase(licence, today());
    return phase === 'active' || phase === 'full';
  }), [licences]);
  const ownCourses = live.some(licence => licence.allowOwnCourses);
  const seats = live.reduce((sum, licence) => sum + seatsRemaining(licence), 0);

  const invite = async () => {
    if (!institutionId || !institution) return;
    const parsed = parseInviteCsv(csv);
    if (parsed.errors.length) { toast.error(parsed.errors[0]); return; }
    if (!parsed.rows.length) return;
    if (parsed.rows.length > seats) { toast.error(`This term has ${seats} seats left.`); return; }
    try {
      await saveAcademyInvites(institutionId, parsed.rows);
      const code = joinCode || makeJoinCode();
      setJoinCode(code);
      await saveJoinCode(institutionId, code);
      const message = brandedInvite({
        displayName: institution.branding?.displayName || institution.name,
        emailFromName: institution.branding?.emailFromName,
      }, code, institution.subdomain ? institutionOrigin(institution.subdomain) : 'https://poketschool.ai');
      setInvites(count => count + parsed.rows.length);
      toast.success(message.subject);
      await navigator.clipboard.writeText(message.text).catch(() => undefined);
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const addClass = async () => {
    if (!institutionId || !className.trim()) return;
    if (!classProgrammes.length) { toast.error('Choose at least one programme.'); return; }
    const programmeIds = classProgrammes;
    try {
      await saveAcademyClass(institutionId, { name: className.trim(), programmeIds, memberIds: [] });
      setClassCount(count => count + 1);
      setClassName('');
      setClassProgrammes([]);
      toast.success('Class created.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const saveName = async () => {
    if (!institutionId) return;
    try {
      await updateInstitution(institutionId, { branding: { ...institution?.branding, displayName: displayName.trim() } });
      toast.success('Academy name saved.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  if (!institutionId) {
    return (
      <div className="max-w-xl py-16">
        <h1 className="font-heading text-4xl">Academy</h1>
        <p className="text-sm text-muted-foreground mt-3">A platform admin still needs to attach this account to an institution before the academy tools open.</p>
      </div>
    );
  }

  return (
    <DashPage className="max-w-3xl">
      <DashHeader
        eyebrow="Today"
        title={institution?.branding?.displayName || institution?.name || 'Your academy'}
        description={`${seats} seats left · ${invites} invites waiting · ${classCount} classes.`}
        actions={
          <Button onClick={() => document.getElementById('academy-invite')?.scrollIntoView({ behavior: 'smooth' })} className="h-10 px-4 rounded-xl font-semibold text-[13px]">
            Invite people
          </Button>
        }
      />
      <Panel>
        <p className="text-sm text-muted-foreground">Invite teachers and students first. The name on certificates and emails is the academy name saved below.</p>
      </Panel>

      <section className="grid sm:grid-cols-3 gap-3">
        {[
          ['People', members],
          ['Invites waiting', invites],
          ['Seats left', seats],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-3xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Name on the academy</h2>
        <div className="flex gap-2">
          <Input value={displayName} onChange={event => setDisplayName(event.target.value)} className="rounded-xl h-11" />
          <Button onClick={() => void saveName()} className="rounded-full">Save</Button>
        </div>
        <p className="text-xs text-muted-foreground">Logo, colours, domain and certificate name are set with the platform admin. Invitations and certificates use the name saved here.</p>
      </section>

      <section id="academy-invite" className="rounded-3xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Invite teachers and students</h2>
        <Label>CSV</Label>
        <textarea className="w-full min-h-28 rounded-xl border border-border p-3 text-sm" value={csv} onChange={event => setCsv(event.target.value)} />
        <Button onClick={() => void invite()} className="rounded-full">Save invites and copy the email</Button>
        {joinCode && <p className="text-sm">Join code <span className="font-mono font-bold">{joinCode}</span>. Sending the mail through a provider is still done by copying this message.</p>}
      </section>

      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Classes</h2>
        <p className="text-xs text-muted-foreground">{classCount} classes. Choose the programmes this class can open.</p>
        <Input value={className} onChange={event => setClassName(event.target.value)} placeholder="Year 8 Science" className="rounded-xl h-11" />
        <AllocationPicker
          label="Programmes"
          chips={[]}
          allowCustom={false}
          value={classProgrammes.map(id => `programme:${id}`)}
          options={[...new Set(live.flatMap(licence => licence.programmeIds))].map(id => ({
            token: `programme:${id}`,
            label: PROGRAMMES.find(programme => programme.value === id)?.label ?? id,
            group: 'Programmes',
          }))}
          onChange={tokens => setClassProgrammes(tokens.filter(token => token.startsWith('programme:')).map(token => token.slice('programme:'.length)))}
        />
        <p className="text-sm text-muted-foreground">{describeTargets(classProgrammes.map(id => `programme:${id}`), Object.fromEntries(classProgrammes.map(id => [`programme:${id}`, PROGRAMMES.find(programme => programme.value === id)?.label ?? id])))}</p>
        {classProgrammes.length > 0 && (
          <p className="text-sm text-muted-foreground">Year / Level: {allocationYearsFor(classProgrammes).join(', ') || 'Not applicable'}</p>
        )}
        <Button onClick={() => void addClass()} className="rounded-full" disabled={!live.length}>Add class</Button>
      </section>

      {ownCourses && (
        <p className="text-sm">This licence includes the school’s own courses. <Link href="/dashboard/teacher/upload" className="font-semibold underline">Add a course</Link>.</p>
      )}
    </DashPage>
  );
}
