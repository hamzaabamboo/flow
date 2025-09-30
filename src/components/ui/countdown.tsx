import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Text } from './text';
import { Badge } from './badge';
import { HStack } from 'styled-system/jsx';

interface CountdownProps {
  targetDate: string | Date;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function Countdown({ targetDate, size = 'sm', showIcon = true }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
    totalMinutes: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false, totalMinutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(targetDate);
      const now = new Date();
      const difference = target.getTime() - now.getTime();

      if (difference <= 0) {
        // Overdue
        const overdueDiff = Math.abs(difference);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((overdueDiff % (1000 * 60)) / 1000);

        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          isOverdue: true,
          totalMinutes: Math.floor(overdueDiff / (1000 * 60))
        });
      } else {
        // Time remaining
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          isOverdue: false,
          totalMinutes: Math.floor(difference / (1000 * 60))
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const getColorPalette = () => {
    if (timeLeft.isOverdue) return 'red';
    if (timeLeft.totalMinutes < 60) return 'orange'; // Less than 1 hour
    if (timeLeft.totalMinutes < 1440) return 'yellow'; // Less than 1 day
    return 'green';
  };

  const formatTimeString = () => {
    const { days, hours, minutes, seconds } = timeLeft;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (size === 'md') {
    return (
      <HStack gap="2" alignItems="center">
        {showIcon &&
          (timeLeft.isOverdue ? (
            <AlertTriangle width="16" height="16" />
          ) : (
            <Clock width="16" height="16" />
          ))}
        <Badge size="sm" colorPalette={getColorPalette()}>
          {timeLeft.isOverdue ? 'Overdue ' : ''}
          {formatTimeString()}
        </Badge>
      </HStack>
    );
  }

  return (
    <HStack gap="1" alignItems="center">
      {showIcon &&
        (timeLeft.isOverdue ? (
          <AlertTriangle width="12" height="12" />
        ) : (
          <Clock width="12" height="12" />
        ))}
      <Text
        color={
          timeLeft.isOverdue
            ? 'red.default'
            : timeLeft.totalMinutes < 60
              ? 'orange.default'
              : 'fg.muted'
        }
        fontSize="xs"
        fontWeight={timeLeft.isOverdue || timeLeft.totalMinutes < 60 ? 'semibold' : 'normal'}
      >
        {timeLeft.isOverdue ? 'Overdue ' : ''}
        {formatTimeString()}
      </Text>
    </HStack>
  );
}

export default Countdown;
