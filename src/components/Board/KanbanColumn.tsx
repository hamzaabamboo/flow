import React, { useState } from 'react';
import { Plus, MoreHorizontal, Edit2, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';
import { Countdown } from '../ui/countdown';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import * as Menu from '../ui/styled/menu';
import * as Dialog from '../ui/styled/dialog';
import { Box, VStack, HStack } from 'styled-system/jsx';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  columnId: string;
}

export interface Column {
  id: string;
  name: string;
  taskOrder?: string[];
  wipLimit?: number | null;
  position?: number;
}

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStartColumn?: (e: React.DragEvent, column: Column) => void;
  onDropColumn?: (e: React.DragEvent) => void;
  getPriorityColor: (priority?: string) => string;
  onRenameColumn?: (columnId: string, name: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onUpdateWipLimit?: (columnId: string, limit: number | null) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onDragStart,
  onDragOver,
  onDrop,
  onDragStartColumn,
  onDropColumn,
  getPriorityColor,
  onRenameColumn,
  onDeleteColumn,
  onUpdateWipLimit
}: KanbanColumnProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [wipLimit, setWipLimit] = useState(column.wipLimit?.toString() || '');

  const isOverWipLimit = column.wipLimit && tasks.length > column.wipLimit;

  const handleSaveColumn = () => {
    if (onRenameColumn && columnName !== column.name) {
      onRenameColumn(column.id, columnName);
    }
    if (onUpdateWipLimit) {
      const newLimit = wipLimit ? parseInt(wipLimit) : null;
      if (newLimit !== column.wipLimit) {
        onUpdateWipLimit(column.id, newLimit);
      }
    }
    setIsEditDialogOpen(false);
  };

  const handleDeleteColumn = () => {
    if (tasks.length > 0) {
      alert('Cannot delete column with tasks. Please move or delete all tasks first.');
      return;
    }
    if (onDeleteColumn && confirm(`Are you sure you want to delete column "${column.name}"?`)) {
      onDeleteColumn(column.id);
    }
  };

  return (
    <>
      <Box
        onDragOver={onDragOver}
        onDrop={(e) => (onDropColumn ? onDropColumn(e) : onDrop(e))}
        draggable={!!onDragStartColumn}
        onDragStart={(e) => onDragStartColumn && onDragStartColumn(e, column)}
        cursor={onDragStartColumn ? 'move' : 'default'}
        borderRadius="lg"
        minW="300px"
        p="4"
        bg="bg.muted"
      >
        <HStack justifyContent="space-between" mb="4">
          <HStack gap="2">
            <Text color="fg.default" fontSize="sm" fontWeight="semibold">
              {column.name} ({tasks.length}
              {column.wipLimit ? `/${column.wipLimit}` : ''})
            </Text>
            {isOverWipLimit && (
              <Badge size="sm" colorPalette="red">
                <AlertTriangle width="12" height="12" />
                Over WIP
              </Badge>
            )}
          </HStack>
          <HStack gap="1">
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton variant="ghost" size="sm" aria-label="Column options">
                  <Settings width="16" height="16" />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="edit" onClick={() => setIsEditDialogOpen(true)}>
                    <HStack gap="2">
                      <Edit2 width="16" height="16" />
                      <Menu.ItemText>Edit Column</Menu.ItemText>
                    </HStack>
                  </Menu.Item>
                  <Menu.Item value="delete" onClick={handleDeleteColumn}>
                    <HStack gap="2" color="red.default">
                      <Trash2 width="16" height="16" />
                      <Menu.ItemText>Delete Column</Menu.ItemText>
                    </HStack>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
            <IconButton variant="ghost" size="sm" onClick={onAddTask} aria-label="Add task">
              <Plus width="16" height="16" />
            </IconButton>
          </HStack>
        </HStack>

        <VStack gap="2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onDragStart={onDragStart}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              getPriorityColor={getPriorityColor}
            />
          ))}
        </VStack>
      </Box>

      <Dialog.Root
        open={isEditDialogOpen}
        onOpenChange={(details) => setIsEditDialogOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="400px">
            <VStack gap="4" p="6">
              <VStack gap="1">
                <Dialog.Title>Edit Column</Dialog.Title>
                <Dialog.Description>Update column name and settings</Dialog.Description>
              </VStack>

              <VStack gap="4" w="full">
                <Box w="full">
                  <Text mb="1" fontSize="sm" fontWeight="medium">
                    Column Name
                  </Text>
                  <Input
                    value={columnName}
                    onChange={(e) => setColumnName(e.target.value)}
                    placeholder="Enter column name"
                  />
                </Box>

                <Box w="full">
                  <Text mb="1" fontSize="sm" fontWeight="medium">
                    WIP Limit (optional)
                  </Text>
                  <Input
                    type="number"
                    value={wipLimit}
                    onChange={(e) => setWipLimit(e.target.value)}
                    placeholder="Leave empty for no limit"
                    min="0"
                  />
                  <Text mt="1" color="fg.muted" fontSize="xs">
                    Limit the number of tasks in this column
                  </Text>
                </Box>
              </VStack>

              <HStack gap="2" w="full" pt="2">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" w="full">
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button onClick={handleSaveColumn} w="full">
                  Save Changes
                </Button>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  getPriorityColor: (priority?: string) => string;
}

function TaskCard({ task, onDragStart, onEdit, onDelete, getPriorityColor }: TaskCardProps) {
  return (
    <Box
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      cursor="grab"
      borderColor="border.default"
      borderRadius="md"
      borderWidth="1px"
      width="full"
      p="3"
      bg="bg.default"
      transition="all 0.2s"
      _hover={{ borderColor: 'colorPalette.default' }}
    >
      <HStack justifyContent="space-between" mb="2">
        <Text flex="1" color="fg.default" fontSize="sm" fontWeight="medium">
          {task.title}
        </Text>
        <HStack gap="0">
          <IconButton variant="ghost" size="sm" aria-label="Edit task" onClick={() => onEdit(task)}>
            <Edit2 width="16" height="16" />
          </IconButton>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton variant="ghost" size="sm" aria-label="More options">
                <MoreHorizontal width="16" height="16" />
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="delete" onClick={() => onDelete(task)}>
                  <HStack gap="2" color="red.default">
                    <Trash2 width="16" height="16" />
                    <Menu.ItemText>Delete</Menu.ItemText>
                  </HStack>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </HStack>
      </HStack>

      {task.description && (
        <Text mb="2" color="fg.muted" fontSize="xs">
          {task.description}
        </Text>
      )}

      <HStack gap="2" flexWrap="wrap">
        {task.priority && (
          <Badge size="sm" colorPalette={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
        )}
        {task.dueDate && <Countdown targetDate={task.dueDate} size="sm" />}
      </HStack>
    </Box>
  );
}

export default KanbanColumn;
