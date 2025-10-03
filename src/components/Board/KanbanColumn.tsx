import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Settings,
  AlertTriangle,
  GripVertical,
  Grip,
  ExternalLink,
  FileText
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';
import { PriorityBadge } from '../PriorityBadge';
import { LinkifiedText } from '../ui/linkified-text';
import { Countdown } from '../ui/countdown';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import * as Menu from '../ui/styled/menu';
import * as Dialog from '../ui/styled/dialog';
import type { Task, Column } from '../../shared/types';
import { Box, VStack, HStack } from 'styled-system/jsx';
import { css } from 'styled-system/css';

export { type Task, type Column } from '../../shared/types';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  getPriorityColor: (priority?: string) => string;
  onRenameColumn?: (columnId: string, name: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onUpdateWipLimit?: (columnId: string, limit: number | null) => void;
  boardId: string;
  onCopySummary?: (columnId: string) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  getPriorityColor,
  onRenameColumn,
  onDeleteColumn,
  onUpdateWipLimit,
  boardId: _boardId,
  onCopySummary
}: KanbanColumnProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [wipLimit, setWipLimit] = useState(column.wipLimit?.toString() || '');

  // Make the column itself sortable
  const {
    attributes: columnAttributes,
    listeners: columnListeners,
    setNodeRef: setColumnRef,
    transform: columnTransform,
    transition: columnTransition,
    isDragging: isColumnDragging
  } = useSortable({
    id: column.id,
    data: {
      type: 'column',
      column
    }
  });

  const { setNodeRef: setDroppableRef, isOver: _isOver } = useDroppable({
    id: column.id
  });

  const columnStyle = {
    transform: CSS.Transform.toString(columnTransform),
    transition: columnTransition,
    opacity: isColumnDragging ? 0.5 : 1
  };

  // Combine refs
  const setRefs = (element: HTMLDivElement | null) => {
    setColumnRef(element);
    setDroppableRef(element);
  };

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

  const columnDragStyles = css({
    borderColor: 'transparent',
    boxShadow: 'none',
    '&[data-dragging=true]': {
      borderColor: 'colorPalette.default',
      boxShadow: 'lg'
    }
  });

  return (
    <>
      <Box
        className={columnDragStyles}
        data-dragging={isColumnDragging}
        ref={setRefs}
        style={columnStyle}
        display="flex"
        flexDirection="column"
        borderRadius="lg"
        borderWidth="2px"
        minW={{ base: '280px', md: '320px' }}
        maxW={{ base: '280px', md: '320px' }}
        maxH={{ base: 'none', md: 'calc(100vh - 200px)' }}
        p={{ base: '3', md: '4' }}
        bg="bg.muted"
      >
        <HStack flexShrink={0} justifyContent="space-between" mb="4">
          <HStack gap="2">
            {/* Drag handle for column */}
            <Box
              {...columnAttributes}
              {...columnListeners}
              cursor="grab"
              color="fg.muted"
              transition="color 0.2s"
              _hover={{ color: 'fg.default' }}
            >
              <Grip width="16" height="16" />
            </Box>
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
                  <Menu.ItemGroup>
                    {onCopySummary && (
                      <>
                        <Menu.Item value="copy-summary" asChild>
                          <HStack onClick={() => onCopySummary(column.id)} gap="2">
                            <FileText width="16" height="16" />
                            <Menu.ItemText>Copy Summary</Menu.ItemText>
                          </HStack>
                        </Menu.Item>
                        <Menu.Separator />
                      </>
                    )}
                    <Menu.Item value="edit" asChild>
                      <HStack onClick={() => setIsEditDialogOpen(true)} gap="2">
                        <Edit2 width="16" height="16" />
                        <Menu.ItemText>Edit Column</Menu.ItemText>
                      </HStack>
                    </Menu.Item>
                    <Menu.Item value="delete" asChild>
                      <HStack onClick={handleDeleteColumn} gap="2" color="red.default">
                        <Trash2 width="16" height="16" />
                        <Menu.ItemText>Delete Column</Menu.ItemText>
                      </HStack>
                    </Menu.Item>
                  </Menu.ItemGroup>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
            <IconButton variant="ghost" size="sm" onClick={onAddTask} aria-label="Add task">
              <Plus width="16" height="16" />
            </IconButton>
          </HStack>
        </HStack>

        <Box flex="1" overflowX="hidden" overflowY="auto">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <VStack gap="2" minH="200px" pb="2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  column={column}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  getPriorityColor={getPriorityColor}
                />
              ))}
            </VStack>
          </SortableContext>
        </Box>
      </Box>

      <Dialog.Root
        open={isEditDialogOpen}
        onOpenChange={(details) => setIsEditDialogOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderColor="border.default" maxW="400px" bg="bg.default">
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
  column: Column;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  getPriorityColor?: (priority?: string) => string;
}

function TaskCard({ task, onEdit, onDelete, column }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      cursor="grab"
      position="relative"
      borderColor="border.default"
      borderRadius="md"
      borderWidth="1px"
      w="full"
      p="3"
      bg="bg.default"
      transition="all 0.2s"
      _hover={{ borderColor: 'colorPalette.default', boxShadow: 'sm' }}
    >
      <HStack gap="2" alignItems="start" mb="2">
        <Box {...listeners} cursor="grab" flexShrink={0} mt="0.5" color="fg.muted">
          <GripVertical width="16" height="16" />
        </Box>
        <VStack flex="1" gap="2" alignItems="stretch">
          <HStack gap="2" alignItems="center" flexWrap="wrap">
            <Text color="fg.default" fontSize="sm" fontWeight="medium" lineHeight="1.4">
              {task.title}
            </Text>
            {task.link && (
              <IconButton
                asChild
                variant="ghost"
                size="xs"
                aria-label="Open link"
                onClick={(e) => e.stopPropagation()}
                colorPalette="gray"
              >
                <a href={task.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink width="14" height="14" />
                </a>
              </IconButton>
            )}
            {task.priority && <PriorityBadge priority={task.priority} size="sm" />}
          </HStack>

          {task.description && (
            <LinkifiedText
              color="fg.muted"
              fontSize="xs"
              lineHeight="1.3"
              textOverflow="ellipsis"
              overflow="hidden"
              css={{
                //@ts-expect-error custom type
                WebkitBoxOrient: 'vertical' as const,
                display: '-webkit-box',
                WebkitLineClamp: '2'
              }}
            >
              {task.description}
            </LinkifiedText>
          )}

          <HStack gap="2" flexWrap="wrap">
            {task.dueDate && !(task.completed || column?.name.toLowerCase() === 'done') && (
              <Countdown targetDate={task.dueDate} size="sm" />
            )}
          </HStack>
        </VStack>
        <VStack gap="0" flexShrink={0}>
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Edit task"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
          >
            <Edit2 width="14" height="14" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Delete task"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
            colorPalette="red"
          >
            <Trash2 width="14" height="14" />
          </IconButton>
        </VStack>
      </HStack>
    </Box>
  );
}

export default KanbanColumn;
