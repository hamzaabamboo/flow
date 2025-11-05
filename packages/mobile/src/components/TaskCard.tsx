import { View, StyleSheet } from 'react-native'
import { Card, Checkbox, Text, Chip, IconButton, useTheme } from 'react-native-paper'
import { Swipeable } from 'react-native-gesture-handler'
import { format } from 'date-fns'
import { useRouter } from 'expo-router'
import { useToggleTask } from '@/hooks/useToggleTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { getPriorityColor } from '@/theme'
import type { CalendarEvent } from '@/types'

interface TaskCardProps {
  task: CalendarEvent
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const theme = useTheme()
  const router = useRouter()
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  const handleToggle = () => {
    toggleTask.mutate(task.id)
  }

  const handleDelete = () => {
    deleteTask.mutate(task.id)
  }

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
  )

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Checkbox
              status={task.completed ? 'checked' : 'unchecked'}
              onPress={handleToggle}
            />
            <View style={styles.content}>
              <Text
                variant="titleMedium"
                style={task.completed && styles.completedText}
              >
                {task.title}
              </Text>
              {task.description && (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {task.description}
                </Text>
              )}
              <View style={styles.chips}>
                {task.dueDate && (
                  <Chip
                    icon="clock-outline"
                    compact
                    style={{ backgroundColor: theme.colors.surfaceVariant }}
                  >
                    {format(new Date(task.dueDate), 'HH:mm')}
                  </Chip>
                )}
                {task.priority && (
                  <Chip
                    icon="flag"
                    compact
                    textStyle={{ color: 'white' }}
                    style={{
                      backgroundColor: getPriorityColor(task.priority, theme),
                    }}
                  >
                    {task.priority}
                  </Chip>
                )}
                {task.type === 'habit' && (
                  <Chip
                    icon="repeat"
                    compact
                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                  >
                    Habit
                  </Chip>
                )}
              </View>
            </View>
            <IconButton
              icon="dots-vertical"
              onPress={() => router.push(`/modal/task/${task.id}`)}
            />
          </View>
        </Card.Content>
      </Card>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  actionButton: {
    marginHorizontal: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
})
