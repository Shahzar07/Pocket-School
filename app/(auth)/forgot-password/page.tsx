'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { automationEnabled } from '@/lib/automation-status';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('authForm.needEmail'));
      return;
    }
    setLoading(true);
    try {
      if (!(await automationEnabled('password_reset'))) {
        toast.error('A super admin sends password resets at the moment.');
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-email') toast.error(t('authForm.invalidEmail'));
      // Don't reveal whether an account exists — show the same success screen.
      else if (code === 'auth/user-not-found') setSent(true);
      else toast.error(t('authForm.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {!sent ? (
        <>
          <div className="mb-9">
            <h2 className="text-3xl font-bold text-white mb-2">{t('authForm.resetTitle')}</h2>
            <p className="text-white/45 text-sm">
              {t('authForm.resetHint')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t('authForm.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary focus:ring-primary/20 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground hover:brightness-110 font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-2"
              disabled={loading}
            >
              {loading ? t('authForm.sending') : t('authForm.sendReset')}
            </Button>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
            <MailCheck className="w-7 h-7 text-[#6FBBCE]" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('authForm.inboxTitle')}</h2>
          <p className="text-white/45 text-sm mb-8">
            {t('authForm.inboxBody', { email })}
          </p>
          <Button
            onClick={() => { setSent(false); setEmail(''); }}
            variant="outline"
            className="rounded-2xl border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {t('authForm.differentEmail')}
          </Button>
        </div>
      )}

      <p className="text-center mt-7 text-white/40 text-sm">
        {t('authForm.remembered')}{' '}
        <Link href="/login" className="text-[#6FBBCE] font-semibold hover:text-[#93C5FD] transition-colors">{t('authForm.back')}</Link>
      </p>
    </motion.div>
  );
}
