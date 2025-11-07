import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Edit2,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  Power,
  ExternalLink
} from 'lucide-react';
import { Box, VStack, HStack } from '../../../styled-system/jsx';
import * as Card from '../../components/ui/styled/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import * as Dialog from '../../components/ui/styled/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { IconButton } from '../../components/ui/icon-button';
import { useSpace } from '../../contexts/SpaceContext';
import type { Habit } from '../../shared/types/calendar';
import { api } from '../../api/client';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

export default function HabitsPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly',
    targetDays: [] as number[],
    reminderTime: '',
    color: '#3b82f6',
    link: ''
  });

  // Fetch habits
  const { data: habits } = useQuery({
    queryKey: ['habits', currentSpace],
    queryFn: async () => {
      const { data, error } = await api.api.habits.get({ query: { space: currentSpace } });
      if (error) throw new Error('Failed to fetch habits');
      return data as Habit[];
    }
  });

  // Fetch stats for all habits
  const { data: habitsStats } = useQuery({
    queryKey: ['habits-stats', currentSpace, habits?.map((h) => h.id)],
    queryFn: async () => {
      if (!habits || habits.length === 0) return [];

      const statsPromises = habits.map(async (habit) => {
        const { data, error } = await api.api.habits({ habitId: habit.id }).stats.get();
        if (error) return { habitId: habit.id, totalCompletions: 0, completionRate: 0 };
        return data;
      });

      return Promise.all(statsPromises);
    },
    enabled: !!habits && habits.length > 0
  });

  // Create habit
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await api.api.habits.post({ ...data, space: currentSpace });
      if (error) throw new Error('Failed to create habit');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', currentSpace] });
      setIsCreateOpen(false);
      resetForm();
    }
  });

  // Update habit
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { data: result, error } = await api.api.habits({ habitId: id }).patch(data);
      if (error) throw new Error('Failed to update habit');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', currentSpace] });
      setEditingHabit(null);
      resetForm();
    }
  });

  // Delete habit
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.habits({ habitId: id }).delete();
      if (error) throw new Error('Failed to delete habit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', currentSpace] });
    }
  });

  // Toggle habit completion (used in Agenda view, not here)
  const _toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.habits({ habitId: id }).log.post({});
      if (error) throw new Error('Failed to log habit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', currentSpace] });
    }
  });

  // Toggle habit active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await api.api.habits({ habitId: id }).patch({ active });
      if (error) throw new Error('Failed to toggle habit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', currentSpace] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      frequency: 'daily',
      targetDays: [],
      reminderTime: '',
      color: '#3b82f6',
      link: ''
    });
  };

  const handleSubmit = () => {
    if (editingHabit) {
      updateMutation.mutate({ id: editingHabit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      description: habit.description || '',
      frequency: habit.frequency === 'custom' ? 'weekly' : habit.frequency,
      targetDays: habit.targetDays || [],
      reminderTime: habit.reminderTime || '',
      color: habit.color || '#3b82f6',
      link: habit.link || ''
    });
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      targetDays: prev.targetDays.includes(day)
        ? prev.targetDays.filter((d) => d !== day)
        : [...prev.targetDays, day]
    }));
  };

  const filteredHabits = habits?.filter((h) => h.space === currentSpace) || [];

  return (
    <Box data-space={currentSpace} p="6">
      <VStack gap="6" alignItems="stretch">
        {/* Header */}
        <HStack justifyContent="space-between">
          <VStack gap="1" alignItems="start">
            <Heading size="2xl">Habits</Heading>
            <Text color="fg.muted">Build consistent routines and track your progress</Text>
          </VStack>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" colorPalette="blue">
            <Plus width="20" height="20" />
            New Habit
          </Button>
        </HStack>

        {/* Summary Stats */}
        {filteredHabits.length > 0 && (
          <HStack
            gap="4"
            borderColor="border.default"
            borderRadius="lg"
            borderWidth="1px"
            p="4"
            bg="bg.subtle"
          >
            <VStack flex="1" gap="1" alignItems="start">
              <Text color="fg.muted" fontSize="sm">
                Active Habits
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {filteredHabits.length}
              </Text>
            </VStack>
            <VStack flex="1" gap="1" alignItems="start">
              <Text color="fg.muted" fontSize="sm">
                Daily Habits
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {filteredHabits.filter((h) => h.frequency === 'daily').length}
              </Text>
            </VStack>
            <VStack flex="1" gap="1" alignItems="start">
              <Text color="fg.muted" fontSize="sm">
                Weekly Habits
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {filteredHabits.filter((h) => h.frequency === 'weekly').length}
              </Text>
            </VStack>
            <VStack flex="1" gap="1" alignItems="start">
              <Text color="fg.muted" fontSize="sm">
                Avg. Streak
              </Text>
              <Text color="green.default" fontSize="2xl" fontWeight="bold">
                {Math.round(
                  filteredHabits.reduce((sum, h) => sum + (h.currentStreak || 0), 0) /
                    filteredHabits.length || 0
                )}{' '}
                days
              </Text>
            </VStack>
          </HStack>
        )}

        {/* Habits Grid */}
        {filteredHabits.length === 0 ? (
          <Card.Root>
            <Card.Body py="12" textAlign="center">
              <VStack gap="4">
                <Target style={{ margin: '0 auto', opacity: 0.5 }} width="48" height="48" />
                <VStack gap="2">
                  <Text fontSize="lg" fontWeight="medium">
                    No habits yet
                  </Text>
                  <Text color="fg.muted">
                    Create your first habit to start building consistent routines
                  </Text>
                </VStack>
                <Button onClick={() => setIsCreateOpen(true)} colorPalette="blue">
                  <Plus width="16" height="16" />
                  Create Habit
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem'
            }}
          >
            {filteredHabits.map((habit) => {
              const habitStats = habitsStats?.find((s) => s.habitId === habit.id);
              return (
                <Card.Root
                  key={habit.id}
                  borderColor={habit.active ? 'border.default' : 'border.subtle'}
                  bg={habit.active ? 'bg.default' : 'bg.muted'}
                  opacity={habit.active ? 1 : 0.5}
                >
                  <Card.Header>
                    <HStack justifyContent="space-between">
                      <Card.Title color={habit.active ? 'fg.default' : 'fg.muted'}>
                        {habit.name}
                      </Card.Title>
                      <HStack gap="1">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void toggleActiveMutation.mutate({
                              id: habit.id,
                              active: !habit.active
                            })
                          }
                          aria-label={habit.active ? 'Disable habit' : 'Enable habit'}
                          colorPalette={habit.active ? 'gray' : 'green'}
                        >
                          <Power width="16" height="16" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(habit)}
                          aria-label="Edit habit"
                        >
                          <Edit2 width="16" height="16" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => void deleteMutation.mutate(habit.id)}
                          aria-label="Delete habit"
                          colorPalette="red"
                        >
                          <Trash2 width="16" height="16" />
                        </IconButton>
                      </HStack>
                    </HStack>
                    {habit.description && <Card.Description>{habit.description}</Card.Description>}
                  </Card.Header>
                  <Card.Body>
                    <VStack gap="4" alignItems="start">
                      {/* Frequency & Schedule */}
                      <HStack gap="3" flexWrap="wrap">
                        <HStack gap="1.5">
                          <Calendar width="16" height="16" color="fg.muted" />
                          <Badge
                            variant="subtle"
                            colorPalette={habit.frequency === 'daily' ? 'blue' : 'purple'}
                          >
                            {habit.frequency === 'daily' ? 'Daily' : 'Weekly'}
                          </Badge>
                        </HStack>
                        {habit.frequency === 'weekly' &&
                          habit.targetDays &&
                          habit.targetDays.length > 0 && (
                            <HStack gap="1" flexWrap="wrap">
                              {habit.targetDays.toSorted().map((day) => (
                                <Badge key={day} size="sm" variant="outline">
                                  {DAYS_OF_WEEK[day].label}
                                </Badge>
                              ))}
                            </HStack>
                          )}
                      </HStack>

                      {/* Reminder Time */}
                      {habit.reminderTime && (
                        <HStack gap="1.5" color="fg.muted" fontSize="sm">
                          <Clock width="14" height="14" />
                          <Text>Reminder at {habit.reminderTime}</Text>
                        </HStack>
                      )}

                      {/* Link */}
                      {habit.link && (
                        <a
                          href={habit.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <HStack gap="1.5" color="blue.default" fontSize="sm">
                            <ExternalLink width="14" height="14" />
                            <Text>Open Link</Text>
                          </HStack>
                        </a>
                      )}

                      {/* Stats Row */}
                      <HStack
                        gap="4"
                        borderColor="border.subtle"
                        borderTop="1px solid"
                        w="full"
                        pt="3"
                      >
                        <VStack flex="1" gap="0.5" alignItems="start">
                          <HStack gap="1">
                            <TrendingUp width="14" height="14" color="green.default" />
                            <Text color="fg.muted" fontSize="xs">
                              Streak
                            </Text>
                          </HStack>
                          <Text color="green.default" fontSize="lg" fontWeight="semibold">
                            {habit.currentStreak || 0} days
                          </Text>
                        </VStack>

                        <VStack flex="1" gap="0.5" alignItems="start">
                          <HStack gap="1">
                            <Award width="14" height="14" color="blue.default" />
                            <Text color="fg.muted" fontSize="xs">
                              Total
                            </Text>
                          </HStack>
                          <Text fontSize="lg" fontWeight="semibold">
                            {habitStats?.totalCompletions || 0} times
                          </Text>
                        </VStack>

                        <VStack flex="1" gap="0.5" alignItems="start">
                          <HStack gap="1">
                            <Target width="14" height="14" color="purple.default" />
                            <Text color="fg.muted" fontSize="xs">
                              Rate
                            </Text>
                          </HStack>
                          <Text fontSize="lg" fontWeight="semibold">
                            {habitStats?.completionRate || 0}%
                          </Text>
                        </VStack>
                      </HStack>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog.Root
          open={isCreateOpen || editingHabit !== null}
          onOpenChange={(details) => {
            if (!details.open) {
              setIsCreateOpen(false);
              setEditingHabit(null);
              resetForm();
            }
          }}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="lg">
              <VStack gap="6" p="6">
                <VStack gap="1">
                  <Dialog.Title>{editingHabit ? 'Edit Habit' : 'Create Habit'}</Dialog.Title>
                  <Dialog.Description>
                    {editingHabit ? 'Update your habit details' : 'Add a new habit to track'}
                  </Dialog.Description>
                </VStack>

                <VStack gap="4" width="100%">
                  <Box width="100%">
                    <label
                      htmlFor="habit-name"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Name
                    </label>
                    <Input
                      id="habit-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Morning Exercise"
                    />
                  </Box>

                  <Box width="100%">
                    <label
                      htmlFor="habit-description"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Description (optional)
                    </label>
                    <Textarea
                      id="habit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Add details about this habit..."
                      rows={3}
                    />
                  </Box>

                  <Box width="100%">
                    <label
                      htmlFor="frequency-selector"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Frequency
                    </label>
                    <HStack gap="2">
                      <Button
                        variant={formData.frequency === 'daily' ? 'solid' : 'outline'}
                        onClick={() =>
                          setFormData({ ...formData, frequency: 'daily', targetDays: [] })
                        }
                        flex="1"
                      >
                        Daily
                      </Button>
                      <Button
                        variant={formData.frequency === 'weekly' ? 'solid' : 'outline'}
                        onClick={() => setFormData({ ...formData, frequency: 'weekly' })}
                        flex="1"
                      >
                        Weekly
                      </Button>
                    </HStack>
                  </Box>

                  {formData.frequency === 'weekly' && (
                    <Box width="100%">
                      <label
                        htmlFor="target-days"
                        style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Target Days
                      </label>
                      <HStack gap="2" flexWrap="wrap">
                        {DAYS_OF_WEEK.map((day) => (
                          <Button
                            key={day.value}
                            size="sm"
                            variant={formData.targetDays.includes(day.value) ? 'solid' : 'outline'}
                            onClick={() => toggleDay(day.value)}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </HStack>
                    </Box>
                  )}

                  <Box width="100%">
                    <label
                      htmlFor="reminder-time"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Reminder Time (optional)
                    </label>
                    <Input
                      id="reminder-time"
                      type="time"
                      value={formData.reminderTime}
                      onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                      placeholder="Select time"
                    />
                    <Text mt="1" color="fg.muted" fontSize="xs">
                      Get a notification at this time each day
                    </Text>
                  </Box>

                  <Box width="100%">
                    <label
                      htmlFor="habit-link"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Link (optional)
                    </label>
                    <Input
                      id="habit-link"
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      placeholder="https://example.com"
                    />
                    <Text mt="1" color="fg.muted" fontSize="xs">
                      Add a related link or resource
                    </Text>
                  </Box>
                </VStack>

                <HStack gap="2" justifyContent="flex-end" width="100%">
                  <Dialog.CloseTrigger asChild>
                    <Button variant="outline">Cancel</Button>
                  </Dialog.CloseTrigger>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !formData.name.trim() ||
                      (formData.frequency === 'weekly' && formData.targetDays.length === 0)
                    }
                    colorPalette="blue"
                  >
                    {editingHabit ? 'Update' : 'Create'}
                  </Button>
                </HStack>
              </VStack>
              <Dialog.CloseTrigger asChild position="absolute" top="2" right="2">
                <IconButton aria-label="Close" variant="ghost" size="sm">
                  <span>×</span>
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </VStack>
    </Box>
  );
}
