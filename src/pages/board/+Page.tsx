import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { Plus, ExternalLink, Users, Calendar } from 'lucide-react';
import { useSpace } from '../../contexts/SpaceContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import * as Card from '../../components/ui/styled/card';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { Badge } from '../../components/ui/badge';
import { VStack, HStack, Box, Grid } from 'styled-system/jsx';
import type { Board as BoardInfo } from '~/shared/types/board';
import { api } from '../../api/client';

export default function BoardsListPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  // Fetch boards
  const { data: boards, isLoading } = useQuery<BoardInfo[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const { data, error } = await api.api.boards.get({ query: { space: currentSpace } });
      if (error) throw new Error('Failed to fetch boards');
      return data as BoardInfo[];
    }
  });

  // Create board mutation
  const createBoard = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await api.api.boards.post({
        name,
        space: currentSpace
      });
      if (error) throw new Error('Failed to create board');
      return data as { data: { id: string } };
    },
    onSuccess: (response) => {
      const newBoard = response.data;
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      void navigate(`/board/${newBoard.id}`);
      setNewBoardName('');
      setIsCreatingBoard(false);
    }
  });

  const handleCreateBoard = () => {
    if (newBoardName.trim()) {
      createBoard.mutate(newBoardName);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateBoard();
    } else if (e.key === 'Escape') {
      setIsCreatingBoard(false);
      setNewBoardName('');
    }
  };

  if (isLoading) {
    return (
      <Box p="8">
        <Text color="fg.default">Loading boards...</Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box borderColor="border.default" borderBottomWidth="1px" mb="8" bg="bg.default">
        <VStack gap="6" p={{ base: '4', md: '6' }}>
          <HStack justifyContent="space-between" alignItems="center" w="full">
            <HStack gap="4">
              <Heading size="3xl" color="fg.default">
                {currentSpace === 'work' ? 'Work' : 'Personal'} Boards
              </Heading>
              <Badge colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}>
                {boards?.length || 0} boards
              </Badge>
            </HStack>

            <HStack gap="3">
              <Button onClick={() => void navigate('/board/all')} variant="outline">
                View All Tasks
              </Button>
              {!isCreatingBoard && (
                <Button onClick={() => setIsCreatingBoard(true)} variant="solid">
                  <Plus width="16" height="16" />
                  New Board
                </Button>
              )}
            </HStack>
          </HStack>

          {/* Create Board Form */}
          {isCreatingBoard && (
            <HStack gap="3" w="full" maxW="400px">
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Enter board name"
                onKeyDown={handleKeyPress}
              />
              <Button onClick={handleCreateBoard} disabled={!newBoardName.trim()} variant="solid">
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsCreatingBoard(false);
                  setNewBoardName('');
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </HStack>
          )}
        </VStack>
      </Box>

      {/* Boards Grid */}
      <Box p={{ base: '2', md: '4' }}>
        {boards && boards.length > 0 ? (
          <Grid
            gap="6"
            gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
          >
            {boards.map((board) => (
              <Card.Root
                key={board.id}
                onClick={() => void navigate(`/board/${board.id}`)}
                cursor="pointer"
                width="full"
                transition="all 0.2s"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: 'lg',
                  borderColor: 'colorPalette.default'
                }}
              >
                <Card.Header>
                  <HStack justifyContent="space-between" alignItems="flex-start" w="full">
                    <VStack flex="1" gap="1" alignItems="flex-start">
                      <Card.Title>{board.name}</Card.Title>
                      <Card.Description>
                        {(board.columnOrder as string[])?.length || 3} columns • Updated{' '}
                        {board.updatedAt ? new Date(board.updatedAt).toLocaleDateString() : 'Never'}
                      </Card.Description>
                    </VStack>
                    <Badge size="sm" colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}>
                      {board.space}
                    </Badge>
                  </HStack>
                </Card.Header>

                <Card.Body>
                  <HStack gap="4" w="full">
                    <HStack gap="1">
                      <Users width="14" height="14" />
                      <Text color="fg.muted" fontSize="sm">
                        {(board.columnOrder as string[])?.length || 3} columns
                      </Text>
                    </HStack>

                    <HStack gap="1">
                      <Calendar width="14" height="14" />
                      <Text color="fg.muted" fontSize="sm">
                        {board.updatedAt ? new Date(board.updatedAt).toLocaleDateString() : 'Never'}
                      </Text>
                    </HStack>
                  </HStack>
                </Card.Body>

                <Card.Footer>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigate(`/board/${board.id}`);
                    }}
                    justifyContent="center"
                    w="full"
                  >
                    <ExternalLink width="14" height="14" />
                    Open Board
                  </Button>
                </Card.Footer>
              </Card.Root>
            ))}
          </Grid>
        ) : (
          <Box py="12" textAlign="center">
            <VStack gap="4">
              <Text color="fg.muted" fontSize="lg">
                No boards in your {currentSpace} space yet
              </Text>
              <Text color="fg.muted" fontSize="sm">
                Create your first board to start organizing your tasks
              </Text>
              {!isCreatingBoard && (
                <Button onClick={() => setIsCreatingBoard(true)} variant="solid">
                  <Plus width="16" height="16" />
                  Create Your First Board
                </Button>
              )}
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
