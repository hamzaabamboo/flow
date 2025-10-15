import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface ActivePomodoroState {
  type: 'work' | 'short-break' | 'long-break';
  duration: number;
  timeLeft: number;
  isRunning: boolean;
  completedSessions: number;
  taskId?: string;
  taskTitle?: string;
}

// Singleton AudioContext to prevent memory leaks
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext not supported');
        return null;
      }
      audioContext = new AudioContextClass();
    }

    // Resume context if it was suspended (required on mobile)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(err => console.error('Failed to resume audio context:', err));
    }

    return audioContext;
  } catch (error) {
    console.error('Failed to create AudioContext:', error);
    return null;
  }
}

function playSound() {
  // Use Web Audio API for better sound
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Create a pleasant notification sound
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    // Envelope: fade in and out
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    // Play second beep
    setTimeout(() => {
      const ctx2 = getAudioContext();
      if (!ctx2) return;

      const oscillator2 = ctx2.createOscillator();
      const gainNode2 = ctx2.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx2.destination);

      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0, ctx2.currentTime);
      gainNode2.gain.linearRampToValueAtTime(0.3, ctx2.currentTime + 0.1);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.5);

      oscillator2.start(ctx2.currentTime);
      oscillator2.stop(ctx2.currentTime + 0.5);
    }, 200);
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}

