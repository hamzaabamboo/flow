import type { KeyboardEvent, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Dialog } from '../ui/dialog';
import { TaskDialog } from '../Board/TaskDialog';
import { HStack, VStack, Box } from 'styled-system/jsx';

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTask {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  labels?: string[];
  boardId?: string;
  columnId?: string;
}

export function QuickAddDialog({ open, onOpenChange }: QuickAddDialogProps) {
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToaster();

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset state when quick add dialog closes
  useEffect(() => {
    if (!open) {
      setInput('');
      setParsedTask(null);
      setIsParsing(false);
      setShowTaskDialog(false);
    }
  }, [open]);

  const parseInput = async () => {
    if (!input.trim()) return;

    setIsParsing(true);

    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `Add task: ${input}`,
          space: currentSpace
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Extract parsed data from command response
        if (result.action === 'create_task' || result.action === 'create_inbox_item') {
          // Calculate smart defaults
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowISO = tomorrow.toISOString().split('T')[0];

          const parsed = {
            title: result.data.title || input,
            description: result.data.description,
            dueDate: result.data.deadline || tomorrowISO, // Default to tomorrow
            priority: result.data.priority || 'medium', // Default to medium priority
            labels: result.data.labels || [],
            boardId: result.data.boardId,
            columnId: result.data.columnId
          };
          setParsedTask(parsed);

          // Close quick add dialog and open task dialog
          onOpenChange(false);
          // Delay opening task dialog to ensure state is set
          setTimeout(() => {
            setShowTaskDialog(true);
          }, 100);
        } else {
          // Fallback: use input as title with smart defaults
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowISO = tomorrow.toISOString().split('T')[0];

          setParsedTask({
            title: input,
            dueDate: tomorrowISO, // Default to tomorrow
            priority: 'medium', // Default priority
            labels: []
          });
          onOpenChange(false);
          setTimeout(() => setShowTaskDialog(true), 100);
        }
      } else {
        toast?.('Failed to parse input. Opening task dialog with raw input.', {
          type: 'warning'
        });
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = tomorrow.toISOString().split('T')[0];

        setParsedTask({
          title: input,
          dueDate: tomorrowISO, // Default to tomorrow
          priority: 'medium', // Default priority
          labels: []
        });
        onOpenChange(false);
        setTimeout(() => setShowTaskDialog(true), 100);
      }
    } catch (error) {
      console.error('Failed to parse input:', error);
      toast?.('Failed to parse input. Opening task dialog with raw input.', { type: 'warning' });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];

      setParsedTask({
        title: input,
        dueDate: tomorrowISO, // Default to tomorrow
        priority: 'medium', // Default priority
        labels: []
      });
      onOpenChange(false);
      setTimeout(() => setShowTaskDialog(true), 100);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const labelsString = formData.get('labels') as string;
    const taskData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      dueDate: formData.get('deadline') as string,
      priority: formData.get('priority') as string,
      labels: labelsString ? labelsString.split(',').map((l) => l.trim()) : [],
      columnId: formData.get('columnId') as string,
      reminderMinutesBefore: formData.get('createReminder') === 'on' ? 60 : undefined,
      recurringPattern: (formData.get('recurringPattern') as string) || undefined,
      recurringEndDate: (formData.get('recurringEndDate') as string) || undefined,
      link: (formData.get('link') as string) || undefined
    };

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        toast?.('Task created successfully!', { type: 'success' });
        queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
        queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
        setShowTaskDialog(false);
        setParsedTask(null);
      } else {
        toast?.('Failed to create task', { type: 'error' });
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      toast?.('Failed to create task', { type: 'error' });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isParsing && input.trim()) {
        void parseInput();
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <>
      {/* Quick Input Dialog */}
      {open && (
        <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="xl" p="0">
              <VStack gap="0" alignItems="stretch">
                {/* Header */}
                <HStack
                  gap="2"
                  borderColor="border.default"
                  borderBottomWidth="1px"
                  p="4"
                  bg="bg.subtle"
                >
                  <Sparkles width="20" height="20" color="colorPalette.default" />
                  <Text fontSize="lg" fontWeight="semibold">
                    Quick Add
                  </Text>
                </HStack>

                {/* Input Section */}
                <VStack gap="4" alignItems="stretch" p="6">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type something quick... (e.g., 'deploy staging tomorrow high priority')"
                    disabled={isParsing}
                    size="lg"
                  />

                  <Text color="fg.muted" fontSize="sm">
                    ✨ AI will parse your input and open the task dialog with pre-filled fields
                  </Text>

                  <HStack gap="2" justify="flex-end">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isParsing}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      onClick={() => void parseInput()}
                      disabled={!input.trim() || isParsing}
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="animate-spin" width="16" height="16" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <ArrowRight width="16" height="16" />
                          Open Task Dialog
                        </>
                      )}
                    </Button>
                  </HStack>
                </VStack>

                {/* Parsing State */}
                {isParsing && (
                  <VStack gap="3" pb="4" textAlign="center">
                    <Box position="relative">
                      <Spinner size="lg" />
                    </Box>
                    <Text color="fg.muted" fontSize="sm">
                      AI is analyzing your input...
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}

      {/* Task Dialog with Pre-filled Data */}
      {parsedTask && showTaskDialog && (
        <TaskDialog
          open={showTaskDialog}
          onOpenChange={(isOpen) => {
            setShowTaskDialog(isOpen);
            // Clean up when dialog closes
            if (!isOpen) {
              setTimeout(() => {
                setInput('');
                setParsedTask(null);
                setIsParsing(false);
              }, 100);
            }
          }}
          task={{
            id: '',
            title: parsedTask.title,
            description: parsedTask.description,
            dueDate: parsedTask.dueDate,
            priority: parsedTask.priority,
            labels: parsedTask.labels,
            columnId: parsedTask.columnId || '',
            space: currentSpace,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createReminder: false,
            recurringPattern: undefined,
            recurringEndDate: undefined,
            parentTaskId: undefined,
            subtasks: []
          }}
          onSubmit={(e) => void handleTaskSubmit(e)}
          mode="create"
          defaultColumnId={parsedTask.columnId}
        />
      )}
    </>
  );
}
