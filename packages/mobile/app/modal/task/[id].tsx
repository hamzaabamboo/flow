import { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Text,
  Surface,
  useTheme,
  IconButton,
  Chip,
  Divider,
  Portal,
  Dialog,
  Paragraph
} from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTaskDetail } from '@/hooks/useTaskDetail';
import { useUpdateTask } from '@/hooks/useUpdateTask';
import { useDeleteTask } from '@/hooks/useDeleteTask';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default function TaskDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();

  // Fetch real task data
  const { data: task, isLoading, error } = useTaskDetail(id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Local state for editing
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedPriority, setEditedPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    'medium'
  );
  const [editedCompleted, setEditedCompleted] = useState(false);

  // Initialize edit state when entering edit mode
  const handleEditStart = () => {
    if (task) {
      setEditedTitle(task.title);
      setEditedDescription(task.description || '');
      setEditedPriority(task.priority || 'medium');
      setEditedCompleted(task.completed);
      setIsEditing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    if (!task) return;

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        updates: {
          title: editedTitle,
          description: editedDescription || undefined,
          priority: editedPriority,
          completed: editedCompleted
        }
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    try {
      await deleteTask.mutateAsync(task.id);
      setShowDeleteDialog(false);
      router.back();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleComplete = async () => {
    if (!task) return;

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        updates: {
          completed: !task.completed
        }
      });
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return theme.colors.error;
      case 'high':
        return '#FB923C'; // orange
      case 'medium':
        return '#FBBF24'; // yellow
      case 'low':
        return theme.colors.tertiary;
      default:
        return theme.colors.surfaceVariant;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.content, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyLarge" style={{ marginTop: 16 }}>
            Loading task...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !task) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.content, styles.centerContent]}>
          <Text variant="headlineSmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
            Error Loading Task
          </Text>
          <Text variant="bodyMedium" style={{ marginBottom: 16, textAlign: 'center' }}>
            {error?.message || 'Task not found'}
          </Text>
          <Button mode="contained" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.surface, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text
                variant="headlineSmall"
                style={[styles.title, { color: theme.colors.onBackground }]}
              >
                Task Details
              </Text>
              <View style={styles.headerActions}>
                <IconButton
                  icon={isEditing ? 'close' : 'pencil'}
                  onPress={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } else {
                      handleEditStart();
                    }
                  }}
                />
                <IconButton icon="close" onPress={() => router.back()} />
              </View>
            </View>

            {/* Task Title */}
            <TextInput
              mode="outlined"
              label="Title"
              value={isEditing ? editedTitle : task.title}
              onChangeText={setEditedTitle}
              style={styles.input}
              disabled={!isEditing}
            />

            {/* Task Description */}
            <TextInput
              mode="outlined"
              label="Description"
              value={isEditing ? editedDescription : task.description || ''}
              onChangeText={setEditedDescription}
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
                {PRIORITIES.map((priority) => {
                  const currentPriority = isEditing ? editedPriority : task.priority;
                  const isSelected = currentPriority === priority;

                  return (
                    <Chip
                      key={priority}
                      selected={isSelected}
                      onPress={() => {
                        if (isEditing) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditedPriority(priority);
                        }
                      }}
                      style={[
                        styles.priorityChip,
                        isSelected && {
                          backgroundColor: getPriorityColor(priority)
                        }
                      ]}
                      disabled={!isEditing}
                    >
                      {priority}
                    </Chip>
                  );
                })}
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Status */}
            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                Status
              </Text>
              <Text variant="bodyLarge">{task.completed ? 'Completed' : 'Not Completed'}</Text>
            </View>

            <Divider style={styles.divider} />

            {/* Due Date */}
            {task.dueDate && (
              <>
                <View style={styles.section}>
                  <Text variant="labelLarge" style={styles.sectionLabel}>
                    Due Date
                  </Text>
                  <Text variant="bodyLarge">{format(new Date(task.dueDate), 'PPP')}</Text>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* Tags */}
            {task.labels && task.labels.length > 0 && (
              <>
                <View style={styles.section}>
                  <Text variant="labelLarge" style={styles.sectionLabel}>
                    Labels
                  </Text>
                  <View style={styles.tagsContainer}>
                    {task.labels.map((label) => (
                      <Chip key={label} mode="outlined" style={styles.tag}>
                        {label}
                      </Chip>
                    ))}
                  </View>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* Action Buttons */}
            {isEditing ? (
              <View style={styles.actions}>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={styles.actionButton}
                  icon="content-save"
                  loading={updateTask.isPending}
                  disabled={updateTask.isPending || !editedTitle.trim()}
                >
                  Save Changes
                </Button>
                <Button
                  mode="contained-tonal"
                  onPress={() => setShowDeleteDialog(true)}
                  buttonColor={theme.colors.errorContainer}
                  textColor={theme.colors.error}
                  style={styles.actionButton}
                  icon="delete"
                  disabled={deleteTask.isPending}
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
                  disabled={task.completed || updateTask.isPending}
                  loading={updateTask.isPending}
                >
                  {task.completed ? 'Completed' : 'Mark Complete'}
                </Button>
              </View>
            )}
          </View>
        </ScrollView>
      </Surface>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Task</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete this task? This action cannot be undone.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              onPress={handleDelete}
              textColor={theme.colors.error}
              loading={deleteTask.isPending}
              disabled={deleteTask.isPending}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  surface: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    padding: 24
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerActions: {
    flexDirection: 'row'
  },
  title: {
    flex: 1,
    fontWeight: '700'
  },
  input: {
    marginBottom: 16
  },
  divider: {
    marginVertical: 16
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    marginBottom: 8,
    fontWeight: '600'
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  priorityChip: {
    marginBottom: 4
  },
  segmentedButtons: {
    marginTop: 8
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  tag: {
    marginBottom: 4
  },
  actions: {
    marginTop: 24,
    gap: 12
  },
  actionButton: {
    paddingVertical: 4
  }
});
