'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Headphones, PlayCircle, BookOpen, Map, Presentation, PieChart, HelpCircle, FileEdit, CheckShield, ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

const FORMATS = [
  { id: 'text', name: 'Text', icon: <FileText className="w-4 h-4 mr-2" /> },
  { id: 'audio', name: 'Audio', icon: <Headphones className="w-4 h-4 mr-2" /> },
  { id: 'video', name: 'Video', icon: <PlayCircle className="w-4 h-4 mr-2" /> },
  { id: 'flashcards', name: 'Flashcards', icon: <BookOpen className="w-4 h-4 mr-2" /> },
  { id: 'mindmap', name: 'Mind Map', icon: <Map className="w-4 h-4 mr-2" /> },
  { id: 'slides', name: 'Slides', icon: <Presentation className="w-4 h-4 mr-2" /> },
  { id: 'infographic', name: 'Infographic', icon: <PieChart className="w-4 h-4 mr-2" /> },
  { id: 'quiz', name: 'Quiz', icon: <HelpCircle className="w-4 h-4 mr-2" /> },
];

export default function LessonViewer() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('text');

  return (
    <div className="max-w-7xl mx-auto flex gap-6 h-[calc(100vh-8rem)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white border border-[#DADCE0] rounded-3xl shadow-google-soft overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5 text-[#5F6368]" />
            </Button>
            <div>
              <div className="text-xs font-bold text-google-blue uppercase tracking-wider mb-1">Module 2 • Lesson 4</div>
              <h1 className="text-xl font-bold text-[#202124]">Cellular Respiration in Details</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm font-medium text-[#5F6368]">Progress</span>
              <Progress value={30} className="w-24 h-2" />
            </div>
            <Button className="rounded-full bg-google-teal hover:bg-[#00796B]">
              <CheckShield className="w-4 h-4 mr-2" /> Mark Complete
            </Button>
          </div>
        </div>

        {/* Dynamic Formats */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-[#DADCE0] bg-white overflow-x-auto shrink-0 hide-scrollbar">
              <TabsList className="bg-transparent h-auto p-0 flex gap-2 w-max">
                {FORMATS.map(f => (
                  <TabsTrigger 
                    key={f.id} 
                    value={f.id} 
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === f.id ? 'bg-[#E8F0FE] text-google-blue' : 'hover:bg-[#F1F3F4] text-[#5F6368]'
                    }`}
                  >
                    {f.icon} {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
              <TabsContent value="text" className="m-0 h-full">
                <Card className="max-w-3xl mx-auto p-8 border-transparent shadow-sm bg-white min-h-full prose prose-blue">
                   <h2>The Stages of Cellular Respiration <span className="inline-flex items-center justify-center w-5 h-5 ml-1 rounded-full bg-blue-100 text-blue-700 text-xs cursor-pointer hover:bg-blue-200" title="Source: Biology Textbook, Ch 9">1</span></h2>
                   <p>Cellular respiration is a metabolic pathway that breaks down glucose and produces ATP.</p>
                   <p>The stages include Glycolysis, Pyruvate oxidation, the Citric acid cycle, and Oxidative phosphorylation.</p>
                </Card>
              </TabsContent>
              <TabsContent value="audio" className="m-0 h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-[#E8F0FE] rounded-full mx-auto flex items-center justify-center mb-6">
                     <Headphones className="w-10 h-10 text-google-blue" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">AI generated Podcast</h3>
                  <audio controls className="w-96">
                    <source src="#" />
                  </audio>
                </div>
              </TabsContent>
              <TabsContent value="flashcards" className="m-0 h-full flex items-center justify-center">
                <div className="w-full max-w-md aspect-[3/4] [perspective:1000px] cursor-pointer group">
                  <div className="relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                    <Card className="absolute inset-0 backface-hidden p-8 flex flex-col items-center justify-center text-center bg-white shadow-google-hover border-[#DADCE0]">
                      <span className="text-sm font-bold text-google-amber mb-4 uppercase tracking-widest">Question</span>
                      <h2 className="text-2xl font-bold">What is the net ATP yield of Glycolysis?</h2>
                    </Card>
                    <Card className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center bg-[#E8F0FE] border-[#1A73E8] [transform:rotateY(180deg)] backface-hidden shadow-google-hover">
                      <span className="text-sm font-bold text-google-blue mb-4 uppercase tracking-widest">Answer</span>
                      <h2 className="text-2xl font-bold text-[#1967D2]">2 ATP</h2>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              {/* Other tabs omitted for brevity but represent interactive canvas */}
              <TabsContent value="mindmap" className="m-0 h-full flex items-center justify-center">
                 <div className="text-[#5F6368] text-center">
                   <Map className="w-16 h-16 mx-auto mb-4 text-[#DADCE0]" />
                   <p>Interactive D3 Mind Map renders here</p>
                 </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Side tools */}
      <div className="hidden lg:flex flex-col w-80 space-y-6">
        <Card className="p-4 border border-[#DADCE0] shadow-sm rounded-2xl flex-1 flex flex-col">
          <h3 className="font-bold text-[#202124] mb-4 flex items-center gap-2">
            <FileEdit className="w-4 h-4" /> My Notes
          </h3>
          <textarea 
            className="flex-1 w-full bg-[#F1F3F4] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 ring-google-blue resize-none"
            placeholder="Jot down key takeaways here..."
          />
        </Card>
      </div>
    </div>
  );
}
