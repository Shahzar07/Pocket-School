'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ParentCommunications() {
  const messages = [
    { from: 'Mr. Smith (Biology)', date: 'Oct 24', message: 'Alex did great on the last quiz! Keep encouraging the flashcard reviews.' },
    { from: 'Ms. Davis (Math)', date: 'Oct 20', message: 'Just a reminder about the math project due next week.' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Communications</h1>
        <p className="text-[#5F6368]">Message teachers and review recent feedback.</p>
      </div>

      <Card className="rounded-[24px] shadow-sm border border-[#DADCE0] overflow-hidden flex flex-col h-[500px]">
         <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8F9FA]">
            {messages.map((msg, idx) => (
              <div key={idx} className="bg-white p-4 rounded-[20px] shadow-sm border border-[#DADCE0]">
                <div className="flex justify-between items-center mb-2">
                   <div className="font-bold text-[#202124]">{msg.from}</div>
                   <div className="text-xs text-[#5F6368]">{msg.date}</div>
                </div>
                <p className="text-[#3C4043]">{msg.message}</p>
              </div>
            ))}
         </div>
         <div className="p-4 bg-white border-t border-[#DADCE0] gap-3 flex">
            <Input placeholder="Type a message..." className="flex-1 rounded-full bg-[#F1F3F4]" />
            <Button onClick={() => toast.success('Message sent!')} className="rounded-full bg-google-blue shrink-0 h-10 w-10 p-0">
              <Send className="w-4 h-4 ml-1" />
            </Button>
         </div>
      </Card>
    </div>
  );
}
