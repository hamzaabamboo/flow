import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface PomodoroSession {
  taskId?: string;
  taskTitle?: string;
  duration: number;
  type: 'work' | 'short-break' | 'long-break';
}

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const getSessionColorPalette = () => {
    switch (session.type) {
      case 'work':
        return 'red';
      case 'short-break':
        return 'green';
      case 'long-break':
        return 'blue';
    }
  };

  const progress = ((session.duration - timeLeft) / session.duration) * 100;

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
      {/* Session Type */}
      <VStack mb="4">
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
        {session.taskTitle && (
          <Text mt="1" color="fg.muted" fontSize="xs">
            {session.taskTitle}
          </Text>
        )}
      </VStack>

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
          style={{ width: `${progress}%` }}
          height="full"
          bg={`${getSessionColorPalette()}.solid`}
          transition="width 0.5s ease"
        />
      </Box>

      {/* Controls */}
      <HStack gap="2" justifyContent="center">
        <Button
          onClick={toggleTimer}
          variant={isRunning ? 'outline' : 'solid'}
          size="sm"
          colorPalette={!isRunning ? getSessionColorPalette() : undefined}
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
