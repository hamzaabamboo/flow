import { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TextInput, Button, Text, Surface, useTheme, Chip, IconButton, ActivityIndicator } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useExecuteCommand } from '@/hooks/useExecuteCommand'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'

const SUGGESTIONS = [
  'Add task "Review PR" tomorrow at 2pm',
  'What\'s on my agenda today?',
  'Create task "Team meeting" urgent',
  'Add habit "Morning workout" daily',
]

// Check if we're running in Expo Go (which doesn't support speech recognition)
const isExpoGo = Constants.executionEnvironment === 'storeClient'

export default function CommandModal() {
  const [command, setCommand] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const theme = useTheme()
  const router = useRouter()
  const executeCommand = useExecuteCommand()

  useEffect(() => {
    // Voice only works in dev builds, not Expo Go
    setVoiceAvailable(!isExpoGo && Platform.OS !== 'web')
  }, [])

  const handleExecute = async () => {
    if (!command.trim()) return

    try {
      const response = await executeCommand.mutateAsync(command)
      setResult(response.message)

      // Close modal after 1.5 seconds
      setTimeout(() => {
        router.back()
      }, 1500)
    } catch (error) {
      setResult('Failed to execute command. Please try again.')
    }
  }

  const handleSuggestionPress = (suggestion: string) => {
    setCommand(suggestion)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleVoiceInput = async () => {
    if (!voiceAvailable) return

    try {
      // Dynamic import to avoid crashes in Expo Go
      const ExpoSpeechRecognition = await import('expo-speech-recognition')

      if (isListening) {
        ExpoSpeechRecognition.abort()
        setIsListening(false)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        return
      }

      // Request permissions
      const { granted } = await ExpoSpeechRecognition.requestPermissions()
      if (!granted) {
        setResult('Microphone permission denied')
        return
      }

      // Start listening
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsListening(true)

      // Set up event listener
      ExpoSpeechRecognition.addSpeechRecognitionResultEventListener((event) => {
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0].transcript
          setCommand(transcript)
          setIsListening(false)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
      })

      ExpoSpeechRecognition.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
      })
    } catch (error) {
      console.error('Voice input error:', error)
      setIsListening(false)
      setResult('Voice input failed: ' + (error as Error).message)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.surface, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
                What would you like to do?
              </Text>
              <IconButton
                icon="close"
                onPress={() => router.back()}
                style={styles.closeButton}
              />
            </View>

          {/* Command Input */}
          <TextInput
            mode="outlined"
            label="Type your command"
            value={command}
            onChangeText={(text) => {
              setCommand(text)
              setResult(null)
            }}
            multiline
            numberOfLines={3}
            style={styles.input}
            placeholder="e.g., Add task 'Deploy staging' tomorrow at 3pm"
            
          />

          {/* Voice Button */}
          <View style={styles.voiceContainer}>
            <IconButton
              icon={isListening ? "stop-circle" : "microphone"}
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

          {/* Execute Button */}
          <Button
            mode="contained"
            onPress={handleExecute}
            loading={executeCommand.isPending}
            disabled={executeCommand.isPending || !command.trim()}
            style={styles.button}
            icon="send"
          >
            Execute Command
          </Button>

          {/* Result Message */}
          {executeCommand.isPending && (
            <View style={styles.resultContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ marginLeft: 8 }}>
                Processing...
              </Text>
            </View>
          )}

          {result && (
            <View style={[styles.resultContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                ✓ {result}
              </Text>
            </View>
          )}

          {/* Suggestions */}
          <View style={styles.suggestionsContainer}>
            <Text variant="labelLarge" style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
              Try these:
            </Text>
            <View style={styles.chipContainer}>
              {SUGGESTIONS.map((suggestion, index) => (
                <Chip
                  key={index}
                  onPress={() => handleSuggestionPress(suggestion)}
                  style={styles.chip}
                  mode="outlined"
                >
                  {suggestion}
                </Chip>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </Surface>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
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
    marginBottom: 20,
  },
  closeButton: {
    margin: 0,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  input: {
    marginBottom: 16,
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  button: {
    marginTop: 8,
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionsContainer: {
    marginTop: 24,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
})
