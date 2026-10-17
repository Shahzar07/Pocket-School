'use client';

/**
 * Maths Lab: a graphing calculator, a function analyser that shows f, f′ and
 * f″ together with roots and turning points, and the daily equation puzzle.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, LineChart, Sigma, Puzzle, Star, Delete, CornerDownLeft, Share2 } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';
import { DashPage, DashHeader, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { MathMarkdown } from '@/components/math-markdown';
import { compileFn, derivativeOf, exprToTex, findRoots } from '@/lib/study/math-expr';
import { dailyEquation, isValidEquation, markGuess, LENGTH, GUESSES, type Mark } from '@/lib/study/equation-puzzle';
import { isoDay } from '@/lib/study/schedule';
import { recordStudyDay } from '@/lib/study/db';

const SERIES_COLORS = ['#2786A4', '#E8A33D', '#8B5CF6', '#E5484D', '#30A46C'];
const FunctionPlot = dynamic(() => import('@/components/study/function-plot').then(mod => mod.FunctionPlot), {
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-muted sm:h-[440px]" role="status" aria-label="Loading the graph" />,
});

function usePlotHeight() {
  const [height, setHeight] = useState(280);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setHeight(query.matches ? 440 : 280);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  return height;
}

type Tool = 'graph' | 'analyse' | 'puzzle';

export default function MathsLabPage() {
  const [tool, setTool] = useState<Tool>('graph');
  return (
    <DashPage>
      <Link href="/dashboard/studio/maths" className="text-[13px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> ET Maths</Link>
      <DashHeader eyebrow="Maths Lab" title="See the maths" accent="move." description="Plot anything, take a function apart, and keep sharp with today's equation puzzle." />
      <Segmented options={[{ id: 'graph', label: 'Graphing calculator' }, { id: 'analyse', label: 'Function analysis' }, { id: 'puzzle', label: 'Guess the equation' }] as const} value={tool} onChange={setTool} />
      {tool === 'graph' && <GraphingCalculator />}
      {tool === 'analyse' && <FunctionAnalysis />}
      {tool === 'puzzle' && <EquationPuzzle />}
    </DashPage>
  );
}

function GraphingCalculator() {
  const plotHeight = usePlotHeight();
  const [fns, setFns] = useState(['x^2 - 4', 'sin(x)*3', '']);
  const active = fns.filter(f => f.trim());
  return (
    <div className="grid lg:grid-cols-12 gap-5 items-start">
      <Panel className="lg:col-span-4">
        <PanelHeader title="Functions" meta={<LineChart className="w-4 h-4 text-muted-foreground" />} />
        <div className="space-y-2">
          {fns.map((f, i) => {
            let err = false;
            if (f.trim()) { try { compileFn(f); } catch { err = true; } }
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                <span className="text-[13px] font-mono text-muted-foreground">y =</span>
                <input value={f} onChange={e => setFns(a => a.map((x, k) => (k === i ? e.target.value : x)))} placeholder="e.g. 2x + 1"
                  className={`flex-1 h-10 rounded-xl border bg-background px-3 font-mono text-[14px] outline-none focus:border-primary ${err ? 'border-rose-300' : 'border-border'}`} />
                <button onClick={() => setFns(a => a.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-rose-600" aria-label="Remove"><X className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
        {fns.length < 5 && <button onClick={() => setFns(a => [...a, ''])} className="mt-3 h-9 px-3.5 rounded-full border border-dashed border-border text-[13px] font-semibold inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /> Add a function</button>}
        <p className="text-[12px] text-muted-foreground mt-4">Try <span className="font-mono">x^3 - 3x</span>, <span className="font-mono">1/x</span>, <span className="font-mono">sqrt(x)</span>, <span className="font-mono">e^(-x^2)</span>, <span className="font-mono">|x - 2|</span>. Drag to pan, scroll to zoom.</p>
      </Panel>
      <div className="lg:col-span-8">
        <FunctionPlot functions={active.length ? active : ['x']} height={plotHeight} />
      </div>
    </div>
  );
}

function FunctionAnalysis() {
  const plotHeight = usePlotHeight();
  const [input, setInput] = useState('');
  const [range, setRange] = useState<[number, number]>([-2, 6]);
  const analysis = useMemo(() => {
    try {
      if (!input.trim()) return { ok: false as const, error: '' };
      const f = compileFn(input);
      const d1 = derivativeOf(input);
      const d2 = derivativeOf(d1);
      const f1 = compileFn(d1).fn, f2 = compileFn(d2).fn;
      const roots = findRoots(f.fn, range[0] - 20, range[1] + 20).slice(0, 8);
      const stationary = findRoots(f1, range[0] - 20, range[1] + 20).slice(0, 8).map(x => {
        const curv = f2(x);
        return { x, y: f.fn(x), kind: curv > 1e-9 ? 'Minimum' : curv < -1e-9 ? 'Maximum' : 'Point of inflection' };
      });
      return { ok: true as const, expr: f.expr, d1, d2, roots, stationary, yInt: f.fn(0) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid function' };
    }
  }, [input, range]);

  const fmt = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'undefined');

  return (
    <div className="grid lg:grid-cols-12 gap-5 items-start">
      <Panel className="lg:col-span-4">
        <PanelHeader title="f(x) =" meta={<Sigma className="w-4 h-4 text-muted-foreground" />} />
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. x^3 - 6x^2 + 9x - 2" className="w-full h-11 rounded-xl border border-border bg-background px-3 font-mono text-[15px] outline-none focus:border-primary" />
        <div className="flex items-center gap-2 mt-3 text-[13px]">
          <span className="text-muted-foreground">x from</span>
          <input type="number" aria-label="x from" value={range[0]} onChange={e => setRange([Number(e.target.value), range[1]])} className="w-20 h-9 rounded-lg border border-border px-2" />
          <span className="text-muted-foreground">to</span>
          <input type="number" aria-label="x to" value={range[1]} onChange={e => setRange([range[0], Number(e.target.value)])} className="w-20 h-9 rounded-lg border border-border px-2" />
        </div>
        {analysis.ok ? (
          <dl className="mt-5 space-y-3 text-[14px]">
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Function</dt><dd className="[&_p]:my-0"><MathMarkdown>{`$f(x) = ${exprToTex(input)}$`}</MathMarkdown></dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: SERIES_COLORS[1] }}>First derivative</dt><dd className="[&_p]:my-0"><MathMarkdown>{`$f'(x) = ${exprToTex(analysis.d1)}$`}</MathMarkdown></dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: SERIES_COLORS[2] }}>Second derivative</dt><dd className="[&_p]:my-0"><MathMarkdown>{`$f''(x) = ${exprToTex(analysis.d2)}$`}</MathMarkdown></dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">y-intercept</dt><dd className="tabular-nums">(0, {fmt(analysis.yInt)})</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Roots</dt><dd className="tabular-nums">{analysis.roots.length ? analysis.roots.map(r => `x = ${fmt(r)}`).join(', ') : 'none found in range'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Stationary points</dt>
              <dd className="space-y-0.5">{analysis.stationary.length ? analysis.stationary.map((p, i) => <p key={i} className="tabular-nums">{p.kind} at ({fmt(p.x)}, {fmt(p.y)})</p>) : 'none found in range'}</dd></div>
          </dl>
        ) : (
          analysis.error
            ? <p className="mt-4 text-[13px] text-rose-600">{analysis.error}</p>
            : null
        )}
      </Panel>
      <div className="lg:col-span-8">
        {analysis.ok && (
          <FunctionPlot
            functions={[input, analysis.d1, analysis.d2]}
            points={[...analysis.roots.map(x => ({ x, y: 0 })), ...analysis.stationary.map(p => ({ x: p.x, y: p.y, label: p.kind === 'Minimum' ? 'min' : p.kind === 'Maximum' ? 'max' : 'inflection' }))]}
            xMin={range[0]} xMax={range[1]} height={plotHeight}
          />
        )}
      </div>
    </div>
  );
}

/* ── Daily puzzle ───────────────────────────────────────────── */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+', '-', '*', '/', '='];
const TILE: Record<Mark, string> = { hit: 'bg-emerald-500 text-white border-emerald-500', near: 'bg-amber-400 text-white border-amber-400', miss: 'bg-slate-400 text-white border-slate-400' };

