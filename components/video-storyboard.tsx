'use client';

import { Video } from 'lucide-react';

export interface Scene {
  title: string;
  visual: string;
  narration: string;
}

export function parseScenes(script: string): Scene[] {
  const lines = script.split('\n');
  const scenes: Scene[] = [];
  let current: { title: string; visual: string; narration: string[] } | null = null;

  for (const line of lines) {
    const sceneMatch = line.match(/^###?\s*Scene\s*\d+\s*[—–-]?\s*(.*)/i) || line.match(/^###?\s*(\d+\.\s*.*)/);
    if (sceneMatch) {
      if (current) scenes.push({ title: current.title, visual: current.visual, narration: current.narration.join('\n').trim() });
      current = { title: sceneMatch[1].trim() || `Scene ${scenes.length + 1}`, visual: '', narration: [] };
      continue;
    }
    if (!current) {
      const headerMatch = line.match(/^##?\s*(.*)/);
      if (headerMatch) {
        current = { title: headerMatch[1].trim(), visual: '', narration: [] };
        continue;
      }
      continue;
    }
    const visualMatch = line.match(/\[VISUAL:\s*(.*?)\]?$/i) || line.match(/^\*?\*?Visual\*?\*?:\s*(.*)/i);
    if (visualMatch) {
      current.visual = visualMatch[1].replace(/\]$/, '').trim();
      continue;
    }
    if (line.trim()) current.narration.push(line);
  }
  if (current) scenes.push({ title: current.title, visual: current.visual, narration: current.narration.join('\n').trim() });
  if (scenes.length === 0) {
    scenes.push({ title: 'Full Script', visual: '', narration: script });
  }
  return scenes;
}

export function VideoStoryboard({ script, dark }: { script: string; dark?: boolean }) {
  const scenes = parseScenes(script);

  const cardBg = dark ? 'border-white/10' : 'border-border';
  const headerBg = dark ? 'from-red-500/10 to-rose-500/5 border-white/10' : 'from-red-500/10 to-rose-500/5 border-border';
  const numBg = dark ? 'bg-red-500/20 text-red-400' : 'bg-red-500/15 text-red-600';
  const titleColor = dark ? 'text-white' : 'text-foreground';
  const visualBg = dark ? 'bg-white/[0.02] border-white/5' : 'bg-muted/50 border-border/50';
  const visualLabel = dark ? 'text-cyan-400' : 'text-cyan-600';
  const narrationColor = dark ? 'text-slate-300' : 'text-muted-foreground';
  const bannerBg = dark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200';
  const bannerText = dark ? 'text-amber-300' : 'text-amber-700';
  const bannerIcon = dark ? 'text-amber-400' : 'text-amber-500';
  const labelColor = dark ? 'text-slate-400' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${labelColor}`}>Video Storyboard</p>
          <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-muted-foreground/60'}`}>Scene-by-scene script with visual directions</p>
        </div>
      </div>
      {scenes.map((scene, i) => (
        <div key={i} className={`relative rounded-xl border overflow-hidden ${cardBg}`}>
          <div className={`bg-gradient-to-r ${headerBg} px-5 py-3 border-b flex items-center gap-3`}>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${numBg}`}>
              {i + 1}
            </div>
            <h4 className={`font-heading text-sm ${titleColor}`}>{scene.title}</h4>
          </div>
          {scene.visual && (
            <div className={`px-5 py-2.5 border-b flex items-start gap-2 ${visualBg}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 mt-0.5 ${visualLabel}`}>Visual</span>
              <p className={`text-xs italic ${narrationColor}`}>{scene.visual}</p>
            </div>
          )}
          <div className="px-5 py-4">
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${narrationColor}`}>{scene.narration}</p>
          </div>
        </div>
      ))}
      <div className={`rounded-xl px-5 py-3 flex items-center gap-3 border ${bannerBg}`}>
        <Video className={`w-4 h-4 shrink-0 ${bannerIcon}`} />
        <p className={`text-xs ${bannerText}`}>Full animated video production coming soon. This storyboard can be used as a study guide or production brief.</p>
      </div>
    </div>
  );
}
