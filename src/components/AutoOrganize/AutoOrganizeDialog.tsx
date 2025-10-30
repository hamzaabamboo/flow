import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { Box, VStack, HStack } from 'styled-system/jsx';
import * as Dialog from '../ui/styled/dialog';
import { SuggestionRow } from './SuggestionRow';
import type { AutoOrganizeSuggestion } from '../../shared/types/autoOrganize';

interface AutoOrganizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AutoOrganizeSuggestion[];
  onApply: (suggestions: AutoOrganizeSuggestion[]) => void;
  isApplying?: boolean;
  summary?: string;
  totalTasksAnalyzed?: number;
}

export function AutoOrganizeDialog({
  open,
  onOpenChange,
  suggestions: initialSuggestions,
  onApply,
  isApplying,
  summary,
  totalTasksAnalyzed
}: AutoOrganizeDialogProps) {
  const [suggestions, setSuggestions] = useState<AutoOrganizeSuggestion[]>(initialSuggestions);

  // Update local state when props change
  useEffect(() => {
    setSuggestions(initialSuggestions);
  }, [initialSuggestions]);

  const toggleSuggestionIncluded = (taskId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.taskId === taskId ? { ...s, included: !s.included } : s))
    );
  };

  const updateSuggestion = (taskId: string, updatedSuggestion: AutoOrganizeSuggestion) => {
    setSuggestions((prev) => prev.map((s) => (s.taskId === taskId ? updatedSuggestion : s)));
  };

  const includedCount = suggestions.filter((s) => s.included).length;

  const handleApply = () => {
    const includedSuggestions = suggestions.filter((s) => s.included);
    onApply(includedSuggestions);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="900px" maxH="90vh" display="flex" flexDirection="column">
          {/* Header */}
          <HStack
            justifyContent="space-between"
            alignItems="flex-start"
            p="6"
            pb="4"
            flexShrink={0}
          >
            <VStack gap="1" alignItems="flex-start">
              <HStack gap="2" alignItems="center">
                <Sparkles size={20} />
                <Dialog.Title>Auto Organize</Dialog.Title>
              </HStack>
              <Dialog.Description>
                {summary ||
                  `Found ${suggestions.length} suggestions to improve your task organization`}
              </Dialog.Description>
              {totalTasksAnalyzed !== undefined && (
                <Text fontSize="sm" color="fg.muted">
                  Analyzed {totalTasksAnalyzed} ongoing tasks
                </Text>
              )}
            </VStack>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="sm">
                <X size={16} />
              </Button>
            </Dialog.CloseTrigger>
          </HStack>

          {/* Suggestion List - Scrollable */}
          <Box
            px="6"
            pb="4"
            overflowY="auto"
            flex="1"
            minH="0"
            css={{
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                bg: 'bg.subtle'
              },
              '&::-webkit-scrollbar-thumb': {
                bg: 'bg.muted',
                borderRadius: '4px'
              }
            }}
          >
            {suggestions.length === 0 ? (
              <Box textAlign="center" py="8">
                <Text color="fg.muted">
                  No suggestions found. Your tasks are already well organized!
                </Text>
              </Box>
            ) : (
              <VStack gap="3" alignItems="stretch">
                {suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.taskId}
                    suggestion={suggestion}
                    onToggleIncluded={toggleSuggestionIncluded}
                    onUpdateSuggestion={updateSuggestion}
                  />
                ))}
              </VStack>
            )}
          </Box>

          {/* Footer Actions */}
          <HStack
            gap="3"
            justifyContent="space-between"
            p="6"
            pt="4"
            borderTopWidth="1px"
            flexShrink={0}
          >
            <Text fontSize="sm" color="fg.muted">
              {includedCount} of {suggestions.length} changes selected
            </Text>
            <HStack gap="3">
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.CloseTrigger>
              <Button
                variant="solid"
                onClick={handleApply}
                disabled={includedCount === 0 || isApplying}
                loading={isApplying}
              >
                Apply {includedCount > 0 ? `${includedCount} Changes` : 'Changes'}
              </Button>
            </HStack>
          </HStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