function EquationPuzzle() {
  const { user } = useAuthSTORE();
  const day = isoDay();
  const answer = useMemo(() => dailyEquation(day), [day]);
  const storeKey = `ps-eqpuzzle-${day}`;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(false);
  const won = guesses.includes(answer);
  const lost = !won && guesses.length >= GUESSES;

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(storeKey) ?? '[]'); if (Array.isArray(s)) setGuesses(s); } catch { /* fresh */ }
  }, [storeKey]);

  const submit = useCallback(() => {
    if (won || lost) return;
    if (current.length !== LENGTH || !isValidEquation(current)) {
      setShake(true); setTimeout(() => setShake(false), 400);
      toast.error(current.length !== LENGTH ? `Use exactly ${LENGTH} characters.` : 'That equation isn’t true — both sides must be equal.');
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* full */ }
    if (current === answer) {
      toast.success(`Solved in ${next.length}! +20 stars`);
      const rewardKey = `${storeKey}-rewarded`;
      if (user && !localStorage.getItem(rewardKey)) {
        localStorage.setItem(rewardKey, '1');
        recordStudyDay(user.uid, 20).catch(() => {});
      }
    }
  }, [current, guesses, answer, won, lost, storeKey, user]);

  const press = useCallback((k: string) => {
    if (won || lost) return;
    if (k === 'Enter') return submit();
    if (k === 'Backspace') return setCurrent(c => c.slice(0, -1));
    if (KEYS.includes(k)) setCurrent(c => (c.length < LENGTH ? c + k : c));
  }, [submit, won, lost]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter' || e.key === 'Backspace' || KEYS.includes(e.key)) { e.preventDefault(); press(e.key); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keyState: Record<string, Mark> = {};
  for (const g of guesses) markGuess(g, answer).forEach((m, i) => {
    const k = g[i], prev = keyState[k];
    if (prev === 'hit' || (prev === 'near' && m === 'miss')) return;
    keyState[k] = m;
  });

  const share = () => {
    const grid = guesses.map(g => markGuess(g, answer).map(m => (m === 'hit' ? '🟩' : m === 'near' ? '🟨' : '⬜')).join('')).join('\n');
    navigator.clipboard.writeText(`Poket School · Guess the Equation ${day}\n${won ? guesses.length : 'X'}/${GUESSES}\n${grid}`).then(() => toast.success('Copied — share it with your class.'));
  };

  const rows = Array.from({ length: GUESSES }, (_, r) => guesses[r] ?? (r === guesses.length ? current : ''));

  return (
    <div className="grid lg:grid-cols-12 gap-5 items-start">
      <Panel className="lg:col-span-7">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold inline-flex items-center gap-2"><Puzzle className="w-4 h-4 text-primary" /> Today&apos;s equation</p>
          <span className="text-[12px] font-semibold text-amber-600 inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> +20 stars</span>
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          {rows.map((row, r) => {
            const marks = r < guesses.length ? markGuess(row, answer) : null;
            return (
              <motion.div key={r} animate={r === guesses.length && shake ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }} className="grid grid-cols-8 gap-1.5">
                {Array.from({ length: LENGTH }, (_, c) => (
                  <motion.span key={c}
                    initial={marks ? { rotateX: 90 } : false} animate={{ rotateX: 0 }} transition={{ delay: c * 0.06 }}
                    className={`aspect-square rounded-xl border-2 grid place-items-center font-heading text-[22px] ${marks ? TILE[marks[c]] : row[c] ? 'border-foreground/40 text-foreground' : 'border-border text-transparent'}`}>
                    {row[c] === '*' ? '×' : row[c] === '/' ? '÷' : row[c] ?? '·'}
                  </motion.span>
                ))}
              </motion.div>
            );
          })}
        </div>
        {(won || lost) && (
          <div className="text-center mt-5">
            <p className="font-heading text-xl">{won ? `Solved in ${guesses.length} 🎉` : `Today's equation was ${answer.replace(/\*/g, '×').replace(/\//g, '÷')}`}</p>
            <p className="text-[13px] text-muted-foreground mt-1">A new equation appears tomorrow.</p>
            <button onClick={share} className="mt-3 h-9 px-4 rounded-full border border-border text-[13px] font-semibold inline-flex items-center gap-1.5"><Share2 className="w-4 h-4" /> Share result</button>
          </div>
        )}
        <div className="mt-5 max-w-md mx-auto grid grid-cols-10 gap-1.5">
          {KEYS.map(k => (
            <button key={k} onClick={() => press(k)} className={`h-11 rounded-lg font-semibold text-[16px] ${k.match(/\d/) ? '' : 'col-span-1'} ${keyState[k] ? TILE[keyState[k]] : 'bg-muted hover:bg-muted/70'}`}>
              {k === '*' ? '×' : k === '/' ? '÷' : k}
            </button>
          ))}
          <button onClick={() => press('Backspace')} className="h-11 col-span-2 rounded-lg bg-muted hover:bg-muted/70 grid place-items-center" aria-label="Delete"><Delete className="w-5 h-5" /></button>
          <button onClick={() => press('Enter')} className="h-11 col-span-3 rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-1.5"><CornerDownLeft className="w-4 h-4" /> Enter</button>
        </div>
      </Panel>
      <Panel className="lg:col-span-5">
        <PanelHeader title="How to play" />
        <ul className="space-y-2.5 text-[14px]">
          <li>Find the hidden equation in {GUESSES} tries. Every guess must be a true equation of exactly {LENGTH} characters, like <span className="font-mono">12+35=47</span>.</li>
          <li className="flex gap-2 items-center"><span className={`w-7 h-7 rounded-lg grid place-items-center font-bold ${TILE.hit}`}>4</span> Right symbol, right place.</li>
          <li className="flex gap-2 items-center"><span className={`w-7 h-7 rounded-lg grid place-items-center font-bold ${TILE.near}`}>+</span> In the equation, wrong place.</li>
          <li className="flex gap-2 items-center"><span className={`w-7 h-7 rounded-lg grid place-items-center font-bold ${TILE.miss}`}>9</span> Not in the equation.</li>
          <li className="text-muted-foreground">Normal order of operations applies: × and ÷ before + and −.</li>
        </ul>
      </Panel>
    </div>
  );
}
