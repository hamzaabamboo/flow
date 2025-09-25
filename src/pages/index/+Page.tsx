import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { Board } from '../../components/Kanban/Board';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import * as Card from '../../components/ui/styled/card';
import { Text } from '../../components/ui/text';
import { VStack, HStack, Box } from 'styled-system/jsx';

interface BoardInfo {
  id: string;
  name: string;
  space: string;
}

export default function HomePage() {
  const { currentSpace } = useSpace();
  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <VStack gap="4" justifyContent="center" alignItems="center" minHeight="60vh">
        <h2 style={{ fontSize: 'var(--font-sizes-xl)', fontWeight: '600' }}>
          Please log in to continue
        </h2>
        <Button onClick={() => login()} variant="solid">
          Log in with OAuth
        </Button>
      </VStack>
    );
  }

  // Fetch boards
  const { data: boards, isLoading } = useQuery<BoardInfo[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      return response.json();
    },
    enabled: isAuthenticated
  });

  // Create board mutation
  const createBoard = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          space: currentSpace
        })
      });
      if (!response.ok) throw new Error('Failed to create board');
      return response.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      setSelectedBoardId(newBoard.id);
      setNewBoardName('');
      setIsCreatingBoard(false);
    }
  });

  const handleCreateBoard = () => {
    if (newBoardName.trim()) {
      createBoard.mutate(newBoardName);
    }
  };

  if (isLoading) {
    return (
      <Box p="8">
        <Text>Loading boards...</Text>
      </Box>
    );
  }

  if (selectedBoardId) {
    return (
      <Box>
        <Button
          onClick={() => setSelectedBoardId(null)}
          variant="outline"
          position="absolute"
          top="22"
          left="8"
        >
          ← Back to Boards
        </Button>
        <Board boardId={selectedBoardId} />
      </Box>
    );
  }

  return (
    <Box p="8">
      <HStack justifyContent="space-between" alignItems="center" mb="8">
        <Text fontSize="3xl" fontWeight="bold">
          {currentSpace === 'work' ? 'Work' : 'Personal'} Boards
        </Text>

        {!isCreatingBoard && (
          <Button onClick={() => setIsCreatingBoard(true)} variant="solid">
            + New Board
          </Button>
        )}
      </HStack>

      {isCreatingBoard && (
        <Card.Root mb="4">
          <Card.Body>
            <VStack gap="3">
              <Input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBoard();
                  if (e.key === 'Escape') setIsCreatingBoard(false);
                }}
                placeholder="Enter board name..."
              />
              <HStack gap="2">
                <Button onClick={handleCreateBoard} variant="solid" size="sm">
                  Create
                </Button>
                <Button
                  onClick={() => {
                    setIsCreatingBoard(false);
                    setNewBoardName('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

      {!boards || boards.length === 0 ? (
        <Card.Root textAlign="center" bg="bg.subtle">
          <Card.Body py="12">
            <Text color="fg.muted" fontSize="lg">
              No boards yet. Create your first board to get started!
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Box display="grid" gap="4" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))">
          {boards.map((board) => (
            <Card.Root
              key={board.id}
              onClick={() => setSelectedBoardId(board.id)}
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                transform: 'translateY(-2px)',
                borderColor: 'colorPalette.default',
                boxShadow: 'md'
              }}
            >
              <Card.Body>
                <Card.Title>{board.name}</Card.Title>
                <Card.Description>Click to open board →</Card.Description>
              </Card.Body>
            </Card.Root>
          ))}
        </Box>
      )}
    </Box>
  );
}
