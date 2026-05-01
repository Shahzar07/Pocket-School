'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// NOTE: Uses NEXT_PUBLIC_GEMINI_API_KEY as per standard AI Studio requirements
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

const FORMATS = [
  'Audio Script', 'Video Script', 'Mind Map JSON', 'Infographic Data', 
  'Slide Deck', 'Data Tables', 'Flashcards', 'Quizzes', 
  'Summary Report', 'Revision Notes', 'Cheat Sheet'
];

export default function ContentUploadFlow() {
  const [file, setFile] = useState<File | null>(null);
  const [textContext, setTextContext] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Idle');
  const [results, setResults] = useState<Record<string, string>>({});

  const handleUpload = async () => {
    if (!textContext) return;
    setIsProcessing(true);
    setProgress(10);
    setCurrentStep('Extracting knowledge...');
    
    // Simulate extraction delay
    await new Promise(r => setTimeout(r, 1500));
    setProgress(30);

    try {
      // In a real app, we'd run these in parallel or use structured outputs.
      // For this demo, we'll ask Gemini to generate everything at once using a big prompt,
      // or sequentially to show progress. Let's do a fast multi-turn approach.
      
      const newResults: Record<string, string> = {};
      
      for (let i = 0; i < FORMATS.length; i++) {
        const format = FORMATS[i];
        setCurrentStep(`Generating ${format}...`);
        setProgress(30 + Math.floor(((i + 1) / FORMATS.length) * 60));
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `You are an expert curriculum designer. Based on the following source text, generate a ${format}. Output ONLY the generated content, no markdown wrappers unless it is exactly requested. For facts, append [Source: Document, P1]. Text: ${textContext.substring(0, 3000)}`
        });
        
        newResults[format] = response.text || 'Failed to generate';
      }

      setResults(newResults);
      setProgress(100);
      setCurrentStep('Complete');
    } catch (e) {
      console.error(e);
      setCurrentStep('Failed to generate content: ' + String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">AI Content Transformation Engine</h1>
        <p className="text-[#5F6368]">Upload your raw material, and let Gemini 2.5 Pro generate 11 different learning formats instantly.</p>
      </div>

      {!Object.keys(results).length ? (
        <Card className="p-8 border-dashed border-2 border-[#DADCE0] bg-[#F8F9FA] flex flex-col items-center justify-center min-h-[400px]">
          <UploadCloud className="w-16 h-16 text-google-blue mb-4" />
          <h2 className="text-xl font-bold mb-2">Drag & drop your material</h2>
          <p className="text-[#5F6368] mb-6">Supports PDF, DOCX, TXT, or paste your text below.</p>
          
          <textarea 
            className="w-full max-w-2xl h-48 p-4 rounded-xl border border-[#DADCE0] focus:ring-2 ring-google-blue outline-none mb-6"
            placeholder="Or paste your transcript / lesson text here..."
            value={textContext}
            onChange={(e) => setTextContext(e.target.value)}
          />

          {!isProcessing ? (
            <Button size="lg" className="rounded-full h-12 px-8 bg-google-blue" onClick={handleUpload} disabled={!textContext}>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate 11 Formats
            </Button>
          ) : (
            <div className="w-full max-w-md space-y-4">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-[#202124]">{currentStep}</span>
                <span className="text-google-blue">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>
      ) : (
        <AnimatePresence>
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}}>
            <h2 className="text-2xl font-bold text-[#202124] mb-4">Review AI Outputs</h2>
            <Tabs defaultValue={FORMATS[0]} className="w-full">
              <TabsList className="bg-[#E8F0FE] text-google-blue flex-wrap h-auto p-2 justify-start mb-6">
                {FORMATS.map(f => (
                  <TabsTrigger key={f} value={f} className="data-[state=active]:bg-white data-[state=active]:text-[#1967D2] data-[state=active]:shadow-sm rounded-lg px-4 py-2">
                    {f}
                  </TabsTrigger>
                ))}
              </TabsList>
              {FORMATS.map(f => (
                <TabsContent key={f} value={f}>
                  <Card className="p-6 bg-white shadow-google-soft border-[#DADCE0] min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-[#202124]">{f}</h3>
                      <div className="space-x-2">
                        <Button variant="outline" className="rounded-full">Edit</Button>
                        <Button className="rounded-full bg-google-teal hover:bg-[#00796B]">Approve</Button>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap text-[#5F6368] font-sans h-[500px] overflow-y-auto">
                      {results[f] || 'No content generated.'}
                    </div>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-8 flex justify-end">
              <Button size="lg" className="rounded-full h-14 px-8 bg-google-blue text-lg shadow-google-hover">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Publish to Students
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
