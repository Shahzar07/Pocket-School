'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Globe, Database, Mail, Loader2, Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { getAllUsers, getPlatformSettings, savePlatformSettings } from '@/lib/db';
import { AdminPricingPanel } from '@/components/admin-pricing-panel';
import { FlagToggles } from '@/components/scope-c/flag-toggles';
import { SMTP_PRESETS, smtpPreset } from '@/lib/smtp-presets';
import { useAuthSTORE } from '@/hooks/use-auth';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function AdminSystemSettings() {
  const { user } = useAuthSTORE();
  const [sectionQuery, setSectionQuery] = useState('');
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);

  const [platformName, setPlatformName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [presetId, setPresetId] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [retentionDays, setRetentionDays] = useState('365');
  const show = (label: string) => {
    const q = sectionQuery.trim().toLowerCase();
    return !q || label.toLowerCase().includes(q);
  };

  const load = () => {
    setLoading(true);
    setLoadError(false);
    getPlatformSettings()
      .then(s => {
        setPlatformName(s.platformName ?? 'Poket School');
        setSupportEmail(s.supportEmail ?? '');
        setSmtpHost(s.smtpHost ?? '');
        setSmtpPort(s.smtpPort ?? '');
        setSmtpUser(s.smtpUser ?? '');
        setPresetId(s.smtpPreset ?? '');
        setRetentionDays(String(s.retentionDays ?? 365));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await savePlatformSettings({ platformName: platformName.trim(), supportEmail: supportEmail.trim() });
      toast.success('General settings saved!');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save settings.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      await savePlatformSettings({
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim(),
        smtpUser: smtpUser.trim(),
        smtpPreset: presetId,
      });
      toast.success('SMTP settings saved!');
      setSmtpOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save SMTP settings.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSaveRetention = async () => {
    const days = Number(retentionDays);
    if (!Number.isFinite(days) || days <= 0) { toast.error('Enter a valid number of days.'); return; }
    setSavingRetention(true);
    try {
      await savePlatformSettings({ retentionDays: days });
      toast.success('Retention policy saved!');
      setRetentionOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save retention policy.');
    } finally {
      setSavingRetention(false);
    }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-5 pt-2">
      {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-2">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <Globe className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load platform settings</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching settings. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={load}>Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
          <span className="w-5 h-px bg-violet-600 inline-block" /> Platform configuration
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          System <span className="gradient-text italic">settings</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Configure global platform settings, integrations, and preferences.</p>
      </motion.header>

      <Input
        value={sectionQuery}
        onChange={(e) => setSectionQuery(e.target.value)}
        placeholder="Search settings — SMTP, retention, pricing, flags"
        aria-label="Search settings"
        className="rounded-full h-11 max-w-lg"
      />

      {show('pricing money plans') && <AdminPricingPanel />}

      <div className="space-y-5">
        {show('flags features') && <FlagToggles />}
        {/* General */}
        {show('general name support email') && <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-violet-500 opacity-80" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-2xl text-foreground">General Configurations</h2>
          </div>
          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Platform Name</label>
              <Input value={platformName} onChange={e => setPlatformName(e.target.value)} className="rounded-xl h-11 bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Support Email</label>
              <Input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="support@example.com" className="rounded-xl h-11 bg-muted/50" />
            </div>
            <Button onClick={handleSaveGeneral} disabled={savingGeneral} className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white gap-2">
              {savingGeneral && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </motion.div>}

        {/* Email */}
        {show('email smtp mail gmail sendgrid') && <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-[#2786A4] opacity-80" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2786A4] to-[#1E6A83] flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-2xl text-foreground">Email Integration</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Configure SMTP settings for system notifications and reports.</p>
          <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
            <DialogTrigger>
              <Button variant="outline" className="rounded-full h-11 px-5 font-semibold">Configure SMTP</Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl">SMTP Server Settings</DialogTitle>
                <DialogDescription>Enter your mail server details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {SMTP_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const next = smtpPreset(preset.id);
                        if (!next) return;
                        setPresetId(next.id);
                        setSmtpHost(next.host);
                        setSmtpPort(next.port);
                        if (!smtpUser.trim()) setSmtpUser(next.userHint);
                      }}
                      className={`h-8 px-3 rounded-full text-xs font-semibold border ${presetId === preset.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">SMTP Host</label>
                  <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Port</label>
                  <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="user@example.com" className="rounded-xl h-11" />
                </div>
                <p className="text-xs text-muted-foreground">
                  The SMTP password is the <code className="font-mono">SMTP_PASS</code> environment variable. Presets fill the host only. A super admin can send a test.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Send a test to</label>
                  <Input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSmtpOpen(false)} className="rounded-full">Cancel</Button>
                <Button variant="outline" disabled={testing} className="rounded-full" onClick={async () => {
                  setTesting(true);
                  try {
                    const token = await user?.getIdToken();
                    const response = await fetch('/api/admin/smtp-test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, to: testTo }),
                    });
                    const payload = await response.json() as { error?: string };
                    if (!response.ok) toast.error(payload.error || 'Test failed.');
                    else toast.success('Test email sent.');
                  } catch {
                    toast.error('Test failed.');
                  } finally {
                    setTesting(false);
                  }
                }}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send test'}
                </Button>
                <Button onClick={handleSaveSmtp} disabled={savingSmtp} className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold gap-2">
                  {savingSmtp && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Settings
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>}

        {/* Data Management */}
        {show('data retention export import backup') && <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-emerald-500 opacity-80" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-2xl text-foreground">Data Management</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Manage data backups and retention policies.</p>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => toast.info('Automatic daily backups are managed by Firebase. Manual export is available in the Firebase console.')}
              variant="outline" className="rounded-full h-11 px-5 font-semibold"
            >
              About Backups
            </Button>
            <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={() => {
              const blob = new Blob([JSON.stringify({ platformName, supportEmail, smtpHost, smtpPort, smtpUser, smtpPreset: presetId, retentionDays: Number(retentionDays) }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'platform-settings.json';
              link.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4 mr-1.5" /> Export settings
            </Button>
            <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={async () => {
              const people = await getAllUsers();
              const rows = people.map((person) => ({ id: person.id, name: person.data.name, email: person.data.email, role: person.data.role }));
              const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'people.json';
              link.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4 mr-1.5" /> Export people
            </Button>
            <label className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border text-sm font-semibold cursor-pointer">
              <Upload className="w-4 h-4" /> Import settings
              <input type="file" accept="application/json" className="sr-only" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
                  if ('password' in parsed || 'smtpPass' in parsed) {
                    toast.error('Refusing a file that contains a password.');
                    return;
                  }
                  await savePlatformSettings({
                    platformName: typeof parsed.platformName === 'string' ? parsed.platformName : platformName,
                    supportEmail: typeof parsed.supportEmail === 'string' ? parsed.supportEmail : supportEmail,
                    smtpHost: typeof parsed.smtpHost === 'string' ? parsed.smtpHost : smtpHost,
                    smtpPort: typeof parsed.smtpPort === 'string' ? parsed.smtpPort : smtpPort,
                    smtpUser: typeof parsed.smtpUser === 'string' ? parsed.smtpUser : smtpUser,
                    smtpPreset: typeof parsed.smtpPreset === 'string' ? parsed.smtpPreset : presetId,
                    retentionDays: typeof parsed.retentionDays === 'number' ? parsed.retentionDays : Number(retentionDays),
                  });
                  toast.success('Settings imported.');
                  load();
                } catch {
                  toast.error('That file is not settings JSON.');
                }
              }} />
            </label>
            <Dialog open={retentionOpen} onOpenChange={setRetentionOpen}>
              <DialogTrigger>
                <Button variant="outline" className="rounded-full h-11 px-5 font-semibold">Retention Policies</Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl">Data Retention Configuration</DialogTitle>
                  <DialogDescription>Define how long to store analytics and logs.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Retention Period (Days)</label>
                    <Input type="number" min={1} value={retentionDays} onChange={e => setRetentionDays(e.target.value)} className="rounded-xl h-11" />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setRetentionOpen(false)} className="rounded-full">Cancel</Button>
                  <Button onClick={handleSaveRetention} disabled={savingRetention} className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold gap-2">
                    {savingRetention && <Loader2 className="w-4 h-4 animate-spin" />}
                    Apply
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>}
      </div>
    </div>
  );
}
