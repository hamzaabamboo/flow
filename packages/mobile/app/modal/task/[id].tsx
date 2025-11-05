import { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import {
  TextInput,
  Button,
  Text,
  Surface,
  useTheme,
  IconButton,
  SegmentedButtons,
  Chip,
  Divider,
} from 'react-native-paper'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import * as Haptics from 'expo-haptics'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const STATUS_OPTIONS = ['todo', 'in_progress', 'completed']

export default function TaskDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useTheme()
  const router = useRouter()

  // Mock task data - replace with actual API call
  const [task, setTask] = useState({
    id,
    title: 'Review Pull Request #123',
    description: 'Review the authentication refactor PR and provide feedback',
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(),
    tags: ['Development', 'Code Review'],
  })

  const [isEditing, setIsEditing] = useState(false)

  const handleSave = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setIsEditing(false)
    // TODO: Save to API
  }

  const handleDelete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    // TODO: Show confirmation dialog
    // TODO: Delete from API
    router.back()
  }

  const handleComplete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setTask({ ...task, status: 'completed' })
    // TODO: Update API
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return theme.colors.error
      case 'high':
        return '#FB923C' // orange
      case 'medium':
        return '#FBBF24' // yellow
      case 'low':
        return theme.colors.tertiary
      default:
        return theme.colors.surfaceVariant
    }
  }

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              Task Details
            </Text>
            <View style={styles.headerActions}>
              <IconButton
                icon={isEditing ? 'close' : 'pencil'}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setIsEditing(!isEditing)
                }}
              />
              <IconButton icon="close" onPress={() => router.back()} />
            </View>
          </View>

          {/* Task Title */}
          <TextInput
            mode="outlined"
            label="Title"
            value={task.title}
            onChangeText={(text) => setTask({ ...task, title: text })}
            style={styles.input}
            disabled={!isEditing}
          />

          {/* Task Description */}
          <TextInput
            mode="outlined"
            label="Description"
            value={task.description}
            onChangeText={(text) => setTask({ ...task, description: text })}
            multiline
            numberOfLines={4}
            style={styles.input}
            disabled={!isEditing}
          />

          <Divider style={styles.divider} />

          {/* Priority */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Priority
            </Text>
            <View style={styles.priorityContainer}>
              {PRIORITIES.map((priority) => (
                <Chip
                  key={priority}
                  selected={task.priority === priority}
                  onPress={() => {
                    if (isEditing) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setTask({ ...task, priority })
                    }
                  }}
                  style={[
                    styles.priorityChip,
                    task.priority === priority && {
                      backgroundColor: getPriorityColor(priority),
                    },
                  ]}
                  disabled={!isEditing}
                >
                  {priority}
                </Chip>
              ))}
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Status */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Status
            </Text>
            <SegmentedButtons
              value={task.status}
              onValueChange={(value) => {
                if (isEditing) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setTask({ ...task, status: value })
                }
              }}
              buttons={[
                {
                  value: 'todo',
                  label: 'To Do',
                  icon: 'circle-outline',
                  disabled: !isEditing,
                },
                {
                  value: 'in_progress',
                  label: 'In Progress',
                  icon: 'progress-clock',
                  disabled: !isEditing,
                },
                {
                  value: 'completed',
                  label: 'Done',
                  icon: 'check-circle',
                  disabled: !isEditing,
                },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Due Date */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Due Date
            </Text>
            <Text variant="bodyLarge">{format(task.dueDate, 'PPP p')}</Text>
          </View>

          <Divider style={styles.divider} />

          {/* Tags */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Tags
            </Text>
            <View style={styles.tagsContainer}>
              {task.tags.map((tag, index) => (
                <Chip key={index} mode="outlined" style={styles.tag}>
                  {tag}
                </Chip>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          {isEditing ? (
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.actionButton}
                icon="content-save"
              >
                Save Changes
              </Button>
              <Button
                mode="contained-tonal"
                onPress={handleDelete}
                buttonColor={theme.colors.errorContainer}
                textColor={theme.colors.error}
                style={styles.actionButton}
                icon="delete"
              >
                Delete Task
              </Button>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={handleComplete}
                style={styles.actionButton}
                icon="check"
                disabled={task.status === 'completed'}
              >
                {task.status === 'completed' ? 'Completed' : 'Mark Complete'}
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
  },
  title: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    marginBottom: 4,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    marginBottom: 4,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 4,
  },
})
