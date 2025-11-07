import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { usePageContext } from 'vike-react/usePageContext';
import { ArrowLeft, MoreVertical, FileText, Sparkles } from 'lucide-react';
import type { Task } from '../../../components/Board/KanbanColumn';
import { useSpace } from '../../../contexts/SpaceContext';
import { KanbanBoard } from '../../../components/Board/KanbanBoard';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import { Heading } from '../../../components/ui/heading';
import { Badge } from '../../../components/ui/badge';
import { Menu } from '../../../components/ui/menu';
import { Spinner } from '../../../components/ui/spinner';
import { Button } from '../../../components/ui/button';
import type { BoardWithColumns } from '../../../shared/types/board';
import { useToaster } from '../../../contexts/ToasterContext';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { AutoOrganizeDialog } from '../../../components/AutoOrganize/AutoOrganizeDialog';
import {
  useAutoOrganize,
  useApplyAutoOrganize
} from '../../../components/AutoOrganize/useAutoOrganize';
import type { AutoOrganizeSuggestion } from '../../../shared/types/autoOrganize';
import { api } from '../../../api/client';

export default function BoardPage() {
  const pageContext = usePageContext();
  const boardId = pageContext.routeParams.boardId;
  const { currentSpace } = useSpace();
  const { toast } = useToaster();

  const [isAutoOrganizeDialogOpen, setIsAutoOrganizeDialogOpen] = useState(false);
  const [autoOrganizeSuggestions, setAutoOrganizeSuggestions] = useState<AutoOrganizeSuggestion[]>(
    []
  );
  const [autoOrganizeSummary, setAutoOrganizeSummary] = useState<string>('');
  const [totalTasksAnalyzed, setTotalTasksAnalyzed] = useState<number>(0);

  const autoOrganizeMutation = useAutoOrganize();
  const applyAutoOrganizeMutation = useApplyAutoOrganize();

  // Fetch board with columns
  const { data: board, isLoading: boardLoading } = useQuery<BoardWithColumns>({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const { data, error } = await api.api.boards({ boardId }).get();
      if (error) throw new Error('Failed to fetch board');
      return data;
    }
  });

  // Fetch all tasks for this board
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      if (!board) return [];

      const tasksPromises = board.columns.map(async (column) => {
        const { data, error } = await api.api.tasks({ id: column.id }).get();
        if (error) return [];
        return data;
      });

      const tasksByColumn = await Promise.all(tasksPromises);
      return tasksByColumn.flat();
    },
    enabled: !!board
  });

  if (boardLoading) {
    return (
      <VStack gap="3" justifyContent="center" alignItems="center" minH="50vh" p="8">
        <Spinner size="lg" />
        <Text color="fg.muted">Loading board...</Text>
      </VStack>
    );
  }

  if (!board) {
    return (
      <Box p="8">
        <Text>Board not found</Text>
        <Button onClick={() => void navigate('/')} mt="4">
          Back to Boards
        </Button>
      </Box>
    );
  }

  const handleCopySummary = async (columnId?: string) => {
    try {
      const { data, error } = columnId
        ? await api.api.boards({ boardId }).summary.get({ query: { columnId } })
        : await api.api.boards({ boardId }).summary.get();
      if (error) throw new Error('Failed to fetch summary');

      await navigator.clipboard.writeText(data.summary);
      toast?.('Summary copied to clipboard!', { type: 'success' });
    } catch (error) {
      console.error('Failed to copy summary:', error);
      toast?.('Failed to copy summary', { type: 'error' });
    }
  };

  const handleAutoOrganize = async () => {
    try {
      const result = await autoOrganizeMutation.mutateAsync({
        space: currentSpace,
        boardId
      });

      setAutoOrganizeSuggestions(result.suggestions);
      setAutoOrganizeSummary(result.summary);
      setTotalTasksAnalyzed(result.totalTasksAnalyzed);
      setIsAutoOrganizeDialogOpen(true);
    } catch (error) {
      console.error('Auto organize error:', error);
      toast?.('Failed to generate suggestions. Please try again.', { type: 'error' });
    }
  };

  const handleApplyAutoOrganize = async (suggestions: AutoOrganizeSuggestion[]) => {
    try {
      const result = await applyAutoOrganizeMutation.mutateAsync(suggestions);

      setIsAutoOrganizeDialogOpen(false);

      toast?.(
        `Successfully organized ${result.applied} tasks${result.failed > 0 ? `. ${result.failed} changes failed.` : ''}`,
        { type: 'success' }
      );
    } catch (error) {
      console.error('Apply auto organize error:', error);
      toast?.('Failed to apply changes. Please try again.', { type: 'error' });
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height={{ base: 'auto', md: 'calc(100vh - 128px)' }}
      minH={{ base: 'calc(100vh - 64px)', md: 'auto' }}
    >
      {/* Header */}
      <HStack
        gap="2"
        justifyContent="space-between"
        alignItems="center"
        borderColor="border.default"
        borderBottomWidth="1px"
        p={{ base: '3', md: '6' }}
        flexWrap="wrap"
      >
        <HStack gap={{ base: '2', md: '4' }} flexWrap="wrap">
          <IconButton
            variant="ghost"
            onClick={() => void navigate('/')}
            aria-label="Back to boards"
            size={{ base: 'sm', md: 'md' }}
          >
            <ArrowLeft />
          </IconButton>
          <Heading size={{ base: 'xl', md: '2xl' }}>{board.name}</Heading>
          <Badge colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}>{board.space}</Badge>
        </HStack>
        <HStack gap="2">
          <Button
            variant="outline"
            size={{ base: 'xs', sm: 'sm' }}
            onClick={() => void handleAutoOrganize()}
            loading={autoOrganizeMutation.isPending}
          >
            <Sparkles width="16" height="16" />
            <Box display={{ base: 'none', sm: 'block' }}>Auto Organize</Box>
          </Button>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton variant="ghost" aria-label="Board options">
                <MoreVertical />
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.ItemGroup>
                  <Menu.Item
                    value="copy-board-summary"
                    asChild
                    onClick={() => void handleCopySummary()}
                  >
                    <HStack gap="2">
                      <FileText width="16" height="16" />
                      Copy Board Summary
                    </HStack>
                  </Menu.Item>
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </HStack>
      </HStack>

      {/* Kanban Board Component */}
      <KanbanBoard
        board={board}
        tasks={allTasks}
        onCopySummary={(columnId: string) => void handleCopySummary(columnId)}
      />

      {/* Auto Organize Dialog */}
      <AutoOrganizeDialog
        open={isAutoOrganizeDialogOpen}
        onOpenChange={setIsAutoOrganizeDialogOpen}
        suggestions={autoOrganizeSuggestions}
        onApply={handleApplyAutoOrganize}
        isApplying={applyAutoOrganizeMutation.isPending}
        summary={autoOrganizeSummary}
        totalTasksAnalyzed={totalTasksAnalyzed}
      />
    </Box>
  );
}
