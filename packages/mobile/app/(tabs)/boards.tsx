import { View, StyleSheet } from 'react-native'
import { Surface, Text, useTheme } from 'react-native-paper'

export default function BoardsScreen() {
  const theme = useTheme()

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineMedium">Boards</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          Your Kanban boards will appear here
        </Text>
      </View>
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
