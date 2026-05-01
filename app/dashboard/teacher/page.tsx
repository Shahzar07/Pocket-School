'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, BookOpen, Clock, FileText, CheckCircle, TrendingUp, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const { profile } = useAuthSTORE();
  const router = useRouter();
  
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  
  const [rubric, setRubric] = useState({
    score: 85,
    feedback: "Strong understanding of cellular respiration. However, please elaborate more on the Krebs Cycle's role in ATP production.",
    criteria: [
      { name: "Accuracy", max: 40, given: 35 },
      { name: "Completeness", max: 40, given: 32 },
      { name: "Clarity", max: 20, given: 18 }
    ]
  });

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') return <div>Unauthorized</div>;

  const handleOpenGrade = (assignment: any) => {
    setSelectedAssignment(assignment);
    setGradingModalOpen(true);
  };

  const handleSaveRubric = () => {
    toast.success("Feedback updated and sent to student.");
    setGradingModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">Teacher Dashboard</h1>
          <p className="text-[#5F6368]">Manage your courses, students, and content.</p>
        </div>
        <Button onClick={() => router.push('/dashboard/teacher/upload')} className="bg-google-blue hover:bg-[#1967D2] rounded-full h-12 px-6 shadow-google-soft">
          <Plus className="w-5 h-5 mr-2" /> Create New Content
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { icon: <Users className="w-6 h-6 text-google-blue" />, label: 'Total Students', value: '1,248', trend: '+12 this week' },
          { icon: <BookOpen className="w-6 h-6 text-google-teal" />, label: 'Active Courses', value: '12', trend: '3 drafts' },
          { icon: <FileText className="w-6 h-6 text-google-amber" />, label: 'To Grade', value: '34', trend: 'From 2 courses' },
          { icon: <Clock className="w-6 h-6 text-[#E53935]" />, label: 'Live Classes', value: '2', trend: 'Starting in 2h' },
        ].map((stat, i) => (
          <Card key={i} className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#DADCE0]">
                {stat.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-[#202124] mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-[#202124]">{stat.label}</div>
            <div className="text-xs text-[#5F6368] mt-1">{stat.trend}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Quick Grading Summary */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#202124]">Needs Grading</h2>
              <Button variant="ghost" className="text-google-blue font-medium">Open Gradebook</Button>
            </div>
            <Card className="rounded-[20px] shadow-sm border border-[#DADCE0] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#DADCE0]">
                    <th className="p-4 font-medium text-[#5F6368] text-sm">Assignment</th>
                    <th className="p-4 font-medium text-[#5F6368] text-sm hidden sm:table-cell">Course</th>
                    <th className="p-4 font-medium text-[#5F6368] text-sm">Pending</th>
                    <th className="p-4 font-medium text-[#5F6368] text-sm text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { title: 'Mitosis Lab Report', course: 'Biology 101', count: 18 },
                    { title: 'Chapter 4 Quiz', course: 'Biology 101', count: 12 },
                    { title: 'Kinematics Problem Set', course: 'Physics Honors', count: 4 },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[#DADCE0] last:border-0 hover:bg-[#F8F9FA]">
                      <td className="p-4">
                        <div className="text-[#202124] font-medium">{row.title}</div>
                        <div className="text-[#5F6368] text-xs sm:hidden">{row.course}</div>
                      </td>
                      <td className="p-4 text-[#5F6368] hidden sm:table-cell">{row.course}</td>
                      <td className="p-4">
                        <span className="bg-[#FFF8E1] text-[#F9AB00] font-bold px-3 py-1 rounded-full text-xs">
                          {row.count} items
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" className="text-google-blue hover:bg-google-blue/10" onClick={() => handleOpenGrade(row)}>Grade</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          {/* Recent Uploads & AI Generation */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#202124]">Content Pipeline</h2>
            </div>
            <Card className="rounded-[20px] shadow-sm border border-[#DADCE0] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#DADCE0]">
                    <th className="p-4 font-medium text-[#5F6368] text-sm">Material Name</th>
                    <th className="p-4 font-medium text-[#5F6368] text-sm hidden sm:table-cell">Target Course</th>
                    <th className="p-4 font-medium text-[#5F6368] text-sm">AI Processing</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { course: 'Biology 101', name: 'Cellular_Respiration.pdf', status: 'Complete', progress: 100 },
                    { course: 'Advanced Physics', name: 'Quantum_Mechanics_Ch3.mp4', status: 'Extracting Concepts...', progress: 45 },
                    { course: 'World History', name: 'WW2_Timeline.docx', status: 'Generating Quiz...', progress: 80 },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[#DADCE0] last:border-0 hover:bg-[#F8F9FA]">
                      <td className="p-4">
                        <div className="text-[#202124] font-medium">{row.name}</div>
                        <div className="text-[#5F6368] text-xs sm:hidden">{row.course}</div>
                      </td>
                      <td className="p-4 text-[#5F6368] hidden sm:table-cell">{row.course}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${row.progress === 100 ? 'text-[#00897B]' : 'text-google-blue'}`}>
                              {row.status}
                            </span>
                            <span className="text-xs text-[#5F6368]">{row.progress}%</span>
                          </div>
                          <Progress value={row.progress} className={`h-1.5 ${row.progress === 100 ? '[&>div]:bg-[#00897B]' : ''}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </div>

        {/* Student Analytics Side Panel */}
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#202124] mb-4">Student Analytics</h2>
            <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-google-blue" />
                  <h3 className="font-bold text-[#202124]">Class Performance</h3>
                </div>
                <p className="text-sm text-[#5F6368] mb-4">Average score across all Biology 101 assessments is up by 4% this month.</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#5F6368]">A (90-100%)</span>
                      <span className="font-bold text-[#202124]">35%</span>
                    </div>
                    <Progress value={35} className="h-2 bg-[#E0F2F1] [&>div]:bg-[#00897B]" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#5F6368]">B (80-89%)</span>
                      <span className="font-bold text-[#202124]">45%</span>
                    </div>
                    <Progress value={45} className="h-2 bg-[#E8F0FE] [&>div]:bg-google-blue" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#5F6368]">C & Below</span>
                      <span className="font-bold text-[#202124]">20%</span>
                    </div>
                    <Progress value={20} className="h-2 bg-[#FFF8E1] [&>div]:bg-google-amber" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#DADCE0]">
                <h3 className="font-bold text-[#202124] mb-4">Struggling Students</h3>
                <div className="space-y-3">
                  {[
                    { initials: 'JD', name: 'John Doe', issue: 'Failed last 2 quizzes' },
                    { initials: 'AS', name: 'Anna Smith', issue: 'Missed 3 assignments' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-red-100 text-[#E53935] text-xs">{s.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-bold text-[#202124]">{s.name}</div>
                        <div className="text-xs text-[#E53935]">{s.issue}</div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-2 text-google-blue">View All Reports</Button>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {gradingModalOpen && selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[24px] shadow-google-hover border border-[#DADCE0] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-[#DADCE0] flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-[#202124]">Review AI Grading</h2>
                  <p className="text-sm text-[#5F6368]">{selectedAssignment.title} - Sample Student</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setGradingModalOpen(false)}>
                  <X className="w-5 h-5 text-[#5F6368]" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div>
                   <h3 className="text-sm font-bold text-[#202124] mb-3 uppercase tracking-wider">AI Generated Rubric & Score</h3>
                   <div className="bg-[#E8F0FE] text-[#1967D2] p-4 rounded-xl flex items-center justify-between mb-4">
                     <span className="font-medium">Suggested Overall Score</span>
                     <Input 
                       type="number" 
                       value={rubric.score} 
                       onChange={(e) => setRubric(r => ({...r, score: Number(e.target.value)}))}
                       className="w-20 font-bold text-center bg-white border-[#DADCE0]"
                     />
                   </div>
                   
                   <div className="space-y-4">
                     {rubric.criteria.map((c, i) => (
                       <div key={i} className="flex items-center gap-4 border border-[#DADCE0] p-3 rounded-xl">
                         <div className="flex-1">
                           <div className="text-sm font-medium text-[#202124]">{c.name}</div>
                           <div className="text-xs text-[#5F6368]">Max point: {c.max}</div>
                         </div>
                         <div className="flex items-center gap-2">
                           <Input 
                             type="number" 
                             value={c.given} 
                             onChange={(e) => {
                               const newCriteria = [...rubric.criteria];
                               newCriteria[i].given = Number(e.target.value);
                               setRubric(r => ({...r, criteria: newCriteria}));
                             }}
                             className="w-16 h-8 text-center text-sm bg-[#F8F9FA]"
                           />
                           <span className="text-sm text-[#5F6368]">/ {c.max}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#202124] mb-3 uppercase tracking-wider">Feedback Notes</h3>
                  <Textarea 
                    value={rubric.feedback}
                    onChange={(e) => setRubric(r => ({...r, feedback: e.target.value}))}
                    rows={4}
                    className="w-full resize-none rounded-xl border-[#DADCE0] focus:ring-google-blue focus:border-google-blue"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-[#DADCE0] bg-[#F8F9FA] flex justify-end gap-3 shrink-0">
                <Button variant="ghost" onClick={() => setGradingModalOpen(false)}>Cancel</Button>
                <Button className="bg-google-blue hover:bg-[#1967D2] shadow-google-soft" onClick={handleSaveRubric}>
                  Save & Return to Student
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
