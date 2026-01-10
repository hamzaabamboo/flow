import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Edit2, Check, X, TrendingUp, Calendar, FolderKanban } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { useSpace } from '../../contexts/SpaceContext';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { Checkbox } from '../ui/checkbox';
import { createListCollection, Select } from '../ui/select';
import { SimpleDatePicker } from '../ui/simple-date-picker';
import { PriorityBadge } from '../PriorityBadge';
import type { AutoOrganizeSuggestion } from '../../shared/types/autoOrganize';
import type { BoardWithColumns } from '../../shared/types';
import { api } from '../../api/client';

interface SuggestionRowProps {
  suggestion: AutoOrganizeSuggestion;
  onToggleIncluded: (taskId: string) => void;
  onUpdateSuggestion: (taskId: string, updatedSuggestion: AutoOrganizeSuggestion) => void;
}

export function SuggestionRow({
  suggestion,
  onToggleIncluded,
  onUpdateSuggestion
}: SuggestionRowProps) {
  const { currentSpace } = useSpace();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSuggestion, setEditedSuggestion] = useState(suggestion);

  // Fetch boards for column move editing
  const { data: boards = [] } = useQuery<BoardWithColumns[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const { data, error } = await api.api.boards.get({ query: { space: currentSpace } });
      if (error) throw new Error('Failed to fetch boards');
      return data as unknown as BoardWithColumns[];
    },
    enabled: isEditing && suggestion.details.type === 'column_move'
  });

  const getSuggestionIcon = () => {
    switch (suggestion.details.type) {
      case 'column_move':
        return <FolderKanban size={16} />;
      case 'priority_change':
        return <TrendingUp size={16} />;
      case 'due_date_adjust':
        return <Calendar size={16} />;
    }
  };

  const getSuggestionTypeLabel = () => {
    switch (suggestion.details.type) {
      case 'column_move':
        return 'Move';
      case 'priority_change':
        return 'Priority';
      case 'due_date_adjust':
        return 'Due Date';
    }
  };

  const renderCurrentValue = () => {
    switch (suggestion.details.type) {
      case 'column_move':
        return `${suggestion.details.currentBoardName} → ${suggestion.details.currentColumnName}`;
      case 'priority_change':
        return <PriorityBadge priority={suggestion.details.currentPriority} />;
      case 'due_date_adjust':
        return suggestion.details.currentDueDate
          ? new Date(suggestion.details.currentDueDate).toLocaleDateString()
          : 'No date';
    }
  };

  const renderSuggestedValue = () => {
    if (isEditing) {
      switch (editedSuggestion.details.type) {
        case 'column_move': {
          const currentBoardId = editedSuggestion.details.suggestedBoardId;
          const currentBoard = boards.find((b) => b.id === currentBoardId);
          return (
            <HStack gap="2">
              <Select.Root
                collection={createListCollection({
                  items: boards.map((b) => ({ label: b.name, value: b.id }))
                })}
                value={[currentBoardId]}
                onValueChange={(details) => {
                  const newBoardId = details.value[0];
                  const newBoard = boards.find((b) => b.id === newBoardId);
                  if (
                    newBoard &&
                    newBoard.columns.length > 0 &&
                    editedSuggestion.details.type === 'column_move'
                  ) {
                    setEditedSuggestion({
                      ...editedSuggestion,
                      details: {
                        type: 'column_move',
                        currentBoardId: editedSuggestion.details.currentBoardId,
                        currentBoardName: editedSuggestion.details.currentBoardName,
                        currentColumnId: editedSuggestion.details.currentColumnId,
                        currentColumnName: editedSuggestion.details.currentColumnName,
                        suggestedBoardId: newBoardId,
                        suggestedBoardName: newBoard.name,
                        suggestedColumnId: newBoard.columns[0].id,
                        suggestedColumnName: newBoard.columns[0].name
                      }
                    });
                  }
                }}
                size="sm"
              >
                <Select.Trigger minW="150px">
                  <Select.ValueText placeholder="Board" />
                </Select.Trigger>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {boards.map((board) => (
                        <Select.Item key={board.id} item={{ label: board.name, value: board.id }}>
                          {board.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
              <Text>→</Text>
              <Select.Root
                collection={createListCollection({
                  items: currentBoard?.columns.map((c) => ({ label: c.name, value: c.id })) || []
                })}
                value={[editedSuggestion.details.suggestedColumnId]}
                onValueChange={(details) => {
                  const newColumnId = details.value[0];
                  const newColumn = currentBoard?.columns.find((c) => c.id === newColumnId);
                  if (newColumn && editedSuggestion.details.type === 'column_move') {
                    setEditedSuggestion({
                      ...editedSuggestion,
                      details: {
                        type: 'column_move',
                        currentBoardId: editedSuggestion.details.currentBoardId,
                        currentBoardName: editedSuggestion.details.currentBoardName,
                        currentColumnId: editedSuggestion.details.currentColumnId,
                        currentColumnName: editedSuggestion.details.currentColumnName,
                        suggestedBoardId: editedSuggestion.details.suggestedBoardId,
                        suggestedBoardName: editedSuggestion.details.suggestedBoardName,
                        suggestedColumnId: newColumnId,
                        suggestedColumnName: newColumn.name
                      }
                    });
                  }
                }}
                size="sm"
              >
                <Select.Trigger minW="150px">
                  <Select.ValueText placeholder="Column" />
                </Select.Trigger>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {currentBoard?.columns.map((column) => (
                        <Select.Item
                          key={column.id}
                          item={{ label: column.name, value: column.id }}
                        >
                          {column.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </HStack>
          );
        }
        case 'priority_change':
          return (
            <Select.Root
              collection={createListCollection({
                items: [
                  { label: 'Low', value: 'low' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'High', value: 'high' },
                  { label: 'Urgent', value: 'urgent' }
                ]
              })}
              value={[editedSuggestion.details.suggestedPriority]}
              onValueChange={(details) => {
                if (editedSuggestion.details.type === 'priority_change') {
                  setEditedSuggestion({
                    ...editedSuggestion,
                    details: {
                      type: 'priority_change',
                      currentPriority: editedSuggestion.details.currentPriority,
                      suggestedPriority: details.value[0] as 'low' | 'medium' | 'high' | 'urgent'
                    }
                  });
                }
              }}
              size="sm"
            >
              <Select.Trigger minW="120px">
                <Select.ValueText placeholder="Priority" />
              </Select.Trigger>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    <Select.Item item={{ label: 'Low', value: 'low' }}>Low</Select.Item>
                    <Select.Item item={{ label: 'Medium', value: 'medium' }}>Medium</Select.Item>
                    <Select.Item item={{ label: 'High', value: 'high' }}>High</Select.Item>
                    <Select.Item item={{ label: 'Urgent', value: 'urgent' }}>Urgent</Select.Item>
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          );
        case 'due_date_adjust':
          return (
            <SimpleDatePicker
              value={editedSuggestion.details.suggestedDueDate.split('T')[0]}
              onChange={(dateString) => {
                if (dateString && editedSuggestion.details.type === 'due_date_adjust') {
                  setEditedSuggestion({
                    ...editedSuggestion,
                    details: {
                      type: 'due_date_adjust',
                      currentDueDate: editedSuggestion.details.currentDueDate,
                      suggestedDueDate: new Date(dateString).toISOString()
                    }
                  });
                }
              }}
            />
          );
      }
    } else {
      switch (suggestion.details.type) {
        case 'column_move':
          return `${suggestion.details.suggestedBoardName} → ${suggestion.details.suggestedColumnName}`;
        case 'priority_change':
          return <PriorityBadge priority={suggestion.details.suggestedPriority} />;
        case 'due_date_adjust':
          return new Date(suggestion.details.suggestedDueDate).toLocaleDateString();
      }
    }
  };

  const handleSaveEdit = () => {
    onUpdateSuggestion(suggestion.taskId, editedSuggestion);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedSuggestion(suggestion);
    setIsEditing(false);
  };

  // Calculate confidence level for data attribute
  const confidenceLevel =
    suggestion.confidence >= 80 ? 'high' : suggestion.confidence >= 60 ? 'medium' : 'low';

  return (
    <Box
      p="4"
      borderWidth="1px"
      borderRadius="md"
      data-included={suggestion.included}
      className={css({
        bg: 'bg.subtle',
        opacity: 0.6,
        transition: 'all 0.2s',
        '&[data-included=true]': {
          bg: 'bg.default',
          opacity: 1
        }
      })}
    >
      <HStack gap="4" alignItems="flex-start">
        {/* Checkbox */}
        <Checkbox
          checked={suggestion.included}
          onCheckedChange={() => onToggleIncluded(suggestion.taskId)}
          mt="1"
        />

        {/* Content */}
        <VStack gap="2" alignItems="stretch" flex="1">
          {/* Header: Task Title + Type Badge */}
          <HStack gap="3" alignItems="center" justifyContent="space-between">
            <HStack gap="2" alignItems="center">
              {getSuggestionIcon()}
              <Text fontWeight="semibold" fontSize="sm">
                {suggestion.taskTitle}
              </Text>
              <Box px="2" py="0.5" borderRadius="sm" bg="bg.muted" fontSize="xs" color="fg.muted">
                {getSuggestionTypeLabel()}
              </Box>
            </HStack>

            {/* Edit Button */}
            {!isEditing && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsEditing(true)}
                disabled={!suggestion.included}
              >
                <Edit2 size={14} />
              </Button>
            )}
          </HStack>

          {/* Change Preview */}
          <HStack gap="2" alignItems="center" flexWrap="wrap">
            <Box fontSize="sm">{renderCurrentValue()}</Box>
            <ArrowRight size={14} />
            <Box fontSize="sm" fontWeight="medium">
              {renderSuggestedValue()}
            </Box>
          </HStack>

          {/* Reason */}
          <Text fontSize="sm" color="fg.muted">
            {suggestion.reason}
          </Text>

          {/* Confidence Score */}
          <HStack gap="2" alignItems="center">
            <Text fontSize="xs" color="fg.subtle">
              Confidence:
            </Text>
            <Box
              px="2"
              py="0.5"
              borderRadius="sm"
              fontSize="xs"
              fontWeight="medium"
              data-confidence={confidenceLevel}
              className={css({
                bg: 'gray.subtle',
                color: 'gray.fg',
                '&[data-confidence=high]': {
                  bg: 'green.subtle',
                  color: 'green.fg'
                },
                '&[data-confidence=medium]': {
                  bg: 'yellow.subtle',
                  color: 'yellow.fg'
                }
              })}
            >
              {suggestion.confidence}%
            </Box>
          </HStack>

          {/* Edit Actions */}
          {isEditing && (
            <HStack gap="2" justifyContent="flex-end" mt="2">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X size={14} />
                Cancel
              </Button>
              <Button variant="solid" size="sm" onClick={handleSaveEdit}>
                <Check size={14} />
                Save
              </Button>
            </HStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}
