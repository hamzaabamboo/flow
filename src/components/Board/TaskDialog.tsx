import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Tag, RefreshCw, Calendar, CheckSquare, Bell, XCircle } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { useQuery } from '@tanstack/react-query';
import type { Task, Column, SimpleSubtask } from '../../shared/types';
import { useSpace } from '../../contexts/SpaceContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, createListCollection } from '../ui/select';
import { RadioButtonGroup } from '../ui/radio-button-group';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Checkbox } from '../ui/checkbox';
import * as Dialog from '../ui/styled/dialog';
import { Box, VStack, HStack, Grid } from 'styled-system/jsx';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  mode: 'create' | 'edit';
  columns?: Column[];
  defaultColumnId?: string;
}

const recurringOptions = createListCollection({
  items: [
    { label: 'None', value: '' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Bi-weekly', value: 'biweekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'End of Month', value: 'end_of_month' },
    { label: 'Yearly', value: 'yearly' }
  ]
});

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSubmit: originalOnSubmit,
  mode,
  columns,
  defaultColumnId
}: TaskDialogProps) {
  const isEdit = mode === 'edit';
  const { currentSpace } = useSpace();
  const [labels, setLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SimpleSubtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [createReminder, setCreateReminder] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const [dueDateKey, setDueDateKey] = useState(0);

  // Fetch boards to allow moving tasks between boards/columns
  // The API returns boards with columns in a single request - no N+1!
  const { data: boards = [] } = useQuery<Array<{ id: string; name: string; columns: Column[] }>>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      return response.json();
    },
    enabled: open // Fetch when dialog is open to allow task movement
  });

  const availableColumns =
    columns || (selectedBoardId ? boards.find((b) => b.id === selectedBoardId)?.columns || [] : []);

  // Initialize board/column selection when dialog opens
  useEffect(() => {
    if (open && boards.length > 0) {
      // If task has columnId, find its board
      if (task?.columnId) {
        let taskBoard = null;
        for (const board of boards) {
          if (board.columns.some((col) => col.id === task.columnId)) {
            taskBoard = board;
            break;
          }
        }
        if (taskBoard) {
          setSelectedBoardId(taskBoard.id);
          setSelectedColumnId(task.columnId);
        }
      } else if (!selectedBoardId) {
        // No task column, use first board
        const firstBoard = boards[0];
        setSelectedBoardId(firstBoard.id);
        if (firstBoard.columns && firstBoard.columns.length > 0) {
          setSelectedColumnId(firstBoard.columns[0].id);
        }
      }
    }
  }, [open, boards, task?.columnId, selectedBoardId]);

  // Reset state when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      setLabels(task?.labels || []);
      // Convert full Subtask to SimpleSubtask for UI
      setSubtasks(
        task?.subtasks?.map((st) => ({
          id: st.id,
          title: st.title,
          completed: st.completed
        })) || []
      );
      setCreateReminder(task?.createReminder || false);
      setRecurringPattern(task?.recurringPattern || '');
      setRecurringEndDate(task?.recurringEndDate || '');
      setNewSubtask('');
      setNewLabel('');

      // Show advanced if any advanced features are used
      setShowAdvanced(
        !!(
          task?.labels?.length ||
          task?.subtasks?.length ||
          task?.recurringPattern ||
          task?.createReminder
        )
      );
    } else {
      // Reset when dialog closes
      setLabels([]);
      setSubtasks([]);
      setCreateReminder(false);
      setRecurringPattern('');
      setRecurringEndDate('');
      setNewSubtask('');
      setNewLabel('');
      setShowAdvanced(false);
      setSelectedBoardId('');
      setSelectedColumnId('');
    }
  }, [open, task]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Add hidden fields for enhanced features
    const form = e.currentTarget;

    // Convert datetime-local to UTC ISO string
    const dueDateInput = form.querySelector('input[name="dueDate"]') as HTMLInputElement;
    if (dueDateInput && dueDateInput.value) {
      // datetime-local value is in local timezone (YYYY-MM-DDTHH:mm)
      // Convert to UTC ISO string for server
      const localDate = new Date(dueDateInput.value);
      const utcISOString = localDate.toISOString();

      // Replace the input value with UTC ISO string
      const utcInput = document.createElement('input');
      utcInput.type = 'hidden';
      utcInput.name = 'dueDate';
      utcInput.value = utcISOString;
      form.appendChild(utcInput);

      // Hide the original datetime-local input from form submission
      dueDateInput.name = 'dueDate_local';
    }

    // Add labels as JSON
    const labelsInput = document.createElement('input');
    labelsInput.type = 'hidden';
    labelsInput.name = 'labels';
    labelsInput.value = JSON.stringify(labels);
    form.appendChild(labelsInput);

    // Add subtasks as JSON
    const subtasksInput = document.createElement('input');
    subtasksInput.type = 'hidden';
    subtasksInput.name = 'subtasks';
    subtasksInput.value = JSON.stringify(subtasks);
    form.appendChild(subtasksInput);

    // Add recurring pattern
    const recurringInput = document.createElement('input');
    recurringInput.type = 'hidden';
    recurringInput.name = 'recurringPattern';
    recurringInput.value = recurringPattern;
    form.appendChild(recurringInput);

    // Add recurring end date
    const recurringEndInput = document.createElement('input');
    recurringEndInput.type = 'hidden';
    recurringEndInput.name = 'recurringEndDate';
    recurringEndInput.value = recurringEndDate;
    form.appendChild(recurringEndInput);

    // Add reminder flag
    const reminderInput = document.createElement('input');
    reminderInput.type = 'hidden';
    reminderInput.name = 'createReminder';
    reminderInput.value = createReminder.toString();
    form.appendChild(reminderInput);

    // Call the original submit handler
    originalOnSubmit(e);

    // Clean up the added inputs
    if (dueDateInput && dueDateInput.value) {
      dueDateInput.name = 'dueDate'; // Restore original name
      const utcInput = form.querySelector('input[name="dueDate"][type="hidden"]');
      if (utcInput) form.removeChild(utcInput);
    }
    form.removeChild(labelsInput);
    form.removeChild(subtasksInput);
    form.removeChild(recurringInput);
    form.removeChild(recurringEndInput);
    form.removeChild(reminderInput);
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, { title: newSubtask, completed: false }]);
      setNewSubtask('');
      setShowAdvanced(true); // Auto-show when subtask is added
    }
  };

  const toggleSubtask = (index: number) => {
    const updated = [...subtasks];
    updated[index].completed = !updated[index].completed;
    setSubtasks(updated);
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleAddLabel = (label: string) => {
    if (label && !labels.includes(label)) {
      setLabels([...labels, label]);
      setShowAdvanced(true); // Auto-show when label is added
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const handleRecurringChange = (value: string) => {
    setRecurringPattern(value);
    if (value) {
      setShowAdvanced(true); // Auto-show when recurring pattern is set
    }
  };

  const handleReminderChange = (checked: boolean) => {
    setCreateReminder(checked);
    if (checked) {
      setShowAdvanced(true); // Auto-show when reminder is enabled
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            borderColor="border.default"
            w={{ base: '95vw', md: '90vw' }}
            maxW="800px"
            maxH="90vh"
            bg="bg.default"
            overflowY="auto"
          >
            <VStack gap={{ base: '4', md: '6' }} p={{ base: '4', md: '6' }}>
              <VStack gap="1">
                <Dialog.Title>{isEdit ? 'Edit Task' : 'Create New Task'}</Dialog.Title>
                <Dialog.Description>
                  {isEdit
                    ? 'Update the task details below'
                    : 'Fill in the details for your new task'}
                </Dialog.Description>
              </VStack>

              <form
                id="task-form"
                key={open ? task?.id || 'new' : 'closed'}
                onSubmit={handleSubmit}
                style={{ width: '100%' }}
              >
                <VStack gap="4">
                  {/* Title */}
                  <Box w="full">
                    <Text mb="1" fontSize="sm" fontWeight="medium">
                      Title
                    </Text>
                    <Input
                      name="title"
                      defaultValue={task?.title}
                      placeholder="Enter task title"
                      required
                    />
                  </Box>

                  {/* Description */}
                  <Box w="full">
                    <Text mb="1" fontSize="sm" fontWeight="medium">
                      Description
                    </Text>
                    <Textarea
                      name="description"
                      defaultValue={task?.description}
                      placeholder="Enter task description"
                      rows={3}
                    />
                  </Box>

                  {/* Link */}
                  <Box w="full">
                    <Text mb="1" fontSize="sm" fontWeight="medium">
                      Link
                    </Text>
                    <Input
                      name="link"
                      type="url"
                      defaultValue={task?.link}
                      placeholder="https://example.com"
                    />
                  </Box>

                  <Grid gap="4" w="full" columns={{ base: 1, md: 2 }}>
                    {/* Board & Column Selection - always show to allow moving tasks */}
                    {boards.length > 0 && (
                      <>
                        <Box>
                          <Text mb="1" fontSize="sm" fontWeight="medium">
                            Board
                          </Text>
                          <Select.Root
                            collection={createListCollection({
                              items: boards.map((board) => ({ label: board.name, value: board.id }))
                            })}
                            value={[selectedBoardId]}
                            onValueChange={(details) => {
                              const newBoardId = details.value[0];
                              setSelectedBoardId(newBoardId);
                              const board = boards.find((b) => b.id === newBoardId);
                              if (board?.columns && board.columns.length > 0) {
                                setSelectedColumnId(board.columns[0].id);
                              }
                            }}
                          >
                            <Select.Control>
                              <Select.Trigger w="full">
                                <Select.ValueText placeholder="Select Board" />
                              </Select.Trigger>
                            </Select.Control>
                            <Portal>
                              <Select.Positioner>
                                <Select.Content>
                                  {boards.map((board) => (
                                    <Select.Item
                                      key={board.id}
                                      item={{ label: board.name, value: board.id }}
                                    >
                                      <Select.ItemText>{board.name}</Select.ItemText>
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Positioner>
                            </Portal>
                          </Select.Root>
                        </Box>
                        <Box>
                          <Text mb="1" fontSize="sm" fontWeight="medium">
                            Column
                          </Text>
                          <input type="hidden" name="columnId" value={selectedColumnId} />
                          <Select.Root
                            collection={createListCollection({
                              items: availableColumns.map((col) => ({
                                label: col.name,
                                value: col.id
                              }))
                            })}
                            value={[selectedColumnId]}
                            onValueChange={(details) => {
                              setSelectedColumnId(details.value[0]);
                              const hiddenInput = document.querySelector(
                                'input[name="columnId"]'
                              ) as HTMLInputElement;
                              if (hiddenInput) {
                                hiddenInput.value = details.value[0];
                              }
                            }}
                          >
                            <Select.Control>
                              <Select.Trigger w="full">
                                <Select.ValueText placeholder="Select Column" />
                              </Select.Trigger>
                            </Select.Control>
                            <Portal>
                              <Select.Positioner>
                                <Select.Content>
                                  {availableColumns.map((col) => (
                                    <Select.Item
                                      key={col.id}
                                      item={{ label: col.name, value: col.id }}
                                    >
                                      <Select.ItemText>{col.name}</Select.ItemText>
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Positioner>
                            </Portal>
                          </Select.Root>
                        </Box>
                      </>
                    )}
                    {/* Column Selection (when columns provided - board page scenario) */}
                    {columns && columns.length > 0 && (
                      <Box>
                        <Text mb="1" fontSize="sm" fontWeight="medium">
                          Column
                        </Text>
                        <input
                          type="hidden"
                          name="columnId"
                          value={task?.columnId || defaultColumnId}
                        />
                        <Select.Root
                          collection={createListCollection({
                            items: columns.map((col) => ({ label: col.name, value: col.id }))
                          })}
                          defaultValue={
                            task?.columnId
                              ? [task.columnId]
                              : defaultColumnId
                                ? [defaultColumnId]
                                : []
                          }
                          onValueChange={(details) => {
                            const hiddenInput = document.querySelector(
                              'input[name="columnId"]'
                            ) as HTMLInputElement;
                            if (hiddenInput) {
                              hiddenInput.value = details.value[0];
                            }
                          }}
                        >
                          <Select.Control>
                            <Select.Trigger w="full">
                              <Select.ValueText />
                            </Select.Trigger>
                          </Select.Control>
                          <Portal>
                            <Select.Positioner>
                              <Select.Content>
                                {columns.map((col) => (
                                  <Select.Item
                                    key={col.id}
                                    item={{ label: col.name, value: col.id }}
                                  >
                                    <Select.ItemText>{col.name}</Select.ItemText>
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Positioner>
                          </Portal>
                        </Select.Root>
                      </Box>
                    )}

                    {/* Priority */}
                    <Box>
                      <Text mb="2" fontSize="sm" fontWeight="medium">
                        Priority
                      </Text>
                      <RadioButtonGroup.Root
                        name="priority"
                        defaultValue={task?.priority || 'medium'}
                      >
                        <RadioButtonGroup.Item value="low" colorPalette="green">
                          <RadioButtonGroup.ItemText>Low</RadioButtonGroup.ItemText>
                          <RadioButtonGroup.ItemControl />
                          <RadioButtonGroup.ItemHiddenInput />
                        </RadioButtonGroup.Item>
                        <RadioButtonGroup.Item value="medium" colorPalette="yellow">
                          <RadioButtonGroup.ItemText>Medium</RadioButtonGroup.ItemText>
                          <RadioButtonGroup.ItemControl />
                          <RadioButtonGroup.ItemHiddenInput />
                        </RadioButtonGroup.Item>
                        <RadioButtonGroup.Item value="high" colorPalette="orange">
                          <RadioButtonGroup.ItemText>High</RadioButtonGroup.ItemText>
                          <RadioButtonGroup.ItemControl />
                          <RadioButtonGroup.ItemHiddenInput />
                        </RadioButtonGroup.Item>
                        <RadioButtonGroup.Item value="urgent" colorPalette="red">
                          <RadioButtonGroup.ItemText>Urgent</RadioButtonGroup.ItemText>
                          <RadioButtonGroup.ItemControl />
                          <RadioButtonGroup.ItemHiddenInput />
                        </RadioButtonGroup.Item>
                      </RadioButtonGroup.Root>
                    </Box>

                    {/* Due Date */}
                    <Box>
                      <HStack justifyContent="space-between" mb="1">
                        <Text fontSize="sm" fontWeight="medium">
                          <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                          Due Date
                        </Text>
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="xs"
                          aria-label="Clear due date"
                          onClick={() => {
                            setDueDateKey((prev) => prev + 1);
                          }}
                        >
                          <XCircle width="14" height="14" />
                        </IconButton>
                      </HStack>
                      <Input
                        key={dueDateKey}
                        type="datetime-local"
                        name="dueDate"
                        defaultValue={
                          task?.dueDate
                            ? (() => {
                                // Server sends UTC ISO string, convert to local for display
                                const date = new Date(task.dueDate);
                                if (isNaN(date.getTime())) return ''; // Invalid date
                                // Use local timezone methods to format for datetime-local input
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                return `${year}-${month}-${day}T${hours}:${minutes}`;
                              })()
                            : ''
                        }
                      />
                    </Box>

                    {/* Reminder */}
                    <Box>
                      <HStack gap="2">
                        <Checkbox
                          checked={createReminder}
                          onCheckedChange={(e) => handleReminderChange(e.checked as boolean)}
                        />
                        <Text fontSize="sm">
                          <Bell size={14} style={{ display: 'inline', marginRight: '4px' }} />
                          Remind 1hr before
                        </Text>
                      </HStack>
                    </Box>
                  </Grid>

                  {/* Advanced Options Toggle */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </Button>

                  {/* Advanced Options */}
                  {showAdvanced && (
                    <VStack
                      gap="4"
                      borderColor="border.default"
                      borderTopWidth="1px"
                      w="full"
                      pt="4"
                    >
                      {/* Recurring Pattern */}
                      <Box w="full">
                        <Text mb="1" fontSize="sm" fontWeight="medium">
                          <RefreshCw size={14} style={{ display: 'inline', marginRight: '4px' }} />
                          Recurring
                        </Text>
                        <Select.Root
                          collection={recurringOptions}
                          value={[recurringPattern]}
                          onValueChange={(e) => handleRecurringChange(e.value[0] || '')}
                        >
                          <Select.Control>
                            <Select.Trigger w="full">
                              <Select.ValueText placeholder="No recurrence" />
                            </Select.Trigger>
                          </Select.Control>
                          <Portal>
                            <Select.Positioner>
                              <Select.Content>
                                {recurringOptions.items.map((item) => (
                                  <Select.Item key={item.value} item={item}>
                                    <Select.ItemText>{item.label}</Select.ItemText>
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Positioner>
                          </Portal>
                        </Select.Root>
                      </Box>

                      {/* Recurring End Date */}
                      {recurringPattern && recurringPattern !== '' && (
                        <Box w="full">
                          <Text mb="1" fontSize="sm" fontWeight="medium">
                            <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            End Date (optional)
                          </Text>
                          <Input
                            type="date"
                            value={
                              recurringEndDate
                                ? new Date(recurringEndDate).toISOString().split('T')[0]
                                : ''
                            }
                            onChange={(e) => {
                              e.stopPropagation();
                              setRecurringEndDate(
                                e.target.value ? new Date(e.target.value).toISOString() : ''
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Leave empty for indefinite"
                          />
                          <Text mt="1" color="fg.muted" fontSize="xs">
                            Leave empty to repeat indefinitely
                          </Text>
                        </Box>
                      )}

                      {/* Labels */}
                      <Box w="full">
                        <Text mb="1" fontSize="sm" fontWeight="medium">
                          <Tag size={14} style={{ display: 'inline', marginRight: '4px' }} />
                          Labels
                        </Text>
                        <HStack gap="2" flexWrap="wrap">
                          {labels.map((label) => (
                            <HStack
                              key={label}
                              gap="1"
                              borderRadius="md"
                              py="1"
                              px="2"
                              fontSize="sm"
                              bg="colorPalette.subtle"
                            >
                              <Text>{label}</Text>
                              <IconButton
                                size="xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveLabel(label);
                                }}
                                type="button"
                              >
                                <X size={12} />
                              </IconButton>
                            </HStack>
                          ))}
                          <Input
                            placeholder="Add label..."
                            size="sm"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddLabel(newLabel);
                                setNewLabel('');
                              }
                            }}
                            maxW="150px"
                          />
                        </HStack>
                      </Box>

                      {/* Subtasks */}
                      <Box w="full">
                        <Text mb="1" fontSize="sm" fontWeight="medium">
                          <CheckSquare
                            size={14}
                            style={{ display: 'inline', marginRight: '4px' }}
                          />
                          Subtasks
                        </Text>
                        <VStack gap="2" alignItems="start">
                          {subtasks.map((subtask, index) => (
                            <HStack key={index} gap="2" w="full">
                              <Checkbox
                                size="sm"
                                checked={subtask.completed}
                                onCheckedChange={() => {
                                  toggleSubtask(index);
                                }}
                              />
                              <Text
                                flex="1"
                                color={subtask.completed ? 'fg.muted' : 'fg.default'}
                                textDecoration={subtask.completed ? 'line-through' : 'none'}
                                fontSize="sm"
                              >
                                {subtask.title}
                              </Text>
                              <IconButton
                                size="xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeSubtask(index);
                                }}
                              >
                                <X size={14} />
                              </IconButton>
                            </HStack>
                          ))}
                          <HStack gap="2" w="full">
                            <Input
                              size="sm"
                              placeholder="Add subtask..."
                              value={newSubtask}
                              onChange={(e) => setNewSubtask(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddSubtask();
                                }
                              }}
                            />
                            <IconButton
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddSubtask();
                              }}
                              variant="outline"
                              type="button"
                            >
                              <Plus size={14} />
                            </IconButton>
                          </HStack>
                        </VStack>
                      </Box>
                    </VStack>
                  )}
                </VStack>
              </form>

              {/* Dialog Footer */}
              <Box borderColor="border.default" borderTopWidth="1px" w="full" mt="6" pt="4">
                <HStack gap="3" justifyContent="flex-end" width="full">
                  <Dialog.CloseTrigger asChild>
                    <Button variant="ghost" type="button">
                      Cancel
                    </Button>
                  </Dialog.CloseTrigger>
                  <Button type="submit" variant="solid" form="task-form" size="md">
                    {isEdit ? (
                      <>
                        <Save size={16} />
                        Update Task
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Create Task
                      </>
                    )}
                  </Button>
                </HStack>
              </Box>
            </VStack>

            <Dialog.CloseTrigger asChild position="absolute" top="2" right="2">
              <IconButton aria-label="Close Dialog" variant="ghost" size="sm">
                <X />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export default TaskDialog;
