import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Surface, Text, FAB, SegmentedButtons, useTheme } from 'react-native-paper'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useAgendaTasks } from '@/hooks/useAgendaTasks'
import { TaskCard } from '@/components/TaskCard'
import { SpaceSwitcher } from '@/components/SpaceSwitcher'

export default function AgendaScreen() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const theme = useTheme()
  const router = useRouter()
  const { data: tasks, isLoading, refetch } = useAgendaTasks(view)

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Space switcher */}
      <SpaceSwitcher />

      {/* Header with date and view toggle */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.dateText}>
          {format(new Date(), 'EEEE, MMMM d')}
        </Text>
        <SegmentedButtons
          value={view}
          onValueChange={(value) => setView(value as 'day' | 'week')}
          buttons={[
            {
              value: 'day',
              label: 'Day',
              icon: 'calendar-today',
            },
            {
              value: 'week',
              label: 'Week',
              icon: 'calendar-week',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Task list */}
      {!tasks || tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {isLoading ? 'Loading...' : 'No tasks for today'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Tap + to add a new task
          </Text>
        </View>
      ) : (
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskCard task={item} />}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/modal/command')}
      />
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    gap: 12,
  },
  dateText: {
    marginBottom: 4,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 80, // Space for FAB
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
})
