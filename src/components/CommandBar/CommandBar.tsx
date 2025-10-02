import type { KeyboardEvent } from 'react';
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Circle, Check, X, Inbox, CalendarClock } from 'lucide-react';
import { navigate } from 'vike/client/router';
import { useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Dialog } from '../ui/dialog';
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

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState<CommandSuggestion | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToaster();

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
      // Stop voice recognition if active
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }, [open, isListening]);

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
    setSuggestion(null);

    // Add to history (avoid duplicates)
    const newHistory = [cmd, ...commandHistory.filter((c) => c !== cmd)].slice(0, 20); // Keep last 20
    setCommandHistory(newHistory);
    localStorage.setItem('commandHistory', JSON.stringify(newHistory));
    setHistoryIndex(-1);

    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          space: currentSpace
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuggestion(result);
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

  const handleAccept = async () => {
    if (!suggestion) return;

    try {
      const response = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: suggestion.action,
          data: suggestion.data,
          space: currentSpace
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast?.(getSuccessMessage(suggestion.action), { type: 'success' });

        // Invalidate relevant queries based on action
        switch (suggestion.action) {
          case 'create_task':
          case 'create_inbox_item':
            queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
            break;
          case 'create_reminder':
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
            break;
          case 'complete_task':
          case 'move_task':
            queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
            queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
            break;
        }

        onOpenChange(false);

        // Check if task was added directly to board
        if (result.boardId && suggestion.action === 'create_task') {
          await navigate(`/board/${result.boardId}`);
        } else {
          // Navigate to appropriate page based on action
          const navigateTo = getNavigationPath(suggestion.action);
          if (navigateTo) {
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
    inputRef.current?.focus();
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle history navigation
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
      if (suggestion) {
        handleAccept();
      } else {
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
                placeholder="Type a command or click the mic..."
                disabled={isListening || isProcessing || !!suggestion}
                size="lg"
                flex="1"
              />

              <IconButton
                onClick={() => void handleVoiceInput()}
                disabled={isListening || isProcessing || !!suggestion}
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
                </VStack>

                <HStack gap="2" justify="flex-end">
                  <Button variant="outline" onClick={handleReject}>
                    <X width="16" height="16" />
                    Cancel
                  </Button>
                  <Button variant="solid" onClick={() => void handleAccept()}>
                    <Check width="16" height="16" />
                    Confirm
                  </Button>
                </HStack>
              </VStack>
            )}

            {/* Empty State */}
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
                  ].map((example, idx) => (
                    <Button
                      key={idx}
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
                      {commandHistory.slice(0, 3).map((cmd, idx) => (
                        <Button
                          key={idx}
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
