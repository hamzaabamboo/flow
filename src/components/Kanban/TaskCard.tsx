import React, { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import type { Task } from '../../shared/types';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface TaskCardProps {
  task: Task;
  onDragStart: (task: Task) => void;
}

export function TaskCard({ task, onDragStart }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'red.solid';
      case 'high':
        return 'orange.solid';
      case 'medium':
        return 'blue.solid';
      case 'low':
        return 'green.solid';
      default:
        return 'gray.solid';
    }
  };

  const formatDueDate = (date?: string) => {
    if (!date) return null;
    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Box
      draggable
      onDragStart={() => onDragStart(task)}
      onClick={() => setIsExpanded(!isExpanded)}
      cursor="grab"
      borderColor="border.default"
      borderRadius="md"
      borderWidth="1px"
      p="3"
      bg="bg.default"
      shadow="sm"
      transition="all 0.2s"
      _active={{
        cursor: 'grabbing'
      }}
      _hover={{
        borderColor: 'border.emphasized',
        shadow: 'md'
      }}
    >
      <HStack gap="2" alignItems="flex-start">
        {task.priority && (
          <Box
            borderRadius="xs"
            width="1"
            height="full"
            minHeight="20px"
            bg={getPriorityColor(task.priority)}
          />
        )}

        <VStack flex="1" gap="2" alignItems="flex-start">
          <Text
            color={task.completed ? 'fg.subtle' : 'fg.default'}
            textDecoration={task.completed ? 'line-through' : 'none'}
            fontSize="sm"
            fontWeight="medium"
          >
            {task.title}
          </Text>

          {isExpanded && task.description && (
            <Text color="fg.muted" fontSize="xs">
              {task.description}
            </Text>
          )}

          <HStack gap="2" flexWrap="wrap">
            {task.dueDate && (
              <Badge variant="outline" colorPalette="yellow" fontSize="xs">
                <HStack gap="1">
                  <Calendar width="12" height="12" />
                  {formatDueDate(task.dueDate)}
                </HStack>
              </Badge>
            )}

            {task.completed && (
              <Badge variant="outline" colorPalette="green" fontSize="xs">
                <HStack gap="1">
                  <Check width="12" height="12" />
                  Completed
                </HStack>
              </Badge>
            )}
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}
