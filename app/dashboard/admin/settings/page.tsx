'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Globe, Database, Mail, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

export default function AdminSystemSettings() {
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">System Settings</h1>
        <p className="text-[#5F6368]">Configure global platform settings, integrations, and preferences.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-bold text-[#202124]">General Configurations</h2>
          </div>
          <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-[#202124] mb-1">Platform Name</label>
                <Input defaultValue="Pocket School" className="max-w-md bg-[#F8F9FA]" />
             </div>
             <div>
                <label className="block text-sm font-medium text-[#202124] mb-1">Support Email</label>
                <Input defaultValue="support@pocketschool.edu" className="max-w-md bg-[#F8F9FA]" />
             </div>
             <Button onClick={() => toast.success('General settings saved!')} className="bg-google-blue hover:bg-[#1967D2] text-white">Save Changes</Button>
          </div>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-bold text-[#202124]">Email Integration</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-[#5F6368]">Configure SMTP settings for system notifications and reports.</p>
            <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-medium hover:bg-muted transition-colors">Configure SMTP</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>SMTP Server Settings</DialogTitle>
                  <DialogDescription>Enter your mail server credentials.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SMTP Host</label>
                    <Input placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port</label>
                    <Input placeholder="587" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input placeholder="user@example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input type="password" placeholder="********" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSmtpOpen(false)}>Cancel</Button>
                  <Button onClick={() => { setSmtpOpen(false); toast.success('SMTP Settings Saved!'); }} className="bg-google-blue hover:bg-[#1967D2] text-white">Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-bold text-[#202124]">Data Management</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-[#5F6368]">Manage data backups, retention policies, and storage limits.</p>
            <div className="flex gap-4">
                <Button onClick={() => toast.success('Backup initiated! Check logs later.')} variant="outline">Run Manual Backup</Button>
                
                <Dialog open={retentionOpen} onOpenChange={setRetentionOpen}>
                  <DialogTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-medium hover:bg-muted transition-colors">Retention Policies</DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Data Retention Configuration</DialogTitle>
                      <DialogDescription>Define how long to store analytics and logs.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Student Analytics History (Days)</label>
                        <Input type="number" defaultValue="365" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">System Audit Logs (Days)</label>
                        <Input type="number" defaultValue="90" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRetentionOpen(false)}>Cancel</Button>
                      <Button onClick={() => { setRetentionOpen(false); toast.success('Retention rules updated.'); }} className="bg-google-blue hover:bg-[#1967D2] text-white">Apply</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
