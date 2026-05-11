'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Key, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

export default function AdminAccessConfig() {
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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
    </div>
  );
}
