import React, { useState } from 'react';
import { Calendar, Check, FileText } from 'lucide-react';
import type { Task } from '../../shared/types';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { isTaskCompleted } from '../../shared/utils/taskCompletion';

interface TaskCardProps {
  task: Task;
  onDragStart: (task: Task) => void;
}

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

export function TaskCard({ task, onDragStart }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box
      data-priority={task.priority || 'none'}
      draggable
      onDragStart={() => onDragStart(task)}
      onClick={() => setIsExpanded(!isExpanded)}
      cursor="grab"
      borderColor="border.default"
      borderLeftWidth="4px"
      borderLeftColor="colorPalette.default"
      borderRadius="lg"
      borderWidth="1px"
      p="3"
      bg="bg.default"
      shadow="xs"
      transition="all 0.2s"
      _active={{
        cursor: 'grabbing'
      }}
      _hover={{
        borderColor: 'border.emphasized',
        shadow: 'sm'
      }}
    >
      <VStack gap="2" alignItems="flex-start">
        <Text
          color={isTaskCompleted(task) ? 'fg.subtle' : 'fg.default'}
          textDecoration={isTaskCompleted(task) ? 'line-through' : 'none'}
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

          {isTaskCompleted(task) && (
            <Badge variant="outline" colorPalette="green" fontSize="xs">
              <HStack gap="1">
                <Check width="12" height="12" />
                Completed
              </HStack>
            </Badge>
          )}

          {task.noteId && (
            <Badge variant="outline" colorPalette="blue" fontSize="xs">
              <HStack gap="1">
                <FileText width="12" height="12" />
                Note
              </HStack>
            </Badge>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}
