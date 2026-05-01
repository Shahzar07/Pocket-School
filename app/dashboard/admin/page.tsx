'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, Plus, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { profile } = useAuthSTORE();

  const data = [
    { name: 'Mon', active: 4000, new: 240 },
    { name: 'Tue', active: 3000, new: 139 },
    { name: 'Wed', active: 2000, new: 980 },
    { name: 'Thu', active: 2780, new: 390 },
    { name: 'Fri', active: 1890, new: 480 },
    { name: 'Sat', active: 2390, new: 380 },
    { name: 'Sun', active: 3490, new: 430 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Admin Portal</h1>
        <p className="text-[#5F6368]">Platform analytics and institution management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0]">
          <div className="text-sm font-medium text-[#5F6368]">Total Active Students</div>
          <div className="text-4xl font-bold text-google-blue mt-2">18,590</div>
        </Card>
        <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0]">
          <div className="text-sm font-medium text-[#5F6368]">Active Teachers</div>
          <div className="text-4xl font-bold text-google-teal mt-2">492</div>
        </Card>
        <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0]">
          <div className="text-sm font-medium text-[#5F6368]">AI Tokens Used (MTD)</div>
          <div className="text-4xl font-bold text-google-amber mt-2">4.2M</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] h-full">
            <h2 className="text-lg font-bold mb-6 text-[#202124]">Platform Usage (Past 7 Days)</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="name" stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#F8F9FA'}} />
                  <Line type="monotone" dataKey="active" stroke="#1A73E8" strokeWidth={3} dot={{r:4, fill:'#1A73E8', strokeWidth:0}} activeDot={{r:6}} />
                  <Line type="monotone" dataKey="new" stroke="#00897B" strokeWidth={3} dot={{r:4, fill:'#00897B', strokeWidth:0}} activeDot={{r:6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#202124]">Institutions</h2>
              <Button onClick={() => toast.info('Loading institution creation form...')} size="icon" variant="ghost" className="text-google-blue">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4 flex-1">
              {[
                { name: 'Lincoln High School', students: 1200, status: 'Active' },
                { name: 'Oakridge Middle', students: 850, status: 'Active' },
                { name: 'Westside Academy', students: 2100, status: 'Pending Approval' },
              ].map((inst, i) => (
                <div key={i} onClick={() => toast.info(`Viewing details for ${inst.name}`)} className="flex items-center gap-4 p-3 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] transition-colors cursor-pointer">
                  <div className={`p-3 rounded-lg ${inst.status === 'Active' ? 'bg-[#E8F0FE] text-google-blue' : 'bg-[#FFF8E1] text-google-amber'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#202124] text-sm">{inst.name}</div>
                    <div className="text-xs text-[#5F6368] flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" /> {inst.students} Students
                    </div>
                  </div>
                  <Button onClick={(e) => { e.stopPropagation(); toast.info(`Opening settings for ${inst.name}`); }} variant="ghost" size="icon" className="shrink-0 text-[#5F6368]">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={() => toast.info('Loading full institution list...')} variant="outline" className="w-full mt-4 text-google-blue border-[#DADCE0]">View All Institutions</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
