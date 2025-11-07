import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Surface, Text, useTheme, Card, FAB, IconButton } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useBoards } from '@/hooks/useBoards';
import { useSpaceStore } from '@/store/spaceStore';
import type { Board } from '@/types';

interface BoardCardProps {
  board: Board;
  onPress: () => void;
}

function BoardCard({ board, onPress }: BoardCardProps) {
  const theme = useTheme();
  const spaceColor = board.space === 'work' ? theme.colors.primary : theme.colors.secondary;

  return (
    <Card
      style={[styles.boardCard, { backgroundColor: theme.colors.surface }]}
      mode="elevated"
      elevation={2}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Card.Content style={styles.boardContent}>
        <View style={[styles.boardIcon, { backgroundColor: spaceColor }]}>
          <Text variant="headlineMedium" style={{ color: '#fff', fontWeight: '700' }}>
            {board.name.substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.boardInfo}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            {board.name}
          </Text>
          {board.description && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
            >
              {board.description}
            </Text>
          )}
          <View style={styles.boardMeta}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {board.space === 'work' ? '💼 Work' : '🏠 Personal'}
            </Text>
          </View>
        </View>
        <IconButton icon="chevron-right" size={24} iconColor={theme.colors.onSurfaceVariant} />
      </Card.Content>
    </Card>
  );
}

export default function BoardsScreen() {
  const theme = useTheme();
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const { data: boards, isLoading, refetch } = useBoards(currentSpace);

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const handleBoardPress = (boardId: string) => {
    // TODO: Navigate to board detail/kanban view
    console.log('Open board:', boardId);
  };

  const handleCreateBoard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open create board modal
    console.log('Create new board');
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          Boards
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Organize tasks with Kanban boards
        </Text>
      </View>

      {/* Boards List */}
      {!boards || boards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {isLoading ? 'Loading boards...' : 'No boards yet'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Create your first board to get started
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onPress={() => handleBoardPress(board.id)} />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        label="New Board"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleCreateBoard}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16
  },
  title: {
    fontWeight: '700',
    marginBottom: 4
  },
  scrollView: {
    flex: 1
  },
  listContent: {
    padding: 20,
    paddingBottom: 90,
    gap: 12
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  boardCard: {
    borderRadius: 12
  },
  boardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  boardIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  boardInfo: {
    flex: 1,
    marginLeft: 16
  },
  boardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  }
});
