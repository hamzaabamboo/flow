import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { useSpace } from '../../contexts/SpaceContext';
import { useAuth } from '../../contexts/AuthContext';
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
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

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
      void navigate(`/board/${newBoard.id}`);
      setNewBoardName('');
      setIsCreatingBoard(false);
    }
  });

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
        <Card.Root width="full" mb="4">
          <Card.Header>
            <Card.Title>Create New Board</Card.Title>
            <Card.Description>Enter a name for your new board</Card.Description>
          </Card.Header>
          <Card.Body>
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
          </Card.Body>
          <Card.Footer gap="2">
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
            <Button onClick={handleCreateBoard} variant="solid" size="sm">
              Create Board
            </Button>
          </Card.Footer>
        </Card.Root>
      )}

      {!boards || boards.length === 0 ? (
        <Card.Root width="full" textAlign="center">
          <Card.Header>
            <Card.Title>Welcome to HamFlow</Card.Title>
            <Card.Description>
              Create your first board to get started with task management
            </Card.Description>
          </Card.Header>
          <Card.Body py="8">
            <Text color="fg.muted" fontSize="lg">
              No boards yet in your {currentSpace} space
            </Text>
          </Card.Body>
          <Card.Footer justifyContent="center">
            <Button onClick={() => setIsCreatingBoard(true)} variant="solid">
              + Create Your First Board
            </Button>
          </Card.Footer>
        </Card.Root>
      ) : (
        <Box display="grid" gap="4" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))">
          {boards.map((board) => (
            <Card.Root
              key={board.id}
              onClick={() => void navigate(`/board/${board.id}`)}
              cursor="pointer"
              width="full"
              transition="all 0.2s"
              _hover={{
                transform: 'translateY(-2px)',
                borderColor: 'colorPalette.default',
                boxShadow: 'md'
              }}
            >
              <Card.Header>
                <Card.Title>{board.name}</Card.Title>
                <Card.Description>{currentSpace} board</Card.Description>
              </Card.Header>
              <Card.Body>
                <Text color="fg.muted" fontSize="sm">
                  Click to open board and manage tasks
                </Text>
              </Card.Body>
              <Card.Footer>
                <Button size="sm" variant="ghost" justifyContent="center" w="full">
                  Open Board →
                </Button>
              </Card.Footer>
            </Card.Root>
          ))}
        </Box>
      )}
    </Box>
  );
}
