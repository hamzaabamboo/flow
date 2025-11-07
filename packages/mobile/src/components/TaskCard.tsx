import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Checkbox, Text, Chip, IconButton, useTheme } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence
} from 'react-native-reanimated';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useToggleTask } from '@/hooks/useToggleTask';
import { useDeleteTask } from '@/hooks/useDeleteTask';
import { getPriorityColor } from '@/theme';
import type { CalendarEvent } from '@/types';

interface TaskCardProps {
  task: CalendarEvent;
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const theme = useTheme();
  const router = useRouter();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();

  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (task.completed) {
      opacity.value = 0.6;
    } else {
      opacity.value = 1;
    }
  }, [task.completed, opacity]);

  const handleToggle = () => {
    // Trigger animation
    scale.value = withSequence(withSpring(0.95, { damping: 10 }), withSpring(1, { damping: 10 }));

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    toggleTask.mutate({
      taskId: task.id,
      instanceDate: task.instanceDate || task.dueDate
    });
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteTask.mutate(task.id);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value
    };
  });

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <IconButton
        icon="check"
        iconColor="white"
        containerColor={theme.colors.tertiary}
        size={24}
        onPress={handleToggle}
        style={styles.actionButton}
      />
      <IconButton
        icon="delete"
        iconColor="white"
        containerColor={theme.colors.error}
        size={24}
        onPress={handleDelete}
        style={styles.actionButton}
      />
    </View>
  );

  const priorityColor = task.priority
    ? getPriorityColor(task.priority, true)
    : theme.colors.outline;

  return (
    <Animated.View style={animatedStyle}>
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <Card
          mode="elevated"
          elevation={1}
          style={[
            styles.card,
            {
              borderLeftWidth: 3,
              borderLeftColor: priorityColor,
              backgroundColor: theme.colors.surface
            }
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <Checkbox
                status={task.completed ? 'checked' : 'unchecked'}
                onPress={handleToggle}
                color={priorityColor}
              />
              <View style={styles.content}>
                <Text
                  variant="titleMedium"
                  style={[
                    { fontWeight: '600', color: theme.colors.onSurface, flexWrap: 'wrap' },
                    task.completed && styles.completedText
                  ]}
                >
                  {task.title}
                </Text>
                {task.description && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, flexWrap: 'wrap' }}
                  >
                    {task.description}
                  </Text>
                )}
                <View style={styles.chips}>
                  {task.completed && task.dueDate && (
                    <Chip
                      icon="check-circle"
                      textStyle={{ fontSize: 12, color: theme.colors.tertiary }}
                      style={{
                        backgroundColor: theme.colors.tertiaryContainer
                      }}
                    >
                      Completed {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                    </Chip>
                  )}
                  {!task.completed && task.dueDate && (
                    <Chip
                      icon="clock-outline"
                      textStyle={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
                      style={{
                        backgroundColor: theme.colors.surfaceVariant
                      }}
                    >
                      {format(new Date(task.dueDate), 'HH:mm')}
                    </Chip>
                  )}
                  {task.priority && (
                    <Chip
                      icon="flag"
                      textStyle={{ fontSize: 12, color: '#000', fontWeight: '600' }}
                      style={{
                        backgroundColor: priorityColor
                      }}
                    >
                      {task.priority}
                    </Chip>
                  )}
                  {task.type === 'habit' && (
                    <Chip
                      icon="repeat"
                      textStyle={{ fontSize: 12 }}
                      style={{
                        backgroundColor: theme.colors.secondaryContainer
                      }}
                    >
                      Habit
                    </Chip>
                  )}
                </View>
              </View>
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => router.push(`/modal/task/${task.id}`)}
              />
            </View>
          </Card.Content>
        </Card>
      </Swipeable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 0
  },
  cardContent: {
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  content: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap'
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8
  },
  actionButton: {
    marginHorizontal: 4
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.5
  }
});
