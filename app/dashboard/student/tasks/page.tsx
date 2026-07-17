'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTasks, createTask, updateTask, deleteTask, Task } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Check, Trash2, ListTodo, Loader2 } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function StudentTasksPage() {
  const { user } = useAuthSTORE();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const t = await getTasks(user.uid);
      // Defensive client-side sort (newest first)
      t.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0));
      setTasks(t);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!user || !newTitle.trim()) return;
    setAdding(true);
    try {
      // createdBy / assignedTo mirror userId so the task matches security rules
      // regardless of which field they key on.
      const newTask: Omit<Task, 'id'> & { createdBy: string; assignedTo: string } = {
        userId: user.uid,
        createdBy: user.uid,
        assignedTo: user.uid,
        title: newTitle.trim(),
        completed: false,
        priority: 'normal',
      };
      await createTask(newTask);
      setNewTitle('');
      await load();
    } catch {
      toast.error('Could not add the task. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await updateTask(task.id!, { completed: !task.completed });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    } catch {
      toast.error('Could not update the task. Please try again.');
    }
  };

  const removeTask = async (id: string) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task removed.');
    } catch {
      toast.error('Could not remove the task. Please try again.');
    }
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-10">
      {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md w-full card-glow">
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* --- Page Header --- */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Productivity</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
          My <span className="gradient-text italic">Tasks</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Keep track of your study goals and to-dos.
        </p>
      </motion.div>

      {/* --- Stat Tiles --- */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="grid grid-cols-2 sm:grid-cols-3 gap-4"
      >
        {[
          { label: 'Total', value: tasks.length, accent: 'bg-primary' },
          { label: 'Pending', value: pending.length, accent: 'bg-amber-500' },
          { label: 'Completed', value: done.length, accent: 'bg-emerald-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
          >
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${stat.accent} opacity-80`} />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{stat.label}</p>
            <p className="font-heading text-3xl text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* --- Add Task Form --- */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow"
      >
        <div className="flex gap-3">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a new task…"
            className="rounded-full h-11 flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground gap-2"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </div>
      </motion.div>

      {/* --- Empty State --- */}
      {tasks.length === 0 && (
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="relative flex flex-col items-center justify-center py-20"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <ListTodo className="w-14 h-14 text-muted-foreground/30 mb-4 relative" />
          <p className="font-heading text-2xl text-foreground relative">No tasks yet</p>
          <p className="text-muted-foreground text-sm mt-1 relative">Add your first one to get started!</p>
        </motion.div>
      )}

      {/* --- Pending Tasks --- */}
      {pending.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={3} className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">In Progress</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">To Do</h2>
          </div>
          <div className="space-y-3">
            {pending.map((task, i) => (
              <motion.div
                key={task.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center shrink-0 hover:border-primary transition-colors"
                />
                <p className="flex-1 text-sm font-medium text-foreground">{task.title}</p>
                <button
                  onClick={() => removeTask(task.id!)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* --- Completed Tasks --- */}
      {done.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={4} className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Finished</p>
            <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">Completed</h2>
          </div>
          <div className="space-y-3">
            {done.map((task, i) => (
              <motion.div
                key={task.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i}
                className="bg-muted/30 border border-border rounded-2xl p-4 flex items-center gap-4"
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
                >
                  <Check className="w-3 h-3 text-white" />
                </button>
                <p className="flex-1 text-sm text-muted-foreground line-through">{task.title}</p>
                <button
                  onClick={() => removeTask(task.id!)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
