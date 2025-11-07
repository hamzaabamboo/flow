import { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Surface, Text, useTheme, Chip, Menu, IconButton, Divider } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useAllTasks } from '@/hooks/useAllTasks';
import { TaskCard } from '@/components/TaskCard';
import { useSpaceStore } from '@/store/spaceStore';
import type { CalendarEvent } from '@/types';

export default function TasksScreen() {
  const theme = useTheme();
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const [filterPriority, setFilterPriority] = useState<
    'low' | 'medium' | 'high' | 'urgent' | undefined
  >(undefined);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created'>('dueDate');

  const {
    data: tasks,
    isLoading,
    refetch
  } = useAllTasks({
    space: currentSpace,
    priority: filterPriority
  });

  // Convert tasks to CalendarEvent format for TaskCard
  const calendarTasks: CalendarEvent[] = (tasks || []).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: task.priority,
    completed: task.completed,
    type: 'task' as const,
    space: currentSpace
  }));

  // Sort tasks
  const sortedTasks = [...calendarTasks].sort((a, b) => {
    if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (sortBy === 'priority') {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = a.priority ? priorityOrder[a.priority] : 999;
      const bPriority = b.priority ? priorityOrder[b.priority] : 999;
      return aPriority - bPriority;
    }
    return 0;
  });

  const handlePriorityFilter = (priority: typeof filterPriority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterPriority(priority === filterPriority ? undefined : priority);
  };

  const handleSortChange = (sort: typeof sortBy) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(sort);
    setSortMenuVisible(false);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            All Tasks
          </Text>
          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <IconButton
                icon="sort"
                size={24}
                onPress={() => setSortMenuVisible(true)}
                iconColor={theme.colors.onSurfaceVariant}
              />
            }
          >
            <Menu.Item onPress={() => handleSortChange('dueDate')} title="Sort by Due Date" />
            <Menu.Item onPress={() => handleSortChange('priority')} title="Sort by Priority" />
            <Menu.Item onPress={() => handleSortChange('created')} title="Sort by Created" />
          </Menu>
        </View>

        {/* Priority Filter */}
        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            <Chip
              selected={filterPriority === 'urgent'}
              onPress={() => handlePriorityFilter('urgent')}
              style={styles.filterChip}
              icon="flag"
            >
              Urgent
            </Chip>
            <Chip
              selected={filterPriority === 'high'}
              onPress={() => handlePriorityFilter('high')}
              style={styles.filterChip}
              icon="flag"
            >
              High
            </Chip>
            <Chip
              selected={filterPriority === 'medium'}
              onPress={() => handlePriorityFilter('medium')}
              style={styles.filterChip}
              icon="flag"
            >
              Medium
            </Chip>
            <Chip
              selected={filterPriority === 'low'}
              onPress={() => handlePriorityFilter('low')}
              style={styles.filterChip}
              icon="flag"
            >
              Low
            </Chip>
          </ScrollView>
        </View>

        {filterPriority && (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 20 }}
          >
            Filtered by: {filterPriority}
          </Text>
        )}

        <Divider style={styles.divider} />
      </View>

      {/* Tasks List */}
      {!sortedTasks || sortedTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {isLoading
              ? 'Loading tasks...'
              : filterPriority
                ? 'No tasks with this priority'
                : 'No tasks yet'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            {filterPriority ? 'Try changing the filter' : 'Create tasks from the Agenda tab'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 20, marginBottom: 8 }}
          >
            {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''} • Sorted by{' '}
            {sortBy === 'dueDate' ? 'due date' : sortBy}
          </Text>
          {sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ScrollView>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8
  },
  title: {
    fontWeight: '700'
  },
  filters: {
    paddingVertical: 8
  },
  filterChips: {
    paddingHorizontal: 20,
    gap: 8
  },
  filterChip: {
    marginBottom: 4
  },
  divider: {
    marginTop: 8
  },
  scrollView: {
    flex: 1
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 8
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  }
});
