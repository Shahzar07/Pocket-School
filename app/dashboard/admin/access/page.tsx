'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, Lock, Users, Search, Sparkles, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { getUserByEmail, setUserSubscription, UserProfile } from '@/lib/db';

export default function AdminAccessConfig() {
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; data: UserProfile } | null>(null);
  const [searched, setSearched] = useState(false);
  const [updatingTier, setUpdatingTier] = useState(false);

  const handleSearch = async () => {
    const email = searchEmail.trim();
    if (!email) return;
    setSearching(true);
    setSearched(false);
    try {
      const result = await getUserByEmail(email);
      setFoundUser(result);
      setSearched(true);
      if (!result) toast.error('No user found with that email');
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSetTier = async (tier: 'free' | 'academic') => {
    if (!foundUser) return;
    setUpdatingTier(true);
    try {
      await setUserSubscription(foundUser.id, tier);
      const refreshed = await getUserByEmail(foundUser.data.email);
      setFoundUser(refreshed);
      toast.success(
        tier === 'academic'
          ? 'Academic subscription activated — +400⚡ granted'
          : 'Subscription set to Free'
      );
    } catch {
      toast.error('Failed to update subscription');
    } finally {
      setUpdatingTier(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Access Configuration</h1>
        <p className="text-[#5F6368]">Manage role-based access control and security policies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-google-blue/10 text-google-blue rounded-xl">
               <Shield className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-bold text-[#202124]">Role Permissions</h2>
           </div>
           <p className="text-[#5F6368] mb-6">Define what actions each role (Admin, Teacher, Student, Parent) can perform within the system.</p>
           
           <Dialog open={isRolesOpen} onOpenChange={setIsRolesOpen}>
             <DialogTrigger className="w-full inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-medium hover:bg-muted transition-colors">Edit Roles</DialogTrigger>
             <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Role Permissions</DialogTitle>
                  <DialogDescription>Modify granular access controls for each platform role.</DialogDescription>
                </DialogHeader>
                <div className="py-6 text-[#5F6368]">
                   Role matrix editor will be initialized here.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRolesOpen(false)}>Close</Button>
                  <Button className="bg-google-blue hover:bg-[#1967D2] text-white">Save Permissions</Button>
                </DialogFooter>
             </DialogContent>
           </Dialog>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-google-teal/10 text-google-teal rounded-xl">
               <Key className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-bold text-[#202124]">Authentication Settings</h2>
           </div>
           <p className="text-[#5F6368] mb-6">Configure SSO, standard login scopes, multifactor authentication, and session limits.</p>
           
           <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
             <DialogTrigger className="w-full inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-medium hover:bg-muted transition-colors">Configure Auth</DialogTrigger>
             <DialogContent>
                <DialogHeader>
                  <DialogTitle>Authentication Configuration</DialogTitle>
                  <DialogDescription>Setup Google Workspace SSO and authentication limits.</DialogDescription>
                </DialogHeader>
                <div className="py-6 text-[#5F6368]">
                   SSO providers and identity access forms will appear here.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAuthOpen(false)}>Close</Button>
                  <Button className="bg-google-blue hover:bg-[#1967D2] text-white">Save Auth Config</Button>
                </DialogFooter>
             </DialogContent>
           </Dialog>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-google-amber/10 text-google-amber rounded-xl">
               <Lock className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-bold text-[#202124]">Security Policies</h2>
           </div>
           <p className="text-[#5F6368] mb-6">Manage password complexity, expiration requirements, and IP whitelisting.</p>
           <Button onClick={() => toast.info('Opening Security Policies...')} variant="outline" className="w-full">Manage Policies</Button>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-gray-100 text-gray-700 rounded-xl">
               <Users className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-bold text-[#202124]">User Audit Logs</h2>
           </div>
           <p className="text-[#5F6368] mb-6">Review login history, permission changes, and access records for all users.</p>
           <Button onClick={() => toast.info('Loading Audit Logs...')} variant="outline" className="w-full">View Logs</Button>
        </Card>
      </div>

      <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-google-amber/10 text-google-amber rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#202124]">Subscription &amp; Sparks</h2>
            <p className="text-[#5F6368]">Look up a user by email and manage their Academic subscription tier.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 max-w-md">
          <Input
            type="email"
            placeholder="student@example.com"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching || !searchEmail.trim()} className="bg-google-blue hover:bg-[#1967D2] text-white shrink-0">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-2">Search</span>
          </Button>
        </div>

        {foundUser && (
          <div className="rounded-2xl border border-[#DADCE0] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[#202124]">{foundUser.data.name}</p>
                <Badge variant="outline" className="capitalize">{foundUser.data.role}</Badge>
                {foundUser.data.yearGroup && (
                  <Badge variant="outline" className="gap-1"><GraduationCap className="w-3 h-3" />{foundUser.data.yearGroup}</Badge>
                )}
                <Badge className={foundUser.data.subscriptionTier === 'academic' ? 'bg-google-amber/10 text-google-amber border-google-amber/20' : 'bg-gray-100 text-gray-700'}>
                  {foundUser.data.subscriptionTier === 'academic' ? 'Academic' : 'Free'}
                </Badge>
              </div>
              <p className="text-sm text-[#5F6368] mt-1">{foundUser.data.email}</p>
              <p className="text-sm text-[#5F6368] mt-1">⚡ {foundUser.data.sparksBalance ?? 0} Sparks</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={updatingTier || foundUser.data.subscriptionTier !== 'academic'}
                onClick={() => handleSetTier('free')}
              >
                Set to Free
              </Button>
              <Button
                disabled={updatingTier || foundUser.data.subscriptionTier === 'academic'}
                onClick={() => handleSetTier('academic')}
                className="bg-google-amber hover:bg-google-amber/90 text-white"
              >
                {updatingTier ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Grant Academic (+400⚡)
              </Button>
            </div>
          </div>
        )}

        {searched && !foundUser && (
          <p className="text-sm text-[#5F6368]">No user found with that email address.</p>
        )}
      </Card>
    </div>
  );
}
