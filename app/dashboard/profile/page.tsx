'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { updateUser } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Palette, Loader2, Save, ShieldCheck } from 'lucide-react';

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Omar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
];

export default function ProfilePage() {
  const { user, profile, fetchProfile } = useAuthSTORE();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [level, setLevel] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setAvatarUrl(profile.avatarUrl ?? '');
      setLevel((profile as any).level ?? '');
      setLearningStyle((profile as any).learningStyle ?? '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user || !name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      await updateUser(user.uid, { name: name.trim(), avatarUrl, ...(level ? { level } : {}), ...(learningStyle ? { learningStyle } : {}) });
      await updateProfile(user, { displayName: name.trim(), photoURL: avatarUrl || null });
      await fetchProfile(user.uid);
      toast.success('Profile updated!');
    } catch { toast.error('Failed to update profile.'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!newPw || !confirmPw || !currentPw) { toast.error('Fill in all password fields.'); return; }
    if (newPw !== confirmPw) { toast.error('New passwords do not match.'); return; }
    if (newPw.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (!user?.email) { toast.error('No email associated with this account.'); return; }
    setChangingPw(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      toast.success('Password changed successfully!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect.');
      } else {
        toast.error('Failed to change password.');
      }
    } finally { setChangingPw(false); }
  };

  const initials = (name || profile?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your personal information and preferences.</p>
      </div>

      {/* Profile Info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-foreground">Personal Information</h2>
        </div>

        {/* Current avatar preview */}
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-border">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{profile?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Display Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="rounded-xl h-11" />
        </div>

        {/* Avatar presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Choose Avatar</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_PRESETS.map((url, i) => (
              <button key={i} onClick={() => setAvatarUrl(url)}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${avatarUrl === url ? 'border-blue-500 scale-110' : 'border-transparent hover:border-blue-300'}`}
              >
                <img src={url} alt={`avatar ${i}`} className="w-full h-full object-cover bg-blue-50" />
              </button>
            ))}
          </div>
        </div>

        {/* Student-specific fields */}
        {profile?.role === 'student' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Education Level</label>
              <Select value={level} onValueChange={v => setLevel(v ?? '')}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select level…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary School</SelectItem>
                  <SelectItem value="middle">Middle School</SelectItem>
                  <SelectItem value="secondary">Secondary / High School</SelectItem>
                  <SelectItem value="igcse">IGCSE</SelectItem>
                  <SelectItem value="alevels">A-Levels</SelectItem>
                  <SelectItem value="undergraduate">Undergraduate</SelectItem>
                  <SelectItem value="postgraduate">Postgraduate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Learning Style</label>
              <Select value={learningStyle} onValueChange={v => setLearningStyle(v ?? '')}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select style…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visual">Visual</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="reading">Reading / Writing</SelectItem>
                  <SelectItem value="kinesthetic">Kinesthetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Button onClick={handleSaveProfile} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </motion.div>

      {/* Change Password */}
      {user?.providerData?.some(p => p.providerId === 'password') && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-foreground">Change Password</h2>
          </div>
          <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" className="rounded-xl h-11" />
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min 6 chars)" className="rounded-xl h-11" />
          <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" className="rounded-xl h-11" />
          <Button onClick={handleChangePassword} disabled={changingPw} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl gap-2">
            {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Change Password
          </Button>
        </motion.div>
      )}
    </div>
  );
}
