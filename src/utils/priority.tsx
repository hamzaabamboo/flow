import { AlertCircle, ArrowUp, Minus, ArrowDown } from 'lucide-react';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';

export const priorityConfig = {
  urgent: {
    color: 'red',
    label: 'Urgent',
    icon: AlertCircle,
    bg: 'red.subtle',
    fg: 'red.fg'
  },
  high: {
    color: 'orange',
    label: 'High',
    icon: ArrowUp,
    bg: 'orange.subtle',
    fg: 'orange.fg'
  },
  medium: {
    color: 'yellow',
    label: 'Medium',
    icon: Minus,
    bg: 'yellow.subtle',
    fg: 'yellow.fg'
  },
  low: {
    color: 'green',
    label: 'Low',
    icon: ArrowDown,
    bg: 'green.subtle',
    fg: 'green.fg'
  }
} as const;

export function getPriorityColor(priority?: string): string {
  if (!priority) return 'gray';
  const p = priority as Priority;
  return priorityConfig[p]?.color || 'gray';
}

export function getPriorityIcon(priority?: string) {
  if (!priority) return null;
  const p = priority as Priority;
  const Icon = priorityConfig[p]?.icon;
  return Icon ? <Icon width="14" height="14" /> : null;
}
