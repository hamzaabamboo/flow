import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Text,
  Surface,
  useTheme,
  IconButton,
  Chip,
  SegmentedButtons
} from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DatePickerModal } from 'react-native-paper-dates';
import * as Haptics from 'expo-haptics';
import { useCreateTask } from '@/hooks/useCreateTask';
import { useSpaceStore } from '@/store/spaceStore';
import type { Space } from '@/types';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default function QuickAddModal() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    sharedText?: string;
    sharedTitle?: string;
    sharedUrl?: string;
  }>();
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const createTask = useCreateTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space>(currentSpace);

  // Handle shared content from Android share intent
  useEffect(() => {
    if (params.sharedText || params.sharedTitle || params.sharedUrl) {
      // Use shared title as task title, or first line of shared text
      if (params.sharedTitle) {
        setTitle(params.sharedTitle);
      } else if (params.sharedText) {
        const firstLine = params.sharedText.split('\n')[0];
        setTitle(firstLine.substring(0, 100)); // Limit title length
      }

      // Build description from shared content
      let desc = '';
      if (params.sharedText) {
        desc = params.sharedText;
      }
      if (params.sharedUrl && params.sharedUrl !== params.sharedText) {
        desc += desc ? `\n\n${params.sharedUrl}` : params.sharedUrl;
      }
      setDescription(desc);
    }
  }, [params.sharedText, params.sharedTitle, params.sharedUrl]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate?.toISOString(),
        space: selectedSpace
      });
      router.back();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent':
        return theme.colors.error;
      case 'high':
        return '#FB923C';
      case 'medium':
        return '#FBBF24';
      case 'low':
        return theme.colors.tertiary;
      default:
        return theme.colors.surfaceVariant;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.surface, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text
                  variant="headlineSmall"
                  style={[styles.title, { color: theme.colors.onBackground }]}
                >
                  Quick Add Task
                </Text>
                <IconButton icon="close" onPress={() => router.back()} />
              </View>

              {/* Task Title */}
              <TextInput
                mode="outlined"
                label="Task Title *"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                placeholder="What needs to be done?"
              />

              {/* Task Description */}
              <TextInput
                mode="outlined"
                label="Description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={styles.input}
                placeholder="Add more details..."
              />

              {/* Priority */}
              <View style={styles.section}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Priority
                </Text>
                <View style={styles.priorityContainer}>
                  {PRIORITIES.map((p) => {
                    const isSelected = priority === p;
                    return (
                      <Chip
                        key={p}
                        selected={isSelected}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPriority(p);
                        }}
                        style={[
                          styles.priorityChip,
                          isSelected && {
                            backgroundColor: getPriorityColor(p)
                          }
                        ]}
                      >
                        {p}
                      </Chip>
                    );
                  })}
                </View>
              </View>

              {/* Due Date */}
              <View style={styles.section}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Due Date
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDatePicker(true);
                  }}
                  icon="calendar"
                  style={styles.dateButton}
                >
                  {dueDate ? dueDate.toLocaleDateString() : 'No due date'}
                </Button>
                {dueDate && (
                  <Button
                    mode="text"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDueDate(undefined);
                    }}
                    compact
                  >
                    Clear
                  </Button>
                )}
              </View>

              {/* Space Selector */}
              <View style={styles.section}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Space
                </Text>
                <SegmentedButtons
                  value={selectedSpace}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSpace(value as Space);
                  }}
                  buttons={[
                    {
                      value: 'work',
                      label: 'Work',
                      icon: 'briefcase'
                    },
                    {
                      value: 'personal',
                      label: 'Personal',
                      icon: 'home'
                    }
                  ]}
                />
              </View>

              {/* Create Button */}
              <Button
                mode="contained"
                onPress={handleCreate}
                style={styles.createButton}
                icon="plus"
                loading={createTask.isPending}
                disabled={createTask.isPending || !title.trim()}
              >
                Create Task
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Surface>

      {/* Date Picker Modal */}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        date={dueDate}
        onConfirm={(params: { date?: Date }) => {
          setShowDatePicker(false);
          if (params.date) {
            setDueDate(params.date);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
      />
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
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    padding: 24,
    gap: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    flex: 1,
    fontWeight: '700'
  },
  input: {
    marginBottom: 4
  },
  section: {
    gap: 12
  },
  sectionLabel: {
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
  dateButton: {
    justifyContent: 'flex-start'
  },
  createButton: {
    marginTop: 16,
    paddingVertical: 4
  }
});
