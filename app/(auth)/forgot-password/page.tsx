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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-email') toast.error('Invalid email address.');
      // Don't reveal whether an account exists — show the same success screen.
      else if (code === 'auth/user-not-found') setSent(true);
      else toast.error('Could not send reset email. Please try again.');
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
            <h2 className="text-3xl font-bold text-white mb-2">Reset your password</h2>
            <p className="text-white/45 text-sm">
              Enter your account email and we&apos;ll send you a secure reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-2"
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#1A73E8]/15 border border-[#1A73E8]/30 flex items-center justify-center mb-6">
            <MailCheck className="w-7 h-7 text-[#60A5FA]" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-white/45 text-sm mb-8">
            If an account exists for <span className="text-white/70 font-semibold">{email}</span>,
            a password reset link is on its way. Check spam too.
          </p>
          <Button
            onClick={() => { setSent(false); setEmail(''); }}
            variant="outline"
            className="rounded-2xl border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            Use a different email
          </Button>
        </div>
      )}

      <p className="text-center mt-7 text-white/40 text-sm">
        Remembered it?{' '}
        <Link href="/login" className="text-[#60A5FA] font-semibold hover:text-[#93C5FD] transition-colors">Back to Sign In</Link>
      </p>
    </motion.div>
  );
}
