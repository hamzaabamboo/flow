import type { KeyboardEvent } from 'react';
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Circle, Check, X, Inbox, CalendarClock } from 'lucide-react';
import { navigate } from 'vike/client/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Dialog } from '../ui/dialog';
import { Select, createListCollection } from '../ui/select';
import type { Column } from '../../shared/types';
import { HStack, VStack, Box } from 'styled-system/jsx';

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandSuggestion {
  action: string;
  data: Record<string, unknown>;
  description?: string;
}

interface ConversationTurn {
  command: string;
  response: CommandSuggestion;
}

const getActionLabel = (action: string): string => {
  switch (action) {
    case 'create_task':
      return 'Create Task';
    case 'create_reminder':
      return 'Create Reminder';
    case 'create_inbox_item':
      return 'Add to Inbox';
    default:
      return 'Execute';
  }
};

const getNavigationPath = (action: string): string | null => {
  switch (action) {
    case 'create_task':
      return '/tasks';
    case 'create_inbox_item':
      return '/inbox';
    case 'create_reminder':
      return '/'; // Agenda page
    default:
      return null;
  }
};

const getSuccessMessage = (action: string): string => {
  switch (action) {
    case 'create_task':
      return 'Task added to inbox';
    case 'create_reminder':
      return 'Reminder created';
    case 'create_inbox_item':
      return 'Added to inbox for processing';
    default:
      return 'Action completed';
  }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'create_task':
    case 'create_inbox_item':
      return <Inbox width="20" height="20" />;
    case 'create_reminder':
      return <CalendarClock width="20" height="20" />;
    default:
      return <Check width="20" height="20" />;
  }
};

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState<CommandSuggestion | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [currentSessionCommands, setCurrentSessionCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToaster();

  // Fetch boards for destination picker
  const { data: boards = [] } = useQuery<Array<{ id: string; name: string; columns: Column[] }>>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open
  });

  // Load command history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('commandHistory');
    if (saved) {
      try {
        setCommandHistory(JSON.parse(saved));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when closing
      setCommand('');
      setSuggestion(null);
      setIsProcessing(false);
      setHistoryIndex(-1);
      setSelectedBoardId('');
      setSelectedColumnId('');
      setConversationHistory([]); // Clear conversation context
      setCurrentSessionCommands([]);
      // Stop voice recognition if active
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }, [open, isListening]);

  // Initialize board/column selection when suggestion arrives
  useEffect(() => {
    if (suggestion && suggestion.action === 'create_task') {
      const boardId = (suggestion.data.boardId as string) || '';
      const columnId = (suggestion.data.columnId as string) || '';
      setSelectedBoardId(boardId);
      setSelectedColumnId(columnId);
    }
  }, [suggestion]);

  const handleVoiceInput = () => {
    // If already listening, stop it (cancel)
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast?.('Your browser does not support voice input', { type: 'error' });
      return;
    }

    interface ISpeechRecognitionConstructor {
      new (): SpeechRecognition;
    }

    interface IWindow extends Window {
      webkitSpeechRecognition?: ISpeechRecognitionConstructor;
      SpeechRecognition?: ISpeechRecognitionConstructor;
    }

    const SpeechRecognitionConstructor =
      (window as IWindow).webkitSpeechRecognition || (window as IWindow).SpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: Event) => {
      const speechEvent = event as SpeechRecognitionEvent;
      const transcript = speechEvent.results[0][0].transcript;
      setCommand(transcript);
      setIsListening(false);
      recognitionRef.current = null;
    };

    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      toast?.('Voice input failed. Please try again', { type: 'error' });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const processCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsProcessing(true);

    // Add command to current session
    const newSessionCommands = [...currentSessionCommands, cmd];
    setCurrentSessionCommands(newSessionCommands);

    // If we have an existing suggestion, this is a follow-up command
    const isFollowUp = suggestion !== null;

    // Build context for AI - include current suggestion if it's a follow-up
    let contextMessage = cmd;
    if (isFollowUp && suggestion) {
      contextMessage = `Previous command result: ${JSON.stringify(suggestion)}\n\nFollow-up command: ${cmd}\n\nModify the previous result based on this follow-up command. Keep all existing fields unless the follow-up explicitly changes them.`;
    }

    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: contextMessage,
          space: currentSpace,
          conversationHistory: conversationHistory.slice(-5) // Send last 5 turns for context
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuggestion(result);
        setCommand(''); // Clear input for next follow-up
      } else {
        toast?.('Command processing failed. Please try again', { type: 'error' });
      }
    } catch (error) {
      console.error('Command processing failed:', error);
      toast?.('Command processing failed. Please try again', { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToInbox = async () => {
    if (!suggestion) return;

    try {
      // Force create as inbox item
      const response = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_inbox_item',
          data: suggestion.data,
          space: currentSpace
        })
      });

      if (response.ok) {
        toast?.('Sent to inbox', { type: 'success' });
        queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
        onOpenChange(false);
        await navigate('/inbox');
      } else {
        toast?.('Failed to send to inbox. Please try again', { type: 'error' });
      }
    } catch (error) {
      console.error('Failed to send to inbox:', error);
      toast?.('Failed to send to inbox. Please try again', { type: 'error' });
    }
  };

  const handleAccept = async () => {
    if (!suggestion) return;

    try {
      // Override board/column with user selection if changed
      let finalData = { ...suggestion.data };
      if (suggestion.action === 'create_task' && selectedBoardId && selectedColumnId) {
        finalData = {
          ...finalData,
          boardId: selectedBoardId,
          columnId: selectedColumnId,
          directToBoard: true
        };
      }

      const response = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: suggestion.action,
          data: finalData,
          space: currentSpace
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast?.(getSuccessMessage(suggestion.action), { type: 'success' });

        // Save current session to command history
        if (currentSessionCommands.length > 0) {
          const sessionCommand = currentSessionCommands.join(' → ');
          const newHistory = [
            sessionCommand,
            ...commandHistory.filter((c) => c !== sessionCommand)
          ].slice(0, 20);
          setCommandHistory(newHistory);
          localStorage.setItem('commandHistory', JSON.stringify(newHistory));
        }

        // Add to conversation history for follow-up context
        setConversationHistory([
          ...conversationHistory,
          {
            command: currentSessionCommands[currentSessionCommands.length - 1] || '',
            response: suggestion
          }
        ]);

        // Invalidate relevant queries based on action
        switch (suggestion.action) {
          case 'create_task':
          case 'create_inbox_item':
            queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            break;
          case 'create_reminder':
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
            break;
          case 'complete_task':
          case 'move_task':
            queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            break;
        }

        // Reset for next command (but keep conversation history)
        setCommand('');
        setSuggestion(null);
        setSelectedBoardId('');
        setSelectedColumnId('');
        setCurrentSessionCommands([]);
        inputRef.current?.focus();

        // Wait a bit for invalidation to trigger before closing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if task was added directly to board
        if (result.boardId && suggestion.action === 'create_task') {
          onOpenChange(false);
          await navigate(`/board/${result.boardId}`);
        } else {
          // Navigate to appropriate page based on action
          const navigateTo = getNavigationPath(suggestion.action);
          if (navigateTo) {
            onOpenChange(false);
            await navigate(navigateTo);
          }
        }
      } else {
        toast?.('Failed to execute command. Please try again', { type: 'error' });
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      toast?.('Failed to execute command. Please try again', { type: 'error' });
    }
  };

  const handleReject = () => {
    setSuggestion(null);
    setCommand('');
    setCurrentSessionCommands([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle history navigation (only when no suggestion)
    if (e.key === 'ArrowUp' && !suggestion && commandHistory.length > 0) {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex] || '');
      return;
    }
    if (e.key === 'ArrowDown' && !suggestion) {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setCommand(newIndex === -1 ? '' : commandHistory[newIndex] || '');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If suggestion is shown and input is empty, accept the suggestion
      if (suggestion && !command.trim()) {
        handleAccept();
      } else {
        // Process command (either initial or follow-up)
        processCommand(command);
      }
    } else if (e.key === 'Escape') {
      if (suggestion) {
        handleReject();
      } else {
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="2xl" p="0">
          <VStack gap="0" alignItems="stretch">
            {/* Input Section */}
            <HStack gap="2" borderColor="border.default" borderBottomWidth="1px" p="4">
              <Input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  suggestion
                    ? 'Type follow-up command (e.g., "today", "high priority")...'
                    : 'Type a command or click the mic...'
                }
                disabled={isListening || isProcessing}
                size="lg"
                flex="1"
              />

              <IconButton
                onClick={() => void handleVoiceInput()}
                disabled={isListening || isProcessing}
                variant={isListening ? 'solid' : 'outline'}
                aria-label="Voice input"
                size="lg"
                colorPalette={isListening ? 'red' : undefined}
              >
                {isListening ? (
                  <Circle width="20" height="20" fill="currentColor" />
                ) : (
                  <Mic width="20" height="20" />
                )}
              </IconButton>
            </HStack>

            {/* Processing State */}
            {isProcessing && (
              <VStack gap="3" p="8" textAlign="center">
                <Box position="relative">
                  <Spinner size="xl" />
                </Box>
                <VStack gap="1">
                  <Text fontWeight="medium">Thinking...</Text>
                  <Text color="fg.muted" fontSize="sm">
                    AI is processing your command
                  </Text>
                </VStack>
              </VStack>
            )}

            {/* Suggestion Section */}
            {suggestion && !isProcessing && (
              <VStack gap="4" alignItems="stretch" p="6">
                {/* Command Chain Display */}
                {currentSessionCommands.length > 0 && (
                  <Box
                    bg="bg.muted"
                    borderRadius="sm"
                    p="2"
                    borderLeftWidth="3px"
                    borderLeftColor="colorPalette.default"
                  >
                    <HStack gap="2" flexWrap="wrap">
                      {currentSessionCommands.map((cmd, index) => (
                        <React.Fragment key={`${cmd}-${index}`}>
                          <Text fontSize="xs" color="fg.muted">
                            {cmd}
                          </Text>
                          {index < currentSessionCommands.length - 1 && (
                            <Text fontSize="xs" color="fg.subtle">
                              →
                            </Text>
                          )}
                        </React.Fragment>
                      ))}
                    </HStack>
                  </Box>
                )}

                <VStack gap="2" alignItems="stretch">
                  <HStack gap="2">
                    {getActionIcon(suggestion.action)}
                    <Text fontSize="lg" fontWeight="semibold">
                      {getActionLabel(suggestion.action)}
                    </Text>
                  </HStack>

                  {'title' in suggestion.data && typeof suggestion.data.title === 'string' && (
                    <Text fontSize="md">{suggestion.data.title}</Text>
                  )}
                  {'message' in suggestion.data && typeof suggestion.data.message === 'string' && (
                    <Text fontSize="md">{suggestion.data.message}</Text>
                  )}

                  {suggestion.description && (
                    <Text color="fg.muted" fontSize="sm">
                      {suggestion.description}
                    </Text>
                  )}

                  {/* Destination Picker for create_task */}
                  {suggestion.action === 'create_task' && boards.length > 0 && (
                    <VStack gap="2" alignItems="stretch" mt="2">
                      <Text fontSize="sm" fontWeight="medium">
                        Destination
                      </Text>
                      <HStack gap="2" flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                        <Box flex="1" minW={{ base: 'full', md: '0' }}>
                          <Select.Root
                            collection={createListCollection({
                              items: boards.map((b) => ({ label: b.name, value: b.id }))
                            })}
                            value={selectedBoardId ? [selectedBoardId] : []}
                            onValueChange={(details) => {
                              const newBoardId = details.value[0];
                              setSelectedBoardId(newBoardId);
                              // Auto-select first column of new board
                              const board = boards.find((b) => b.id === newBoardId);
                              if (board && board.columns.length > 0) {
                                setSelectedColumnId(board.columns[0].id);
                              }
                            }}
                            size="sm"
                          >
                            <Select.Trigger>
                              <Select.ValueText placeholder="Select board" />
                            </Select.Trigger>
                            <Select.Positioner>
                              <Select.Content maxW="300px">
                                {boards.map((board) => (
                                  <Select.Item
                                    key={board.id}
                                    item={{ label: board.name, value: board.id }}
                                  >
                                    {board.name}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Positioner>
                          </Select.Root>
                        </Box>

                        {selectedBoardId && (
                          <Box flex="1" minW={{ base: 'full', md: '0' }}>
                            <Select.Root
                              collection={createListCollection({
                                items:
                                  boards
                                    .find((b) => b.id === selectedBoardId)
                                    ?.columns.map((c) => ({ label: c.name, value: c.id })) || []
                              })}
                              value={selectedColumnId ? [selectedColumnId] : []}
                              onValueChange={(details) => setSelectedColumnId(details.value[0])}
                              size="sm"
                            >
                              <Select.Trigger>
                                <Select.ValueText placeholder="Select column" />
                              </Select.Trigger>

                              <Select.Positioner>
                                <Select.Content maxW="300px">
                                  {boards
                                    .find((b) => b.id === selectedBoardId)
                                    ?.columns.map((column) => (
                                      <Select.Item
                                        key={column.id}
                                        item={{ label: column.name, value: column.id }}
                                      >
                                        {column.name}
                                      </Select.Item>
                                    ))}
                                </Select.Content>
                              </Select.Positioner>
                            </Select.Root>
                          </Box>
                        )}
                      </HStack>
                    </VStack>
                  )}
                </VStack>

                <VStack gap="2" alignItems="stretch">
                  <HStack gap="2" justify="space-between">
                    <Button variant="outline" onClick={handleReject}>
                      <X width="16" height="16" />
                      Cancel
                    </Button>
                    <HStack gap="2">
                      {suggestion.action === 'create_task' && (
                        <Button variant="outline" onClick={() => void handleSendToInbox()}>
                          <Inbox width="16" height="16" />
                          Send to Inbox
                        </Button>
                      )}
                      <Button variant="solid" onClick={() => void handleAccept()}>
                        <Check width="16" height="16" />
                        Confirm
                      </Button>
                    </HStack>
                  </HStack>
                  <Text color="fg.subtle" fontSize="xs" textAlign="center" pt="1">
                    💡 Tip: Type follow-up commands like "today", "high priority", or "add to
                    Engineering board" to refine this task
                  </Text>
                </VStack>
              </VStack>
            )}

            {/* Empty State when typing */}
            {!isProcessing && !suggestion && command.trim() && (
              <Box p="4" textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                  Press Enter to process command
                </Text>
              </Box>
            )}

            {!isProcessing && !suggestion && !command.trim() && (
              <VStack gap="3" alignItems="stretch" p="6">
                <Text color="fg.muted" fontSize="sm" fontWeight="medium">
                  💡 Quick Commands
                </Text>
                <VStack gap="2" alignItems="stretch">
                  {[
                    'Add task: Deploy staging server',
                    'Remind me to call dentist in 30 minutes',
                    'Create note about meeting ideas',
                    'Start pomodoro'
                  ].map((example) => (
                    <Button
                      key={example}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCommand(example);
                        void processCommand(example);
                      }}
                      justifyContent="flex-start"
                      fontSize="sm"
                      fontWeight="normal"
                    >
                      {example}
                    </Button>
                  ))}
                </VStack>
                {commandHistory.length > 0 && (
                  <>
                    <Text mt="2" color="fg.muted" fontSize="sm" fontWeight="medium">
                      📚 Recent Commands
                    </Text>
                    <VStack gap="2" alignItems="stretch">
                      {commandHistory.slice(0, 3).map((cmd) => (
                        <Button
                          key={cmd}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCommand(cmd);
                            void processCommand(cmd);
                          }}
                          justifyContent="flex-start"
                          color="fg.muted"
                          fontSize="sm"
                          fontWeight="normal"
                        >
                          {cmd}
                        </Button>
                      ))}
                    </VStack>
                  </>
                )}
                <Text mt="2" color="fg.subtle" fontSize="xs">
                  Tip: Press ↑↓ to navigate history • Esc to close
                </Text>
              </VStack>
            )}
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
