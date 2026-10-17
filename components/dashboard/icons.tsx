import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  CreditCard,
  MessageSquare,
  Settings,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_STYLE, type DashCategory } from '@/lib/dashboard/home';

const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  activity: Activity,
  'message-square': MessageSquare,
  users: Users,
  briefcase: Briefcase,
  'credit-card': CreditCard,
  shield: Shield,
  settings: Settings,
  'bar-chart-3': BarChart3,
  'users-round': UsersRound,
};

export function CategoryIcon({ category, className = 'h-6 w-6' }: { category: DashCategory; className?: string }) {
  const style = CATEGORY_STYLE[category];
  const Icon = ICONS[style.icon] ?? BookOpen;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
