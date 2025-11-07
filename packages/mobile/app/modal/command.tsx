import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Text,
  Surface,
  useTheme,
  Chip,
  IconButton,
  ActivityIndicator,
  SegmentedButtons,
  Card,
  Divider
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useParseCommand, type ParsedIntent } from '@/hooks/useParseCommand';
import { useExecuteParsedCommand } from '@/hooks/useExecuteParsedCommand';
import { useCommandHistoryStore } from '@/store/commandHistoryStore';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { DatePickerModal } from 'react-native-paper-dates';
import { format } from 'date-fns';

const SUGGESTIONS = [
  'Add task "Review PR" tomorrow at 2pm',
  "What's on my agenda today?",
  'Create task "Team meeting" urgent',
  'Add habit "Morning workout" daily'
];

const isExpoGo = Constants.executionEnvironment === 'storeClient';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export default function CommandModal() {
  const [command, setCommand] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDueDate, setEditDueDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [result, setResult] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  const theme = useTheme();
  const router = useRouter();

  const parseCommand = useParseCommand();
  const executeCommand = useExecuteParsedCommand();
  const { history, addToHistory, loadHistory } = useCommandHistoryStore();

  useEffect(() => {
    setVoiceAvailable(!isExpoGo && Platform.OS !== 'web');
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (parsedIntent?.task) {
      setEditTitle(parsedIntent.task.title || '');
      setEditDescription(parsedIntent.task.description || '');
      setEditPriority((parsedIntent.task.priority as Priority) || 'medium');
      setEditDueDate(parsedIntent.task.dueDate ? new Date(parsedIntent.task.dueDate) : undefined);
    }
  }, [parsedIntent]);

  const handleParse = async () => {
    if (!command.trim()) return;

    try {
      const intent = await parseCommand.mutateAsync(command);
      setParsedIntent(intent);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setResult('Failed to parse command. Please try again.');
      console.error(error);
    }
  };

  const handleExecute = async () => {
    if (!parsedIntent) return;

    try {
      // Update intent with edited values
      const finalIntent: ParsedIntent = {
        ...parsedIntent,
        task: parsedIntent.task
          ? {
              ...parsedIntent.task,
              title: editTitle,
              description: editDescription || undefined,
              priority: editPriority,
              dueDate: editDueDate ? editDueDate.toISOString() : undefined
            }
          : undefined
      };

      await executeCommand.mutateAsync(finalIntent);
      await addToHistory(command);
      setResult('Command executed successfully!');

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      setResult('Failed to execute command. Please try again.');
      console.error(error);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setCommand(suggestion);
    setParsedIntent(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleHistoryPress = (historyCommand: string) => {
    setCommand(historyCommand);
    setParsedIntent(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleVoiceInput = async () => {
    if (!voiceAvailable) return;

    try {
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');

      if (isListening) {
        ExpoSpeechRecognitionModule.abort();
        setIsListening(false);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setResult('Microphone permission denied');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsListening(true);

      ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0].transcript;
          setCommand(transcript);
          setIsListening(false);
          setParsedIntent(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      });

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false
      });
    } catch (error) {
      console.error('Voice input error:', error);
      setIsListening(false);
      setResult('Voice input failed: ' + (error as Error).message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const renderPreview = () => {
    if (!parsedIntent) return null;

    return (
      <Card style={[styles.previewCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <View style={styles.previewHeader}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '700', color: theme.colors.onSurfaceVariant }}
            >
              Preview
            </Text>
            <Chip icon="check-circle" mode="flat" textStyle={{ fontSize: 12 }}>
              {parsedIntent.action}
            </Chip>
          </View>

          <Divider style={{ marginVertical: 12 }} />

          {parsedIntent.task && (
            <View style={styles.taskPreview}>
              <TextInput
                mode="outlined"
                label="Title"
                value={editTitle}
                onChangeText={setEditTitle}
                style={styles.editField}
                dense
              />

              <TextInput
                mode="outlined"
                label="Description (optional)"
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={2}
                style={styles.editField}
                dense
              />

              <View style={styles.editRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="labelSmall"
                    style={{ marginBottom: 4, color: theme.colors.onSurfaceVariant }}
                  >
                    Priority
                  </Text>
                  <SegmentedButtons
                    value={editPriority}
                    onValueChange={(value) => setEditPriority(value as Priority)}
                    buttons={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Med' },
                      { value: 'high', label: 'High' },
                      { value: 'urgent', label: 'Urgent' }
                    ]}
                    density="small"
                  />
                </View>
              </View>

              <View style={styles.editRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="labelSmall"
                    style={{ marginBottom: 4, color: theme.colors.onSurfaceVariant }}
                  >
                    Due Date
                  </Text>
                  <Button
                    mode="outlined"
                    icon="calendar"
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateButton}
                  >
                    {editDueDate ? format(editDueDate, 'MMM dd, yyyy') : 'Set date'}
                  </Button>
                  {editDueDate && (
                    <IconButton
                      icon="close"
                      size={16}
                      onPress={() => setEditDueDate(undefined)}
                      style={styles.clearDateButton}
                    />
                  )}
                </View>
              </View>
            </View>
          )}

          {parsedIntent.habit && (
            <View style={styles.habitPreview}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                <Text style={{ fontWeight: '700' }}>Habit: </Text>
                {parsedIntent.habit.name}
              </Text>
              {parsedIntent.habit.frequency && (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                >
                  <Text style={{ fontWeight: '700' }}>Frequency: </Text>
                  {parsedIntent.habit.frequency}
                </Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

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
                Quick Command
              </Text>
              <IconButton icon="close" onPress={() => router.back()} style={styles.closeButton} />
            </View>

            {/* Command Input */}
            <TextInput
              mode="outlined"
              label="Type your command"
              value={command}
              onChangeText={(text) => {
                setCommand(text);
                setResult(null);
                if (text !== command) {
                  setParsedIntent(null);
                }
              }}
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="e.g., Add task 'Deploy staging' tomorrow at 3pm"
            />

            {/* Voice Button */}
            <View style={styles.voiceContainer}>
              <IconButton
                icon={isListening ? 'stop-circle' : 'microphone'}
                size={32}
                mode="contained"
                containerColor={
                  isListening
                    ? theme.colors.errorContainer
                    : voiceAvailable
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceDisabled
                }
                iconColor={
                  isListening
                    ? theme.colors.error
                    : voiceAvailable
                      ? theme.colors.primary
                      : theme.colors.onSurfaceDisabled
                }
                onPress={handleVoiceInput}
                disabled={!voiceAvailable}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {isListening
                  ? 'Listening...'
                  : voiceAvailable
                    ? 'Tap to speak'
                    : 'Voice only in dev builds'}
              </Text>
            </View>

            {/* Parse Button */}
            {!parsedIntent && (
              <Button
                mode="contained"
                onPress={handleParse}
                loading={parseCommand.isPending}
                disabled={parseCommand.isPending || !command.trim()}
                style={styles.button}
                icon="eye"
              >
                Preview Command
              </Button>
            )}

            {/* Preview & Edit */}
            {parsedIntent && renderPreview()}

            {/* Execute Button */}
            {parsedIntent && (
              <Button
                mode="contained"
                onPress={handleExecute}
                loading={executeCommand.isPending}
                disabled={executeCommand.isPending || !editTitle.trim()}
                style={[styles.button, { marginTop: 16 }]}
                icon="send"
              >
                Execute Command
              </Button>
            )}

            {/* Result Message */}
            {(parseCommand.isPending || executeCommand.isPending) && (
              <View style={styles.resultContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.onSurface }}>
                  {parseCommand.isPending ? 'Parsing...' : 'Executing...'}
                </Text>
              </View>
            )}

            {result && (
              <View
                style={[styles.resultContainer, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                  ✓ {result}
                </Text>
              </View>
            )}

            {/* Recent Commands */}
            {history.length > 0 && !parsedIntent && (
              <View style={styles.historyContainer}>
                <Text
                  variant="labelLarge"
                  style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}
                >
                  Recent:
                </Text>
                <View style={styles.chipContainer}>
                  {history.slice(0, 5).map((cmd) => (
                    <Chip
                      key={cmd}
                      onPress={() => handleHistoryPress(cmd)}
                      style={styles.chip}
                      mode="outlined"
                      icon="history"
                    >
                      {cmd.length > 40 ? cmd.substring(0, 40) + '...' : cmd}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Suggestions */}
            {!parsedIntent && (
              <View style={styles.suggestionsContainer}>
                <Text
                  variant="labelLarge"
                  style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}
                >
                  Try these:
                </Text>
                <View style={styles.chipContainer}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Chip
                      key={suggestion}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={styles.chip}
                      mode="outlined"
                    >
                      {suggestion}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </Surface>

      {/* Date Picker Modal */}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        date={editDueDate}
        onConfirm={(params: { date?: Date }) => {
          setShowDatePicker(false);
          if (params.date) {
            setEditDueDate(params.date);
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
  scrollContent: {
    flexGrow: 1
  },
  content: {
    padding: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  closeButton: {
    margin: 0
  },
  title: {
    flex: 1,
    fontWeight: '700'
  },
  input: {
    marginBottom: 16
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8
  },
  button: {
    marginTop: 8
  },
  previewCard: {
    marginTop: 16,
    borderRadius: 12
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  taskPreview: {
    gap: 12
  },
  habitPreview: {
    gap: 8
  },
  editField: {
    backgroundColor: 'transparent'
  },
  editRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end'
  },
  dateButton: {
    flex: 1
  },
  clearDateButton: {
    position: 'absolute',
    right: -8,
    top: -8
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyContainer: {
    marginTop: 24
  },
  suggestionsContainer: {
    marginTop: 24
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    marginBottom: 4
  }
});
