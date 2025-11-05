import { useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native'
import { Surface, Text, FAB, useTheme, IconButton } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { format, addDays, subDays } from 'date-fns'
import { useAgendaTasks } from '@/hooks/useAgendaTasks'
import { TaskCard } from '@/components/TaskCard'
import { useSpaceStore } from '@/store/spaceStore'

export default function AgendaScreen() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const theme = useTheme()
  const router = useRouter()
  const currentSpace = useSpaceStore((state) => state.currentSpace)
  const { data: tasks, isLoading, refetch, error } = useAgendaTasks(view, selectedDate)

  console.log('[AgendaScreen] Render:', {
    view,
    currentSpace,
    tasksCount: tasks?.length || 0,
    isLoading,
    hasError: !!error,
    error: error?.message
  })

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with date and view toggle */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineMedium" style={[styles.dateText, { color: theme.colors.onBackground, fontWeight: '700' }]}>
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
                view === 'day' && [styles.activeViewButton, { backgroundColor: theme.colors.primary }]
              ]}
              onPress={() => setView('day')}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  {
                    color: view === 'day' ? '#000' : theme.colors.onSurfaceVariant,
                    fontWeight: view === 'day' ? '700' : '500',
                    fontSize: 12,
                  }
                ]}
              >
                Day
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewButton,
                view === 'week' && [styles.activeViewButton, { backgroundColor: theme.colors.primary }]
              ]}
              onPress={() => setView('week')}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  {
                    color: view === 'week' ? '#000' : theme.colors.onSurfaceVariant,
                    fontWeight: view === 'week' ? '700' : '500',
                    fontSize: 12,
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
              <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600', fontSize: 12 }}>
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
            />
          }
        >
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  headerTop: {
    gap: 4,
  },
  dateText: {
    marginBottom: 0,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateButton: {
    margin: 0,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeViewButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  viewButtonText: {
    // Remove textTransform and letterSpacing to prevent clipping
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 90,
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
})
