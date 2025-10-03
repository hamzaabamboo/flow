import { useQuery } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { usePageContext } from 'vike-react/usePageContext';
import { ArrowLeft } from 'lucide-react';
import type { Task } from '../../../components/Board/KanbanColumn';
import { useSpace } from '../../../contexts/SpaceContext';
import { KanbanBoard } from '../../../components/Board/KanbanBoard';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import { Heading } from '../../../components/ui/heading';
import { Badge } from '../../../components/ui/badge';
import type { BoardWithColumns } from '../../../shared/types/board';
import { Box, HStack } from 'styled-system/jsx';

export default function BoardPage() {
  const pageContext = usePageContext();
  const boardId = pageContext.routeParams.boardId;
  const { currentSpace } = useSpace();

  // Fetch board with columns
  const { data: board, isLoading: boardLoading } = useQuery<BoardWithColumns>({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch board');
      return response.json();
    }
  });

  // Fetch all tasks for this board
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      if (!board) return [];

      const tasksPromises = board.columns.map(async (column) => {
        const response = await fetch(`/api/tasks/${column.id}`, {
          credentials: 'include'
        });
        if (!response.ok) return [];
        return response.json();
      });

      const tasksByColumn = await Promise.all(tasksPromises);
      return tasksByColumn.flat();
    },
    enabled: !!board
  });

  if (boardLoading) {
    return (
      <Box p="8">
        <Text>Loading board...</Text>
      </Box>
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
      </HStack>

      {/* Kanban Board Component */}
      <KanbanBoard board={board} tasks={allTasks} />
    </Box>
  );
}
