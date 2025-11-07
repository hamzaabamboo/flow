import { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Surface, Text, FAB, useTheme, Card, Checkbox, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { useHabits } from '@/hooks/useHabits';
import { useCompleteHabit } from '@/hooks/useCompleteHabit';
import { useSpaceStore } from '@/store/spaceStore';
import * as Haptics from 'expo-haptics';
import type { Habit } from '@/types';

interface HabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, completed: boolean) => void;
  isCompleting: boolean;
}

function HabitCard({ habit, onToggle, isCompleting }: HabitCardProps) {
  const theme = useTheme();
  const isCompleted = habit.completedToday || false;

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(habit.id, !isCompleted);
  };

  return (
    <Card
      style={[styles.habitCard, { backgroundColor: theme.colors.surface }]}
      mode="elevated"
      elevation={1}
    >
      <Card.Content style={styles.habitContent}>
        <View style={styles.habitLeft}>
          <Checkbox
            status={isCompleted ? 'checked' : 'unchecked'}
            onPress={handleToggle}
            disabled={isCompleting}
          />
          <View style={styles.habitInfo}>
            <Text variant="bodyLarge" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
              {habit.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {habit.frequency === 'daily' ? 'Daily' : 'Weekly'}
              {habit.reminderTime && ` • ${habit.reminderTime}`}
            </Text>
          </View>
        </View>
        <IconButton
          icon="pencil"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // TODO: Navigate to habit edit modal
          }}
        />
      </Card.Content>
    </Card>
  );
}

export default function HabitsScreen() {
  const theme = useTheme();
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const [selectedDate] = useState(new Date());
  const { data: habits, isLoading, refetch } = useHabits(currentSpace, selectedDate);
  const completeHabit = useCompleteHabit();

  const handleToggleHabit = async (habitId: string, completed: boolean) => {
    try {
      await completeHabit.mutateAsync({
        habitId,
        date: selectedDate,
        completed
      });
    } catch (error) {
      console.error('Failed to toggle habit:', error);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Habits
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {format(new Date(), 'EEEE, MMMM d')}
          </Text>
        </View>
      </View>

      {/* Habits list */}
      {!habits || habits.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {isLoading ? 'Loading habits...' : 'No habits yet'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Tap + to create your first habit
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onToggle={handleToggleHabit}
              isCompleting={completeHabit.isPending}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // TODO: Navigate to habit create modal
        }}
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
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    gap: 12
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  habitCard: {
    borderRadius: 12
  },
  habitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  habitInfo: {
    flex: 1,
    gap: 4
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  }
});
