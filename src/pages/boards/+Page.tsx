import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { useSpace } from '../../contexts/SpaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import * as Card from '../../components/ui/styled/card';
import { Text } from '../../components/ui/text';
import { BoardDialog } from '../../components/Board/BoardDialog';
import { VStack, HStack, Box } from 'styled-system/jsx';
import type { BoardInfo } from '~/shared/types/board';
import { Heading } from '~/components/ui/heading';
import { Spinner } from '~/components/ui/spinner';

export default function HomePage() {
  const { currentSpace } = useSpace();
  const { isAuthenticated, login } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch boards
  const { data: boards, isLoading } = useQuery<BoardInfo[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      const data = await response.json();
      // Sort by most recently updated first
      return data.toSorted((a: BoardInfo, b: BoardInfo) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      });
    },
    enabled: isAuthenticated
  });

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <VStack gap="4" justifyContent="center" alignItems="center" minHeight="60vh">
        <Heading fontSize="xl" fontWeight="bold">
          Please log in to continue
        </Heading>
        <Button onClick={() => login()} variant="solid">
          Log in with OAuth
        </Button>
      </VStack>
    );
  }

  if (isLoading) {
    return (
      <VStack gap="3" justifyContent="center" alignItems="center" minH="60vh" p="8">
        <Spinner size="lg" />
        <Text color="fg.muted">Loading boards...</Text>
      </VStack>
    );
  }

  return (
    <>
      <BoardDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(boardId) => void navigate(`/board/${boardId}`)}
      />

      <Box data-space={currentSpace} p="6">
        <VStack gap="6" alignItems="stretch">
          <HStack justifyContent="space-between" alignItems="center">
            <VStack gap="1" alignItems="start">
              <Heading size="2xl">Boards</Heading>
              <Text color="fg.muted">
                Manage your {currentSpace === 'work' ? 'work' : 'personal'} boards
              </Text>
            </VStack>

            <Button onClick={() => setIsDialogOpen(true)} variant="solid">
              + New Board
            </Button>
          </HStack>

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
                <Button onClick={() => setIsDialogOpen(true)} variant="solid">
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
        </VStack>
      </Box>
    </>
  );
}
