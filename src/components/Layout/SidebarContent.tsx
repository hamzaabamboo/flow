import React from 'react';
import {
  LayoutGrid,
  Calendar,
  Inbox,
  Target,
  Briefcase,
  Home,
  Command,
  Timer,
  LogOut,
  CheckSquare,
  Settings,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { InboxItem, Task, Habit } from '../../shared/types';
import { useSpace } from '../../contexts/SpaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Link } from '../ui/link';
import { Avatar } from '../ui/avatar';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Box, VStack, HStack, Divider } from 'styled-system/jsx';

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: 'inbox' | 'agenda' | 'tasks';
}

const navItems: SidebarNavItem[] = [
  { label: 'Agenda', href: '/', icon: Calendar, badgeKey: 'agenda' },
  { label: 'Boards', href: '/boards', icon: LayoutGrid },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare, badgeKey: 'tasks' },
  { label: 'Inbox', href: '/inbox', icon: Inbox, badgeKey: 'inbox' },
  { label: 'Habits', href: '/habits', icon: Target }
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function isActiveRoute(href: string, currentPath: string): boolean {
  if (href === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(href);
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { currentSpace, toggleSpace } = useSpace();
  const { user, logout } = useAuth();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Get today's date for queries
  const today = new Date().toISOString().split('T')[0];

  // Fetch inbox count
  const { data: inboxItems = [] } = useQuery<InboxItem[]>({
    queryKey: ['inbox', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/inbox?space=${currentSpace}`);
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch today's tasks (incomplete with due date today or overdue)
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?space=${currentSpace}`);
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch today's habits (incomplete)
  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ['habits', today, currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/habits?date=${today}&space=${currentSpace}`);
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Calculate badge counts
  const inboxCount = inboxItems.length;

  const incompleteTasks = tasks.filter((task) => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    const todayDate = new Date(today);
    return dueDate <= todayDate; // Today or overdue
  });

  const incompleteHabits = habits.filter((habit) => !habit.completedToday);

  const agendaCount = incompleteTasks.length + incompleteHabits.length;
  const tasksCount = tasks.filter((task) => !task.completed).length;

  const badgeCounts: Record<string, number> = {
    inbox: inboxCount,
    agenda: agendaCount,
    tasks: tasksCount
  };

  return (
    <VStack gap="0" h="full">
      {/* Logo & Close Button */}
      <Box w="full" p="4" pb="2">
        <HStack justifyContent="space-between" alignItems="center">
          <HStack gap="3" alignItems="center">
            <Box w="10" h="10">
              <img src="/logo-no-bg.svg" alt="HamFlow" style={{ width: '100%', height: '100%' }} />
            </Box>
            <Text color="fg.default" fontSize="xl" fontWeight="bold">
              HamFlow
            </Text>
          </HStack>
          {onNavigate && (
            <IconButton variant="ghost" size="sm" onClick={onNavigate} aria-label="Close sidebar">
              <X />
            </IconButton>
          )}
        </HStack>
      </Box>

      {/* Space Switcher */}
      <Box w="full" p="4" pt="2">
        <Button
          onClick={toggleSpace}
          variant="solid"
          size="lg"
          colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}
          gap="3"
          justifyContent="flex-start"
          borderRadius="lg"
          w="full"
        >
          {currentSpace === 'work' ? (
            <Briefcase width="20" height="20" />
          ) : (
            <Home width="20" height="20" />
          )}
          <Text fontWeight="semibold" textTransform="capitalize">
            {currentSpace} Space
          </Text>
        </Button>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <VStack flex="1" gap="1" w="full" p="4">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = isActiveRoute(item.href, currentPath);
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : undefined;
          const showBadge = badgeCount !== undefined && badgeCount > 0;

          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} style={{ width: '100%' }}>
              <Button
                variant="ghost"
                size="lg"
                data-active={isActive ? 'true' : undefined}
                position="relative"
                justifyContent="flex-start"
                w="full"
                _active={{ bg: 'bg.emphasized' }}
                _hover={{ bg: 'bg.emphasized' }}
              >
                <IconComponent style={{ marginRight: '12px' }} width="20" height="20" />
                {item.label}
                {showBadge && (
                  <Box
                    colorPalette="red"
                    borderRadius="full"
                    ml="auto"
                    py="0.5"
                    px="2"
                    fontSize="xs"
                    fontWeight="bold"
                    bg="colorPalette.default"
                  >
                    {badgeCount}
                  </Box>
                )}
              </Button>
            </Link>
          );
        })}
      </VStack>

      <Divider />

      {/* Quick Actions */}
      <VStack gap="1" w="full" p="4">
        <Button variant="ghost" size="md" justifyContent="flex-start" w="full" color="fg.muted">
          <Command style={{ marginRight: '12px' }} width="20" height="20" />
          Command
          <Box ml="auto" color="fg.subtle" fontSize="xs">
            ⌘K
          </Box>
        </Button>

        <Button variant="ghost" size="md" justifyContent="flex-start" w="full" color="fg.muted">
          <Timer style={{ marginRight: '12px' }} width="20" height="20" />
          Timer
        </Button>

        <Link href="/settings" onClick={onNavigate} style={{ width: '100%' }}>
          <Button
            variant="ghost"
            size="md"
            data-active={isActiveRoute('/settings', currentPath) ? 'true' : undefined}
            justifyContent="flex-start"
            w="full"
            color="fg.muted"
            _active={{ bg: 'bg.emphasized' }}
            _hover={{ bg: 'bg.emphasized' }}
          >
            <Settings style={{ marginRight: '12px' }} width="20" height="20" />
            Settings
          </Button>
        </Link>
      </VStack>

      <Divider />

      {/* User Section */}
      <Box w="full" p="4">
        <HStack gap="3" alignItems="center">
          <Avatar name={user?.email || 'User'} size="sm" />
          <Box flex="1" minW="0">
            <Text
              fontSize="sm"
              fontWeight="medium"
              textOverflow="ellipsis"
              overflow="hidden"
              whiteSpace="nowrap"
            >
              {user?.email}
            </Text>
          </Box>
          <IconButton variant="ghost" size="sm" onClick={() => void logout()} aria-label="Logout">
            <LogOut />
          </IconButton>
        </HStack>
      </Box>
    </VStack>
  );
}
