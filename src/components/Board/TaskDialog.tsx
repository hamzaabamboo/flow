import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Tag, RefreshCw, Calendar, CheckSquare, Bell } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, createListCollection } from '../ui/select';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Checkbox } from '../ui/checkbox';
import * as Dialog from '../ui/styled/dialog';
import { Box, VStack, HStack, Grid } from 'styled-system/jsx';

interface Subtask {
  id?: string;
  title: string;
  completed: boolean;
}

interface Task {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  columnId?: string;
  labels?: string[];
  recurringPattern?: string;
  recurringEndDate?: string;
  subtasks?: Subtask[];
  createReminder?: boolean;
}

interface Column {
  id: string;
  name: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  mode: 'create' | 'edit';
  columns?: Column[];
  defaultColumnId?: string;
}

const priorityOptions = createListCollection({
  items: [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' }
  ]
});

const recurringOptions = createListCollection({
  items: [
    { label: 'None', value: '' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
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
  const [labels, setLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [createReminder, setCreateReminder] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      setLabels(task?.labels || []);
      setSubtasks(task?.subtasks || []);
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
    }
  }, [open, task]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Add hidden fields for enhanced features
    const form = e.currentTarget;

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
          <Dialog.Content maxW="600px">
            <VStack gap="6" p="6">
              <VStack gap="1">
                <Dialog.Title>{isEdit ? 'Edit Task' : 'Create New Task'}</Dialog.Title>
                <Dialog.Description>
                  {isEdit
                    ? 'Update the task details below'
                    : 'Fill in the details for your new task'}
                </Dialog.Description>
              </VStack>

              <form id="task-form" onSubmit={handleSubmit} style={{ width: '100%' }}>
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

                  <Grid gap="4" w="full" columns={2}>
                    {/* Column Selection */}
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
                          <Select.Positioner>
                            <Select.Content>
                              {columns.map((col) => (
                                <Select.Item key={col.id} item={{ label: col.name, value: col.id }}>
                                  <Select.ItemText>{col.name}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Select.Root>
                      </Box>
                    )}

                    {/* Priority */}
                    <Box>
                      <Text mb="1" fontSize="sm" fontWeight="medium">
                        Priority
                      </Text>
                      <input type="hidden" name="priority" value={task?.priority || 'medium'} />
                      <Select.Root
                        collection={priorityOptions}
                        defaultValue={[task?.priority || 'medium']}
                        onValueChange={(details) => {
                          const hiddenInput = document.querySelector(
                            'input[name="priority"]'
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
                        <Select.Positioner>
                          <Select.Content>
                            {priorityOptions.items.map((item) => (
                              <Select.Item key={item.value} item={item}>
                                <Select.ItemText>{item.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    </Box>

                    {/* Due Date */}
                    <Box>
                      <Text mb="1" fontSize="sm" fontWeight="medium">
                        <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        Due Date
                      </Text>
                      <Input
                        type="datetime-local"
                        name="dueDate"
                        defaultValue={
                          task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ''
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
                          <Select.Positioner>
                            <Select.Content>
                              {recurringOptions.items.map((item) => (
                                <Select.Item key={item.value} item={item}>
                                  <Select.ItemText>{item.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
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
                            onKeyPress={(e) => {
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
                                onCheckedChange={(e) => {
                                  e.stopPropagation?.();
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
                              onKeyPress={(e) => {
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
