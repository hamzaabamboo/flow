import { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Surface,
  Text,
  FAB,
  useTheme,
  IconButton,
  Divider,
  Card,
  Checkbox
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { format, addDays, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { useAgendaTasks } from '@/hooks/useAgendaTasks';
import { useHabits } from '@/hooks/useHabits';
import { useCompleteHabit } from '@/hooks/useCompleteHabit';
import { TaskCard } from '@/components/TaskCard';
import { useSpaceStore } from '@/store/spaceStore';
import type { Habit } from '@/types';

interface HabitItemProps {
  habit: Habit;
  onToggle: (habitId: string, completed: boolean) => void;
  isCompleting: boolean;
}

function HabitItem({ habit, onToggle, isCompleting }: HabitItemProps) {
  const theme = useTheme();
  const isCompleted = habit.completedToday || false;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(habit.id, !isCompleted);
  };

  return (
    <Card
      style={[styles.habitCard, { backgroundColor: theme.colors.surface }]}
      mode="elevated"
      elevation={1}
    >
      <Card.Content style={styles.habitContent}>
        <Checkbox
          status={isCompleted ? 'checked' : 'unchecked'}
          onPress={handleToggle}
          disabled={isCompleting}
          color={theme.colors.secondary}
        />
        <View style={styles.habitInfo}>
          <Text variant="bodyLarge" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
            {habit.name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {habit.frequency === 'daily' ? '📅 Daily habit' : '📆 Weekly habit'}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function AgendaScreen() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const theme = useTheme();
  const router = useRouter();
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const {
    data: tasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
    error
  } = useAgendaTasks(view, selectedDate);
  const {
    data: habits,
    isLoading: habitsLoading,
    refetch: refetchHabits
  } = useHabits(currentSpace, selectedDate);
  const completeHabit = useCompleteHabit();

  const isLoading = tasksLoading || habitsLoading;

  // Swipe gesture animation
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const handleRefresh = () => {
    refetchTasks();
    refetchHabits();
  };

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

  const handleDateChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const days = view === 'day' ? 1 : 7;
    setSelectedDate(
      direction === 'next' ? addDays(selectedDate, days) : subDays(selectedDate, days)
    );
  };

  // Swipe gesture
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow horizontal swipes
      if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
        return;
      }
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const SWIPE_THRESHOLD = 80;

      if (event.translationX > SWIPE_THRESHOLD) {
        // Swipe right - previous day/week
        opacity.value = withTiming(0, { duration: 150 });
        translateX.value = withTiming(300, { duration: 150 }, () => {
          runOnJS(handleDateChange)('prev');
          translateX.value = -300;
          translateX.value = withTiming(0, { duration: 150 });
          opacity.value = withTiming(1, { duration: 150 });
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        // Swipe left - next day/week
        opacity.value = withTiming(0, { duration: 150 });
        translateX.value = withTiming(-300, { duration: 150 }, () => {
          runOnJS(handleDateChange)('next');
          translateX.value = 300;
          translateX.value = withTiming(0, { duration: 150 });
          opacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        // Reset if swipe wasn't far enough
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value
  }));

  console.log('[AgendaScreen] Render:', {
    view,
    currentSpace,
    tasksCount: tasks?.length || 0,
    isLoading,
    hasError: !!error,
    error: error?.message
  });

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with date and view toggle */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text
            variant="headlineMedium"
            style={[styles.dateText, { color: theme.colors.onBackground, fontWeight: '700' }]}
          >
            {format(selectedDate, 'EEEE')}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {format(selectedDate, 'MMMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.controls}>
          <View style={[styles.viewToggle, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Pressable
              style={[
                styles.viewButton,
                view === 'day' && [
                  styles.activeViewButton,
                  { backgroundColor: theme.colors.primary }
                ]
              ]}
              onPress={() => setView('day')}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  {
                    color: view === 'day' ? '#000' : theme.colors.onSurfaceVariant,
                    fontWeight: view === 'day' ? '700' : '500',
                    fontSize: 12
                  }
                ]}
              >
                Day
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewButton,
                view === 'week' && [
                  styles.activeViewButton,
                  { backgroundColor: theme.colors.primary }
                ]
              ]}
              onPress={() => setView('week')}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  {
                    color: view === 'week' ? '#000' : theme.colors.onSurfaceVariant,
                    fontWeight: view === 'week' ? '700' : '500',
                    fontSize: 12
                  }
                ]}
              >
                Week
              </Text>
            </Pressable>
          </View>
          <View style={styles.datePicker}>
            <IconButton
              icon="chevron-left"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => setSelectedDate(subDays(selectedDate, view === 'day' ? 1 : 7))}
              style={styles.dateButton}
            />
            <Pressable
              onPress={() => setSelectedDate(new Date())}
              style={[styles.todayButton, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Text
                style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600', fontSize: 12 }}
              >
                Today
              </Text>
            </Pressable>
            <IconButton
              icon="chevron-right"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => setSelectedDate(addDays(selectedDate, view === 'day' ? 1 : 7))}
              style={styles.dateButton}
            />
          </View>
        </View>
      </View>

      {/* Content */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          {!tasks || (tasks.length === 0 && (!habits || habits.length === 0)) ? (
            <View style={styles.emptyState}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {isLoading ? 'Loading...' : 'No tasks or habits for today'}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
              >
                Tap + to add a new task
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
            >
              {/* Habits Section */}
              {habits && habits.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text
                      variant="titleMedium"
                      style={{ fontWeight: '700', color: theme.colors.onBackground }}
                    >
                      🎯 Today's Habits
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {habits.length} habit{habits.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {habits.map((habit) => (
                    <HabitItem
                      key={habit.id}
                      habit={habit}
                      onToggle={handleToggleHabit}
                      isCompleting={completeHabit.isPending}
                    />
                  ))}
                  <Divider style={styles.sectionDivider} />
                </>
              )}

              {/* Tasks Section */}
              {tasks && tasks.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text
                      variant="titleMedium"
                      style={{ fontWeight: '700', color: theme.colors.onBackground }}
                    >
                      ✅ Tasks
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </GestureDetector>

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/modal/quick-add')}
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
    gap: 16
  },
  headerTop: {
    gap: 4
  },
  dateText: {
    marginBottom: 0
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 4
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dateButton: {
    margin: 0
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeViewButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  viewButtonText: {
    // Remove textTransform and letterSpacing to prevent clipping
  },
  scrollView: {
    flex: 1
  },
  listContent: {
    paddingBottom: 90,
    paddingTop: 8
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  sectionDivider: {
    marginVertical: 16,
    marginHorizontal: 20
  },
  habitCard: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8
  },
  habitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  habitInfo: {
    flex: 1,
    marginLeft: 8
  }
});