export function PomodoroTimer({ taskId, taskTitle }: { taskId?: string; taskTitle?: string }) {
  const queryClient = useQueryClient();
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pomodoroHidden') === 'true';
    }
    return false;
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch active timer state from server
  const { data: serverState } = useQuery<ActivePomodoroState | null>({
    queryKey: ['pomodoro', 'active'],
    queryFn: async () => {
      const response = await fetch('/api/pomodoro/active', {
        credentials: 'include'
      });
      if (!response.ok) return null;
      return response.json();
    },
    // Disable polling - rely on local timer and WebSocket for updates
    refetchInterval: false,
    // Only refetch on mount and when explicitly invalidated
    staleTime: Infinity
  });

  // Save hidden state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pomodoroHidden', isHidden.toString());
    }
  }, [isHidden]);

  // Initialize localTimeLeft from serverState when it first loads
  useEffect(() => {
    if (serverState?.isRunning && localTimeLeft === null) {
      setLocalTimeLeft(serverState.timeLeft);
    }
  }, [serverState, localTimeLeft]);

  // Update server state
  const updateStateMutation = useMutation({
    mutationFn: async (state: ActivePomodoroState) => {
      const response = await fetch('/api/pomodoro/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error('Failed to update state');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active'] });
    }
  });

  // Save completed session
  const saveSessionMutation = useMutation({
    mutationFn: async (session: PomodoroSession) => {
      const response = await fetch('/api/pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          taskId: session.taskId,
          duration: Math.floor(session.duration / 60),
          startTime: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to save session');
      return response.json();
    }
  });

  const handleComplete = useCallback(() => {
    if (!serverState) return;

    playSound();

    const isWorkSession = serverState.type === 'work';
    if (isWorkSession) {
      saveSessionMutation.mutate({
        taskId: serverState.taskId,
        taskTitle: serverState.taskTitle,
        duration: serverState.duration,
        type: 'work'
      });

      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Pomodoro Complete!', {
          body: `Great work! Time for a ${serverState.completedSessions % 4 === 3 ? 'long' : 'short'} break.`,
          icon: '/favicon.ico'
        });
        void notification;
      }

      // Switch to break
      const breakType = serverState.completedSessions % 4 === 3 ? 'long-break' : 'short-break';
      const breakDuration = TIMERS[breakType];
      updateStateMutation.mutate({
        ...serverState,
        type: breakType,
        duration: breakDuration,
        timeLeft: breakDuration,
        isRunning: false,
        completedSessions: serverState.completedSessions + 1
      });
    } else {
      // Switch back to work
      updateStateMutation.mutate({
        ...serverState,
        type: 'work',
        duration: TIMERS.work,
        timeLeft: TIMERS.work,
        isRunning: false
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Break Complete!', {
          body: 'Ready to focus again?',
          icon: '/favicon.ico'
        });
        void notification;
      }
    }

    setLocalTimeLeft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState]);

  // Local timer tick - use ref for mutation to avoid dependency
  const updateStateMutationRef = useRef(updateStateMutation);
  updateStateMutationRef.current = updateStateMutation;

  useEffect(() => {
    if (!serverState?.isRunning) {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const currentTimeLeft = localTimeLeft ?? serverState.timeLeft;

    if (currentTimeLeft > 0) {
      intervalRef.current = setTimeout(() => {
        const newTimeLeft = currentTimeLeft - 1;
        setLocalTimeLeft(newTimeLeft);

        // Sync with server every 30 seconds to reduce load
        if (newTimeLeft % 30 === 0) {
          updateStateMutationRef.current.mutate({
            ...serverState,
            timeLeft: newTimeLeft
          });
        }
      }, 1000);
    } else if (currentTimeLeft === 0) {
      handleComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [serverState, localTimeLeft, handleComplete]);

  const toggleTimer = () => {
    if (!serverState) {
      // Initialize with defaults
      updateStateMutation.mutate({
        type: 'work',
        duration: TIMERS.work,
        timeLeft: TIMERS.work,
        isRunning: true,
        completedSessions: 0,
        taskId,
        taskTitle
      });
      setLocalTimeLeft(TIMERS.work);
    } else {
      updateStateMutation.mutate({
        ...serverState,
        timeLeft: localTimeLeft ?? serverState.timeLeft,
        isRunning: !serverState.isRunning
      });
    }
  };

  const resetTimer = () => {
    if (!serverState) return;

    setLocalTimeLeft(null);
    updateStateMutation.mutate({
      ...serverState,
      timeLeft: serverState.duration,
      isRunning: false
    });
  };

  const skipSession = () => {
    handleComplete();
  };

  // Use local time if available, otherwise server time
  const displayTimeLeft = localTimeLeft ?? serverState?.timeLeft ?? TIMERS.work;
  const displayDuration = serverState?.duration ?? TIMERS.work;
  const progress = ((displayDuration - displayTimeLeft) / displayDuration) * 100;

  // If completely hidden, show a small floating button to restore
  if (isHidden) {
    return (
      <Box zIndex="50" position="fixed" right="8" bottom="8">
        <IconButton
          onClick={() => setIsHidden(false)}
          variant="solid"
          size="lg"
          aria-label="Show Pomodoro Timer"
          data-session-type={serverState?.type || 'work'}
          borderRadius="full"
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
      >
        <HStack gap="3" alignItems="center">
          <Text color="fg.default" fontFamily="mono" fontSize="2xl" fontWeight="bold">
            {formatTime(displayTimeLeft)}
          </Text>

          <Badge size="sm" data-session-type={serverState?.type || 'work'}>
            {(serverState?.type || 'work').replace('-', ' ')}
          </Badge>

          <Button
            onClick={toggleTimer}
            variant={serverState?.isRunning ? 'ghost' : 'solid'}
            size="sm"
            data-session-type={!serverState?.isRunning ? serverState?.type || 'work' : undefined}
          >
            {serverState?.isRunning ? 'Pause' : 'Start'}
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
    >
      {/* Header with minimize/close buttons */}
      <HStack justifyContent="space-between" alignItems="center" mb="4">
        <Badge
          variant="solid"
          colorPalette={
            (serverState?.type || 'work') === 'work'
              ? 'red'
              : (serverState?.type || 'work') === 'short-break'
                ? 'green'
                : 'blue'
          }
          fontSize="xs"
          letterSpacing="wide"
          textTransform="uppercase"
        >
          {(serverState?.type || 'work').replace('-', ' ')}
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
      {serverState?.taskTitle && (
        <Text mb="4" color="fg.muted" fontSize="xs" textAlign="center">
          {serverState.taskTitle}
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
        {formatTime(displayTimeLeft)}
      </Text>

      {/* Progress Bar */}
      <Box borderRadius="xs" height="1" my="4" bg="bg.muted" overflow="hidden">
        <Box
          className={css({ width: 'var(--progress)', transition: 'width 0.5s ease' })}
          data-session-type={serverState?.type || 'work'}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
          height="full"
          bg="colorPalette.solid"
        />
      </Box>

      {/* Controls */}
      <HStack gap="2" justifyContent="center">
        <Button
          onClick={toggleTimer}
          variant={serverState?.isRunning ? 'outline' : 'solid'}
          size="sm"
          data-session-type={!serverState?.isRunning ? serverState?.type || 'work' : undefined}
        >
          {serverState?.isRunning ? 'Pause' : 'Start'}
        </Button>

        <Button onClick={resetTimer} variant="outline" size="sm" disabled={!serverState}>
          Reset
        </Button>

        <Button onClick={skipSession} variant="outline" size="sm" disabled={!serverState}>
          Skip
        </Button>
      </HStack>

      {/* Session Counter */}
      <Text mt="4" color="fg.subtle" fontSize="xs" textAlign="center">
        Sessions completed today: {serverState?.completedSessions || 0}
      </Text>
    </Box>
  );
}
