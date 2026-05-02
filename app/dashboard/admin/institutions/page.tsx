'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function AdminInstitutions() {
  const { profile } = useAuthSTORE();
  
  const [institutions, setInstitutions] = useState([
    { id: 1, name: 'Lincoln High School', students: 1200, status: 'Active' },
    { id: 2, name: 'Oakridge Middle', students: 850, status: 'Active' },
    { id: 3, name: 'Westside Academy', students: 2100, status: 'Pending' },
    { id: 4, name: 'Northgate High', students: 1800, status: 'Active' },
    { id: 5, name: 'Southside Elementary', students: 950, status: 'Active' },
  ]);

  const [newInstName, setNewInstName] = useState('');
  const [newInstStudents, setNewInstStudents] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddInstitution = () => {
    if (!newInstName) {
      toast.error('Institution name is required');
      return;
    }
    
    const newInst = {
      id: Date.now(),
      name: newInstName,
      students: parseInt(newInstStudents) || 0,
      status: 'Active'
    };
    
    setInstitutions([...institutions, newInst]);
    setNewInstName('');
    setNewInstStudents('');
    setIsDialogOpen(false);
    toast.success(`${newInstName} has been added successfully!`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Institutions Management</h1>
        <p className="text-[#5F6368]">Manage schools, academies, and organizations on the platform.</p>
      </div>

      <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#202124]">All Institutions</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-google-blue hover:bg-[#1967D2] text-white">
                <Plus className="w-5 h-5 mr-2" /> Add Institution
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Institution</DialogTitle>
                <DialogDescription>
                  Create a new organization to grant access to teachers and students.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Institution Name</label>
                  <Input 
                    value={newInstName} 
                    onChange={(e) => setNewInstName(e.target.value)} 
                    placeholder="e.g. Springfield Elementary" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimated Students</label>
                  <Input 
                    type="number"
                    value={newInstStudents} 
                    onChange={(e) => setNewInstStudents(e.target.value)} 
                    placeholder="e.g. 500" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddInstitution} className="bg-google-blue hover:bg-[#1967D2] text-white">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="space-y-4 flex-1">
          {institutions.map((inst, i) => (
            <div key={i} onClick={() => toast.info(`Viewing details for ${inst.name}`)} className="flex items-center gap-4 p-4 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] transition-colors cursor-pointer">
              <div className={`p-3 rounded-lg ${inst.status === 'Active' ? 'bg-[#E8F0FE] text-google-blue' : 'bg-[#FFF8E1] text-google-amber'}`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-[#202124] text-base">{inst.name}</div>
                <div className="text-sm text-[#5F6368] flex items-center gap-1 mt-1">
                  <Users className="w-4 h-4" /> {inst.students} Students
                </div>
              </div>
              <div className="text-sm font-medium pr-4">
                 {inst.status === 'Active' ? <span className="text-google-teal">Active</span> : <span className="text-google-amber">Pending</span>}
              </div>
              <Button onClick={(e) => { e.stopPropagation(); toast.info(`Opening settings for ${inst.name}`); }} variant="ghost" size="icon" className="shrink-0 text-[#5F6368]">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          ))}
          {institutions.length === 0 && (
            <div className="text-center py-8 text-[#5F6368]">No institutions found. Create one.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
