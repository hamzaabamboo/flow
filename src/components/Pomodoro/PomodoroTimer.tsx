import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Minimize2, Maximize2, Timer } from 'lucide-react';
import type { PomodoroSession } from '../../shared/types';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { IconButton } from '../ui/icon-button';
import { Box, HStack } from 'styled-system/jsx';
import { css } from 'styled-system/css';

const TIMERS = {
  work: 25 * 60, // 25 minutes
  'short-break': 5 * 60, // 5 minutes
  'long-break': 15 * 60 // 15 minutes
};

export function PomodoroTimer({ taskId, taskTitle }: { taskId?: string; taskTitle?: string }) {
  const [session, setSession] = useState<PomodoroSession>({
    taskId,
    taskTitle,
    duration: TIMERS.work,
    type: 'work'
  });
  const [timeLeft, setTimeLeft] = useState(TIMERS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    // Load hidden state from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pomodoroHidden') === 'true';
    }
    return false;
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save hidden state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pomodoroHidden', isHidden.toString());
    }
  }, [isHidden]);

  // Save completed session
  const saveSession = useMutation({
    mutationFn: async (session: PomodoroSession) => {
      const response = await fetch('/api/pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: session.taskId,
          duration: Math.floor(session.duration / 60),
          userId: 'temp-user-id' // TODO: Get from auth
        })
      });
      if (!response.ok) throw new Error('Failed to save session');
      return response.json();
    }
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const playSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(
        'data:audio/wav;base64,UklGRhwMAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgMAAA='
      );
    }
    audioRef.current.play().catch(console.error);
  };

  const handleComplete = useCallback(() => {
    playSound();
    setIsRunning(false);

    if (session.type === 'work') {
      saveSession.mutate(session);
      setCompletedSessions((prev) => prev + 1);

      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pomodoro Complete!', {
          body: `Great work! Time for a ${completedSessions % 4 === 3 ? 'long' : 'short'} break.`,
          icon: '/favicon.ico'
        });
      }

      // Switch to break
      const breakType = completedSessions % 4 === 3 ? 'long-break' : 'short-break';
      const breakDuration = TIMERS[breakType];
      setSession((prev) => ({ ...prev, type: breakType, duration: breakDuration }));
      setTimeLeft(breakDuration);
    } else {
      // Switch back to work
      setSession((prev) => ({ ...prev, type: 'work', duration: TIMERS.work }));
      setTimeLeft(TIMERS.work);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Break Complete!', {
          body: 'Ready to focus again?',
          icon: '/favicon.ico'
        });
      }
    }
  }, [session, completedSessions, saveSession]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      handleComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, handleComplete]);

  const toggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(session.duration);
  };

  const skipSession = () => {
    handleComplete();
  };

  const progress = ((session.duration - timeLeft) / session.duration) * 100;

  // If completely hidden, show a small floating button to restore
  if (isHidden) {
    return (
      <Box zIndex="50" position="fixed" right="8" bottom="8">
        <IconButton
          onClick={() => setIsHidden(false)}
          variant="solid"
          size="lg"
          aria-label="Show Pomodoro Timer"
          data-session-type={session.type}
          borderRadius="full"
          shadow="lg"
        >
          <Timer />
        </IconButton>
      </Box>
    );
  }

  // Minimized view - just show timer and basic controls
  if (isMinimized) {
    return (
      <Box
        zIndex="50"
        position="fixed"
        right="8"
        bottom="8"
        borderColor="border.subtle"
        borderRadius="xl"
        borderWidth="2px"
        p="4"
        bg="bg.default"
        shadow="xl"
      >
        <HStack gap="3" alignItems="center">
          <Text color="fg.default" fontFamily="mono" fontSize="2xl" fontWeight="bold">
            {formatTime(timeLeft)}
          </Text>

          <Badge size="sm" data-session-type={session.type}>
            {session.type.replace('-', ' ')}
          </Badge>

          <Button
            onClick={toggleTimer}
            variant={isRunning ? 'ghost' : 'solid'}
            size="sm"
            data-session-type={!isRunning ? session.type : undefined}
          >
            {isRunning ? 'Pause' : 'Start'}
          </Button>

          <IconButton
            onClick={() => setIsMinimized(false)}
            variant="ghost"
            size="sm"
            aria-label="Expand Timer"
          >
            <Maximize2 width="16" height="16" />
          </IconButton>

          <IconButton
            onClick={() => setIsHidden(true)}
            variant="ghost"
            size="sm"
            aria-label="Hide Timer"
          >
            <X width="16" height="16" />
          </IconButton>
        </HStack>
      </Box>
    );
  }

  // Full view
  return (
    <Box
      zIndex="50"
      position="fixed"
      right="8"
      bottom="8"
      borderColor="border.subtle"
      borderRadius="xl"
      borderWidth="2px"
      minWidth="280px"
      p="6"
      bg="bg.default"
      shadow="xl"
    >
      {/* Header with minimize/close buttons */}
      <HStack justifyContent="space-between" alignItems="center" mb="4">
        <Badge
          variant="solid"
          colorPalette={
            session.type === 'work' ? 'red' : session.type === 'short-break' ? 'green' : 'blue'
          }
          fontSize="xs"
          letterSpacing="wide"
          textTransform="uppercase"
        >
          {session.type.replace('-', ' ')}
        </Badge>

        <HStack gap="1">
          <IconButton
            onClick={() => setIsMinimized(true)}
            variant="ghost"
            size="sm"
            aria-label="Minimize Timer"
          >
            <Minimize2 width="16" height="16" />
          </IconButton>
          <IconButton
            onClick={() => setIsHidden(true)}
            variant="ghost"
            size="sm"
            aria-label="Hide Timer"
          >
            <X width="16" height="16" />
          </IconButton>
        </HStack>
      </HStack>

      {/* Task Title */}
      {session.taskTitle && (
        <Text mb="4" color="fg.muted" fontSize="xs" textAlign="center">
          {session.taskTitle}
        </Text>
      )}

      {/* Timer Display */}
      <Text
        color="fg.default"
        fontFamily="mono"
        fontSize="5xl"
        fontWeight="bold"
        textAlign="center"
      >
        {formatTime(timeLeft)}
      </Text>

      {/* Progress Bar */}
      <Box borderRadius="xs" height="1" my="4" bg="bg.muted" overflow="hidden">
        <Box
          className={css({ width: 'var(--progress)', transition: 'width 0.5s ease' })}
          data-session-type={session.type}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
          height="full"
          bg="colorPalette.solid"
        />
      </Box>

      {/* Controls */}
      <HStack gap="2" justifyContent="center">
        <Button
          onClick={toggleTimer}
          variant={isRunning ? 'outline' : 'solid'}
          size="sm"
          data-session-type={!isRunning ? session.type : undefined}
        >
          {isRunning ? 'Pause' : 'Start'}
        </Button>

        <Button onClick={resetTimer} variant="outline" size="sm">
          Reset
        </Button>

        <Button onClick={skipSession} variant="outline" size="sm">
          Skip
        </Button>
      </HStack>

      {/* Session Counter */}
      <Text mt="4" color="fg.subtle" fontSize="xs" textAlign="center">
        Sessions completed today: {completedSessions}
      </Text>
    </Box>
  );
}
