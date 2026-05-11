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

export default function StudentTasksPage() {
  const { user } = useAuthSTORE();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!user) return;
    const t = await getTasks(user.uid);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleAdd = async () => {
    if (!user || !newTitle.trim()) return;
    setAdding(true);
    await createTask({ userId: user.uid, title: newTitle.trim(), completed: false, priority: 'normal' });
    setNewTitle('');
    await load();
    setAdding(false);
  };

  const toggleTask = async (task: Task) => {
    await updateTask(task.id!, { completed: !task.completed });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = async (id: string) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Task removed.');
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">Keep track of your study goals and to-dos.</p>
      </div>

      <div className="flex gap-3">
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add a new task…"
          className="rounded-xl h-11 flex-1"
        />
        <Button onClick={handleAdd} disabled={adding || !newTitle.trim()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl px-4">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </Button>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No tasks yet. Add your first one!</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Do ({pending.length})</p>
          {pending.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
            >
              <button onClick={() => toggleTask(task)}
                className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center shrink-0 hover:border-blue-500 transition-colors"
              />
              <p className="flex-1 text-sm font-medium text-foreground">{task.title}</p>
              <button onClick={() => removeTask(task.id!)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed ({done.length})</p>
          {done.map((task, i) => (
            <div key={task.id} className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
              <button onClick={() => toggleTask(task)}
                className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0"
              >
                <Check className="w-3 h-3 text-white" />
              </button>
              <p className="flex-1 text-sm text-muted-foreground line-through">{task.title}</p>
              <button onClick={() => removeTask(task.id!)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
