import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Moon,
  Keyboard,
  Download,
  Upload,
  Sunrise,
  Sunset,
  Calendar,
  Key,
  Trash2,
  Copy,
  X,
  CalendarPlus,
  Plus,
  Pencil,
  FileText
} from 'lucide-react';
import { Box, VStack, HStack, Center } from '../../../styled-system/jsx';
import * as Card from '../../components/ui/styled/card';
import * as Fieldset from '../../components/ui/styled/fieldset';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { Switch } from '../../components/ui/switch';
import { Spinner } from '../../components/ui/spinner';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { Input } from '../../components/ui/input';
import * as Dialog from '../../components/ui/styled/dialog';
import * as RadioButtonGroup from '../../components/ui/styled/radio-button-group';
import * as Select from '../../components/ui/styled/select';
import { createListCollection } from '../../components/ui/select';
import { Portal } from '@ark-ui/react/portal';
import { FormLabel } from '../../components/ui/form-label';
import { IconButton } from '../../components/ui/icon-button';
import { useState } from 'react';
import { api } from '../../api/client';

interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  defaultSpace: 'work' | 'personal';
  pomodoroSettings: {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
  };
  notifications: {
    enabled: boolean;
    reminders: boolean;
    pomodoroComplete: boolean;
    taskDue: boolean;
    morningSummary: boolean;
    eveningSummary: boolean;
    summarySpaces: ('work' | 'personal')[];
  };
  integrations: {
    hambot: boolean;
    github: boolean;
    slack: boolean;
  };
  outlineApiUrl?: string;
  outlineApiKey?: string;
  outlineCollectionId?: string;
}

interface ApiToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ExternalCalendar {
  id: string;
  name: string;
  icalUrl: string;
  space: 'work' | 'personal';
  color: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OutlineCollection {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // External calendars state
  const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarUrl, setNewCalendarUrl] = useState('');
  const [newCalendarSpace, setNewCalendarSpace] = useState<'work' | 'personal'>('work');
  const [newCalendarColor, setNewCalendarColor] = useState('blue');
  const [editingCalendar, setEditingCalendar] = useState<ExternalCalendar | null>(null);
  const [isEditCalendarOpen, setIsEditCalendarOpen] = useState(false);

  // Outline settings state
  const [outlineApiUrl, setOutlineApiUrl] = useState('');
  const [outlineApiKey, setOutlineApiKey] = useState('');
  const [outlineCollectionId, setOutlineCollectionId] = useState('');

  // Space options for Select component
  const spaceOptions = createListCollection({
    items: [
      { label: 'Work', value: 'work' },
      { label: 'Personal', value: 'personal' }
    ]
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await api.api.settings.get();
      if (error) throw new Error('Failed to fetch settings');

      const typedData = data as unknown as UserSettings;

      // Initialize Outline settings
      if (typedData.outlineApiUrl) setOutlineApiUrl(typedData.outlineApiUrl);
      if (typedData.outlineApiKey) setOutlineApiKey(typedData.outlineApiKey);
      if (typedData.outlineCollectionId) setOutlineCollectionId(typedData.outlineCollectionId);

      return typedData;
    }
  });

  // Fetch Outline collections (only when configured)
  const { data: outlineCollections, isLoading: collectionsLoading } = useQuery<OutlineCollection[]>(
    {
      queryKey: ['outline-collections', settings?.outlineApiUrl, settings?.outlineApiKey],
      queryFn: async () => {
        const { data, error } = await api.api.notes.collections.get();
        if (error) return [];
        const result = data as { data?: OutlineCollection[] };
        return result.data || [];
      },
      enabled: !!(settings?.outlineApiUrl && settings?.outlineApiKey)
    }
  );

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      const { data, error } = await api.api.settings.patch(newSettings);
      if (error) throw new Error('Failed to update settings');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'enabled'] });
      toast?.('Settings updated successfully', {
        title: 'Success',
        type: 'success'
      });
    },
    onError: () => {
      toast?.('Failed to update settings', {
        title: 'Error',
        type: 'error'
      });
    }
  });

  // Fetch iCal feed URL
  const { data: calendarFeed } = useQuery<{ url: string; instructions: string }>({
    queryKey: ['calendar-feed'],
    queryFn: async () => {
      const { data, error } = await api.api.calendar['feed-url'].get();
      if (error) throw new Error('Failed to fetch calendar feed URL');
      return data as { url: string; instructions: string };
    }
  });

  // Fetch API tokens
  const { data: apiTokens = [], isLoading: isLoadingTokens } = useQuery<ApiToken[]>({
    queryKey: ['api-tokens'],
    queryFn: async () => {
      const { data, error } = await api.api['api-tokens'].get();
      if (error) throw new Error('Failed to fetch API tokens');
      return data as unknown as ApiToken[];
    }
  });

  // Create API token
  const createApiToken = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await api.api['api-tokens'].post({ name });
      if (error) throw new Error('Failed to create API token');
      return data as { token: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      setCreatedToken(data.token);
      setIsCreateTokenOpen(false);
      setNewTokenName('');
      toast?.("API token created successfully. Copy it now - you won't see it again!", {
        title: 'Token Created',
        type: 'success',
        duration: 8000
      });
    },
    onError: () => {
      toast?.('Failed to create API token', {
        title: 'Error',
        type: 'error'
      });
    }
  });

  // Delete API token
  const deleteApiToken = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api['api-tokens']({ id }).delete();
      if (error) throw new Error('Failed to delete API token');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast?.('API token deleted successfully', {
        title: 'Token Deleted',
        type: 'success'
      });
    },
    onError: () => {
      toast?.('Failed to delete API token', {
        title: 'Error',
        type: 'error'
      });
    }
  });

  // Test HamBot integration (actually sends via HamBot)
  const testSummary = useMutation({
    mutationFn: async ({ type }: { type: 'morning' | 'evening' }) => {
      if (!settings) throw new Error('Settings not loaded');

      const { data, error } = await api.api.settings['test-summary'].post({
        type,
        spaces: settings.notifications.summarySpaces
      } as any);
      if (error) {
        const errorVal = error.value as any;
        throw new Error(errorVal?.error || 'Failed to send via HamBot');
      }
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast?.(data.message, {
        title: 'HamBot Message Sent',
        type: 'success',
        duration: 5000
      });
    },
    onError: (error) => {
      toast?.(error.message, {
        title: 'HamBot Test Failed',
        type: 'error'
      });
    }
  });

  // Fetch external calendars
  const { data: externalCalendars } = useQuery<ExternalCalendar[]>({
    queryKey: ['external-calendars'],
    queryFn: async () => {
      const { data, error } = await (api.api['external-calendars'] as any).get();
      if (error) throw new Error('Failed to fetch external calendars');
      return data as any as ExternalCalendar[];
    }
  });

  // Add external calendar
  const addExternalCalendar = useMutation({
    mutationFn: async (calendar: {
      name: string;
      icalUrl: string;
      space: 'work' | 'personal';
      color: string;
    }) => {
      const { data, error } = await (api.api['external-calendars'] as any).post(calendar);
      if (error) {
        const errorVal = error.value as any;
        throw new Error(errorVal?.error || 'Failed to add calendar');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setIsAddCalendarOpen(false);
      setNewCalendarName('');
      setNewCalendarUrl('');
      setNewCalendarSpace('work');
      setNewCalendarColor('blue');
      toast?.('Calendar added successfully', {
        title: 'Success',
        type: 'success'
      });
    },
    onError: (error) => {
      toast?.(error.message, {
        title: 'Error',
        type: 'error'
      });
    }
  });

  // Toggle external calendar enabled
  const toggleExternalCalendar = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await (api.api['external-calendars'] as any)({ id }).patch({
        enabled
      });
      if (error) throw new Error('Failed to update calendar');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    }
  });

  // Update external calendar
  const updateExternalCalendar = useMutation({
    mutationFn: async ({
      id,
      data: updateData
    }: {
      id: string;
      data: {
        name?: string;
        icalUrl?: string;
        space?: 'work' | 'personal';
        color?: string;
      };
    }) => {
      const { data, error } = await (api.api['external-calendars'] as any)({ id }).patch(
        updateData
      );
      if (error) {
        const errorVal = error.value as any;
        throw new Error(errorVal?.error || 'Failed to update calendar');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setIsEditCalendarOpen(false);
      setEditingCalendar(null);
      toast?.('Calendar updated successfully', {
        title: 'Success',
        type: 'success'
      });
    },
    onError: (error) => {
      toast?.(error.message, {
        title: 'Error',
        type: 'error'
      });
    }
  });

  // Delete external calendar
  const deleteExternalCalendar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (api.api['external-calendars'] as any)({ id }).delete();
      if (error) throw new Error('Failed to delete calendar');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendars'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast?.('Calendar deleted successfully', {
        title: 'Success',
        type: 'success'
      });
    },
    onError: () => {
      toast?.('Failed to delete calendar', {
        title: 'Error',
        type: 'error'
      });
    }
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast?.('Calendar URL copied to clipboard', {
        title: 'Copied!',
        type: 'success',
        duration: 3000
      });
    } catch {
      toast?.('Failed to copy to clipboard', {
        title: 'Error',
        type: 'error'
      });
    }
  };

  const handleToggle = (path: string[], value: boolean | ('work' | 'personal')[]) => {
    if (!settings) return;

    const newSettings = { ...settings };
    let current: any = newSettings;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;

    updateSettings.mutate(newSettings);
  };

  if (isLoading || !settings) {
    return (
      <Center minH="50vh">
        <VStack gap="4">
          <Spinner size="xl" />
          <Text color="fg.muted">Loading settings...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box data-space={currentSpace} minH="full">
      <VStack gap="6" alignItems="stretch">
        {/* Header */}
        <Box>
          <Heading size="2xl" mb="2">
            Settings
          </Heading>
          <Text color="fg.muted">Manage your preferences and notifications</Text>
        </Box>

        {/* Notifications Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <Bell width="20" height="20" />
              <Heading size="lg">Notifications</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="6" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>General Notifications</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    Configure how you want to receive notifications
                  </Fieldset.HelperText>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <Text color="fg.muted" fontWeight="medium">
                        Enable notifications
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        Receive in-app notifications (Coming soon)
                      </Text>
                    </VStack>
                    <Switch checked={settings.notifications.enabled} disabled />
                  </HStack>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <Text color="fg.muted" fontWeight="medium">
                        Task reminders
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        Get notified before tasks are due (Coming soon)
                      </Text>
                    </VStack>
                    <Switch checked={settings.notifications.reminders} disabled />
                  </HStack>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <Text color="fg.muted" fontWeight="medium">
                        Pomodoro complete
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        Notify when a Pomodoro session ends (Coming soon)
                      </Text>
                    </VStack>
                    <Switch checked={settings.notifications.pomodoroComplete} disabled />
                  </HStack>
                </VStack>
              </Fieldset.Root>

              <Fieldset.Root>
                <Fieldset.Legend>Daily Summaries (HamBot)</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    Receive automated daily summaries via HamBot
                  </Fieldset.HelperText>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <HStack gap="2">
                        <Sunrise width="16" height="16" color="fg.muted" />
                        <Text fontWeight="medium">Morning summary</Text>
                      </HStack>
                      <Text color="fg.muted" fontSize="sm">
                        Daily agenda at 10:00 AM (JST)
                      </Text>
                    </VStack>
                    <Switch
                      checked={settings.notifications.morningSummary}
                      onCheckedChange={(e) =>
                        handleToggle(['notifications', 'morningSummary'], e.checked)
                      }
                    />
                  </HStack>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <HStack gap="2">
                        <Sunset width="16" height="16" color="fg.muted" />
                        <Text fontWeight="medium">Evening summary</Text>
                      </HStack>
                      <Text color="fg.muted" fontSize="sm">
                        Daily recap at 10:00 PM (JST)
                      </Text>
                    </VStack>
                    <Switch
                      checked={settings.notifications.eveningSummary}
                      onCheckedChange={(e) =>
                        handleToggle(['notifications', 'eveningSummary'], e.checked)
                      }
                    />
                  </HStack>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <Text fontWeight="medium">Summary spaces</Text>
                      <Text color="fg.muted" fontSize="sm">
                        Choose which spaces to include in summaries
                      </Text>
                    </VStack>
                    <HStack gap="2">
                      <Button
                        variant={
                          settings.notifications.summarySpaces.includes('work')
                            ? 'solid'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          const newSpaces = settings.notifications.summarySpaces.includes('work')
                            ? settings.notifications.summarySpaces.filter((s) => s !== 'work')
                            : [...settings.notifications.summarySpaces, 'work'];
                          if (newSpaces.length > 0) {
                            handleToggle(
                              ['notifications', 'summarySpaces'],
                              newSpaces as ('work' | 'personal')[]
                            );
                          }
                        }}
                      >
                        💼 Work
                      </Button>
                      <Button
                        variant={
                          settings.notifications.summarySpaces.includes('personal')
                            ? 'solid'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          const newSpaces = settings.notifications.summarySpaces.includes(
                            'personal'
                          )
                            ? settings.notifications.summarySpaces.filter((s) => s !== 'personal')
                            : [...settings.notifications.summarySpaces, 'personal'];
                          if (newSpaces.length > 0) {
                            handleToggle(
                              ['notifications', 'summarySpaces'],
                              newSpaces as ('work' | 'personal')[]
                            );
                          }
                        }}
                      >
                        🏠 Personal
                      </Button>
                    </HStack>
                  </HStack>

                  <HStack justifyContent="space-between">
                    <VStack gap="1" alignItems="start">
                      <Text color="fg.muted" fontWeight="medium">
                        Test summary generation
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        Send test summary via HamBot
                      </Text>
                    </VStack>
                    <HStack gap="2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testSummary.mutate({ type: 'morning' })}
                        disabled={testSummary.isPending}
                      >
                        <Sunrise width="16" height="16" />
                        Morning
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testSummary.mutate({ type: 'evening' })}
                        disabled={testSummary.isPending}
                      >
                        <Sunset width="16" height="16" />
                        Evening
                      </Button>
                    </HStack>
                  </HStack>
                </VStack>
              </Fieldset.Root>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Calendar Integration Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <Calendar width="20" height="20" />
              <Heading size="lg">Calendar Integration</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>iCal Subscription</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    Subscribe to your HamFlow tasks in any calendar app (Google Calendar, Apple
                    Calendar, Outlook, etc.)
                  </Fieldset.HelperText>

                  {calendarFeed && (
                    <>
                      <VStack gap="2" alignItems="stretch">
                        <Text fontSize="sm" fontWeight="medium">
                          Your Calendar Feed URL:
                        </Text>
                        <HStack gap="2">
                          <Input
                            value={calendarFeed.url}
                            readOnly
                            onClick={(e) => e.currentTarget.select()}
                            fontFamily="mono"
                            fontSize="sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void copyToClipboard(calendarFeed.url);
                            }}
                          >
                            Copy
                          </Button>
                        </HStack>
                      </VStack>

                      <VStack gap="2" alignItems="start">
                        <Text fontSize="sm" fontWeight="medium">
                          How to use:
                        </Text>
                        <VStack gap="1" alignItems="start" color="fg.muted" fontSize="sm">
                          <Text>• Copy the URL above</Text>
                          <Text>
                            • In your calendar app, find &quot;Add calendar by URL&quot; or
                            &quot;Subscribe to calendar&quot;
                          </Text>
                          <Text>• Paste the URL and save</Text>
                          <Text>
                            • Your tasks will sync automatically (updates may take a few minutes)
                          </Text>
                        </VStack>
                      </VStack>
                    </>
                  )}
                </VStack>
              </Fieldset.Root>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* External Calendars Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <CalendarPlus width="20" height="20" />
              <Heading size="lg">External Calendars</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>Subscriptions</Fieldset.Legend>
                <Fieldset.HelperText>
                  Subscribe to external iCal feeds (Google Calendar, Outlook, etc.) to view events
                  in your agenda.
                </Fieldset.HelperText>

                {/* List of calendars */}
                <VStack gap="3" mt="4" alignItems="stretch">
                  {externalCalendars && externalCalendars.length > 0 ? (
                    externalCalendars.map((calendar) => (
                      <HStack
                        key={calendar.id}
                        justify="space-between"
                        p="3"
                        borderWidth="1px"
                        borderRadius="l2"
                        borderColor="border.default"
                      >
                        <HStack gap="3" flex="1">
                          <Box
                            data-calendar-color={calendar.color}
                            w="3"
                            h="3"
                            borderRadius="full"
                            bg="colorPalette.default"
                          />
                          <VStack gap="1" alignItems="flex-start">
                            <Text fontWeight="semibold">{calendar.name}</Text>
                            <Text fontSize="xs" color="fg.muted">
                              {calendar.space}
                            </Text>
                          </VStack>
                        </HStack>
                        <HStack gap="2">
                          <Switch
                            checked={calendar.enabled}
                            onCheckedChange={(e) =>
                              toggleExternalCalendar.mutate({ id: calendar.id, enabled: e.checked })
                            }
                          />
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCalendar(calendar);
                              setIsEditCalendarOpen(true);
                            }}
                          >
                            <Pencil width="16" height="16" />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteExternalCalendar.mutate(calendar.id)}
                          >
                            <Trash2 width="16" height="16" />
                          </IconButton>
                        </HStack>
                      </HStack>
                    ))
                  ) : (
                    <Text fontSize="sm" color="fg.muted">
                      No external calendars added yet.
                    </Text>
                  )}
                </VStack>

                {/* Add Calendar Dialog */}
                <Dialog.Root
                  open={isAddCalendarOpen}
                  onOpenChange={(e) => setIsAddCalendarOpen(e.open)}
                >
                  <Dialog.Trigger asChild>
                    <Button mt="4">
                      <Plus width="16" height="16" />
                      Add Calendar
                    </Button>
                  </Dialog.Trigger>
                  <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                      <Dialog.Content maxW="md">
                        <VStack gap="4" p="6" alignItems="stretch">
                          <Dialog.Title>Add External Calendar</Dialog.Title>
                          <Dialog.Description>
                            Subscribe to an iCal feed from Google Calendar, Outlook, or any .ics
                            URL.
                          </Dialog.Description>

                          {/* Form fields */}
                          <Box>
                            <FormLabel>Calendar Name</FormLabel>
                            <Input
                              placeholder="Work Calendar"
                              value={newCalendarName}
                              onChange={(e) => setNewCalendarName(e.target.value)}
                            />
                          </Box>

                          <Box>
                            <FormLabel>iCal URL</FormLabel>
                            <Input
                              placeholder="https://calendar.google.com/..."
                              value={newCalendarUrl}
                              onChange={(e) => setNewCalendarUrl(e.target.value)}
                            />
                            <Text fontSize="xs" color="fg.muted" mt="1">
                              Paste the public iCal subscription URL
                            </Text>
                          </Box>

                          <Box>
                            <FormLabel>Space</FormLabel>
                            <Select.Root
                              collection={spaceOptions}
                              value={[newCalendarSpace]}
                              onValueChange={(details) =>
                                setNewCalendarSpace(details.value[0] as 'work' | 'personal')
                              }
                              positioning={{ sameWidth: true }}
                              size="md"
                            >
                              <Select.Trigger>
                                <Select.ValueText placeholder="Select space" />
                              </Select.Trigger>
                              <Portal>
                                <Select.Positioner>
                                  <Select.Content>
                                    {spaceOptions.items.map((item) => (
                                      <Select.Item key={item.value} item={item}>
                                        <Select.ItemText>{item.label}</Select.ItemText>
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select.Positioner>
                              </Portal>
                            </Select.Root>
                          </Box>

                          <Box>
                            <FormLabel>Color</FormLabel>
                            <RadioButtonGroup.Root
                              value={newCalendarColor}
                              onValueChange={(e) => e.value && setNewCalendarColor(e.value)}
                            >
                              <HStack gap="2" flexWrap="wrap">
                                {[
                                  'blue',
                                  'green',
                                  'purple',
                                  'orange',
                                  'red',
                                  'pink',
                                  'teal',
                                  'cyan'
                                ].map((c) => (
                                  <RadioButtonGroup.Item key={c} value={c}>
                                    <RadioButtonGroup.ItemControl />
                                    <RadioButtonGroup.ItemHiddenInput />
                                    <RadioButtonGroup.ItemText>
                                      <Box data-calendar-color={c}>
                                        <Box
                                          w="6"
                                          h="6"
                                          borderRadius="full"
                                          bg="colorPalette.emphasized"
                                        />
                                      </Box>
                                    </RadioButtonGroup.ItemText>
                                  </RadioButtonGroup.Item>
                                ))}
                              </HStack>
                            </RadioButtonGroup.Root>
                          </Box>

                          <HStack gap="3" justify="flex-end" mt="2">
                            <Dialog.CloseTrigger asChild>
                              <Button variant="outline">Cancel</Button>
                            </Dialog.CloseTrigger>
                            <Button
                              onClick={() =>
                                addExternalCalendar.mutate({
                                  name: newCalendarName,
                                  icalUrl: newCalendarUrl,
                                  space: newCalendarSpace,
                                  color: newCalendarColor
                                })
                              }
                              loading={addExternalCalendar.isPending}
                              disabled={!newCalendarName || !newCalendarUrl}
                            >
                              Add Calendar
                            </Button>
                          </HStack>
                        </VStack>
                      </Dialog.Content>
                    </Dialog.Positioner>
                  </Portal>
                </Dialog.Root>

                {/* Edit Calendar Dialog */}
                <Dialog.Root
                  open={isEditCalendarOpen}
                  onOpenChange={(e) => setIsEditCalendarOpen(e.open)}
                >
                  <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                      <Dialog.Content maxW="md">
                        <VStack gap="4" p="6" alignItems="stretch">
                          <Dialog.Title>Edit External Calendar</Dialog.Title>
                          <Dialog.Description>
                            Update your external calendar subscription settings.
                          </Dialog.Description>

                          {/* Form fields */}
                          <Box>
                            <FormLabel>Calendar Name</FormLabel>
                            <Input
                              placeholder="Work Calendar"
                              value={editingCalendar?.name || ''}
                              onChange={(e) =>
                                setEditingCalendar((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                            />
                          </Box>

                          <Box>
                            <FormLabel>iCal URL</FormLabel>
                            <Input
                              placeholder="https://calendar.google.com/..."
                              value={editingCalendar?.icalUrl || ''}
                              onChange={(e) =>
                                setEditingCalendar((prev) =>
                                  prev ? { ...prev, icalUrl: e.target.value } : prev
                                )
                              }
                            />
                            <Text fontSize="xs" color="fg.muted" mt="1">
                              Paste the public iCal subscription URL
                            </Text>
                          </Box>

                          <Box>
                            <FormLabel>Space</FormLabel>
                            <Select.Root
                              collection={spaceOptions}
                              value={[editingCalendar?.space || 'work']}
                              onValueChange={(details) =>
                                setEditingCalendar((prev) =>
                                  prev
                                    ? { ...prev, space: details.value[0] as 'work' | 'personal' }
                                    : prev
                                )
                              }
                              positioning={{ sameWidth: true }}
                              size="md"
                            >
                              <Select.Trigger>
                                <Select.ValueText placeholder="Select space" />
                              </Select.Trigger>
                              <Portal>
                                <Select.Positioner>
                                  <Select.Content>
                                    {spaceOptions.items.map((item) => (
                                      <Select.Item key={item.value} item={item}>
                                        <Select.ItemText>{item.label}</Select.ItemText>
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select.Positioner>
                              </Portal>
                            </Select.Root>
                          </Box>

                          <Box>
                            <FormLabel>Color</FormLabel>
                            <RadioButtonGroup.Root
                              value={editingCalendar?.color || 'blue'}
                              onValueChange={(e) =>
                                e.value &&
                                setEditingCalendar((prev) =>
                                  prev ? { ...prev, color: e.value as string } : prev
                                )
                              }
                            >
                              <HStack gap="2" flexWrap="wrap">
                                {[
                                  'blue',
                                  'green',
                                  'purple',
                                  'orange',
                                  'red',
                                  'pink',
                                  'teal',
                                  'cyan'
                                ].map((c) => (
                                  <RadioButtonGroup.Item key={c} value={c}>
                                    <RadioButtonGroup.ItemControl />
                                    <RadioButtonGroup.ItemHiddenInput />
                                    <RadioButtonGroup.ItemText>
                                      <Box data-calendar-color={c}>
                                        <Box
                                          w="6"
                                          h="6"
                                          borderRadius="full"
                                          bg="colorPalette.emphasized"
                                        />
                                      </Box>
                                    </RadioButtonGroup.ItemText>
                                  </RadioButtonGroup.Item>
                                ))}
                              </HStack>
                            </RadioButtonGroup.Root>
                          </Box>

                          <HStack gap="3" justify="flex-end" mt="2">
                            <Dialog.CloseTrigger asChild>
                              <Button variant="outline">Cancel</Button>
                            </Dialog.CloseTrigger>
                            <Button
                              onClick={() => {
                                if (editingCalendar) {
                                  updateExternalCalendar.mutate({
                                    id: editingCalendar.id,
                                    data: {
                                      name: editingCalendar.name,
                                      icalUrl: editingCalendar.icalUrl,
                                      space: editingCalendar.space,
                                      color: editingCalendar.color
                                    }
                                  });
                                }
                              }}
                              loading={updateExternalCalendar.isPending}
                              disabled={!editingCalendar?.name || !editingCalendar?.icalUrl}
                            >
                              Update Calendar
                            </Button>
                          </HStack>
                        </VStack>
                      </Dialog.Content>
                    </Dialog.Positioner>
                  </Portal>
                </Dialog.Root>
              </Fieldset.Root>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* API Tokens Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2" justifyContent="space-between">
              <HStack gap="2">
                <Key width="20" height="20" />
                <Heading size="lg">API Tokens</Heading>
              </HStack>
              <Dialog.Root
                open={isCreateTokenOpen}
                onOpenChange={(e) => setIsCreateTokenOpen(e.open)}
              >
                <Dialog.Trigger asChild>
                  <Button size="sm" variant="outline">
                    Create Token
                  </Button>
                </Dialog.Trigger>
                <Portal>
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                      <VStack gap="6" p="6">
                        <VStack gap="1" alignItems="start">
                          <Dialog.Title>Create API Token</Dialog.Title>
                          <Dialog.Description>
                            Create a new API token for external integrations like Raycast.
                          </Dialog.Description>
                        </VStack>

                        <Box width="100%">
                          <FormLabel htmlFor="token-name">Token Name</FormLabel>
                          <Input
                            id="token-name"
                            placeholder="My Raycast Extension"
                            value={newTokenName}
                            onChange={(e) => setNewTokenName(e.target.value)}
                          />
                        </Box>

                        <HStack gap="2" justifyContent="flex-end" width="100%">
                          <Dialog.CloseTrigger asChild>
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          </Dialog.CloseTrigger>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newTokenName.trim()) {
                                createApiToken.mutate(newTokenName.trim());
                              }
                            }}
                            disabled={!newTokenName.trim() || createApiToken.isPending}
                          >
                            {createApiToken.isPending ? 'Creating...' : 'Create Token'}
                          </Button>
                        </HStack>
                      </VStack>

                      <Dialog.CloseTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          position="absolute"
                          top="2"
                          right="2"
                          aria-label="Close"
                        >
                          <X width="16" height="16" />
                        </Button>
                      </Dialog.CloseTrigger>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Portal>
              </Dialog.Root>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>Active Tokens</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    API tokens allow external applications to access your HamFlow data. Keep them
                    secure!
                  </Fieldset.HelperText>

                  {isLoadingTokens ? (
                    <Center py="4">
                      <Spinner size="sm" />
                    </Center>
                  ) : apiTokens.length === 0 ? (
                    <Text color="fg.muted" fontSize="sm" textAlign="center" py="4">
                      No API tokens yet. Create one to get started with external integrations.
                    </Text>
                  ) : (
                    <VStack gap="3" alignItems="stretch">
                      {apiTokens.map((token) => (
                        <HStack
                          key={token.id}
                          p="3"
                          borderWidth="1px"
                          borderRadius="md"
                          justifyContent="space-between"
                        >
                          <VStack gap="1" alignItems="start">
                            <Text fontWeight="medium">{token.name}</Text>
                            <Text fontSize="xs" color="fg.muted">
                              Created: {new Date(token.createdAt).toLocaleDateString()}
                              {token.lastUsedAt &&
                                ` • Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                            </Text>
                          </VStack>
                          <Button
                            variant="ghost"
                            size="sm"
                            colorPalette="red"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete "${token.name}"? This cannot be undone.`
                                )
                              ) {
                                deleteApiToken.mutate(token.id);
                              }
                            }}
                          >
                            <Trash2 width="16" height="16" />
                          </Button>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Fieldset.Root>

              {/* Show newly created token */}
              {createdToken && (
                <Box
                  p="4"
                  borderWidth="1px"
                  borderRadius="l2"
                  borderColor="border.emphasized"
                  bg="bg.emphasized"
                >
                  <VStack gap="3" alignItems="stretch">
                    <HStack gap="2" justifyContent="space-between">
                      <HStack gap="2">
                        <Key width="16" height="16" />
                        <Text fontWeight="semibold">Your new API token</Text>
                      </HStack>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreatedToken(null)}
                        aria-label="Close"
                      >
                        <X width="16" height="16" />
                      </Button>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                      Copy this token now - it won't be shown again for security reasons.
                    </Text>
                    <HStack gap="2">
                      <Input
                        value={createdToken}
                        readOnly
                        onClick={(e) => e.currentTarget.select()}
                        fontFamily="mono"
                        fontSize="sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          void copyToClipboard(createdToken);
                        }}
                      >
                        <Copy width="16" height="16" />
                        Copy
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Outline Integration Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <FileText width="20" height="20" />
              <Heading size="lg">Outline Integration</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>Note-Taking Integration</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    Connect your Outline instance to link tasks with detailed notes and
                    documentation.
                  </Fieldset.HelperText>

                  <Box>
                    <FormLabel>Outline API URL</FormLabel>
                    <Input
                      placeholder="https://app.getoutline.com or https://your-instance.com"
                      value={outlineApiUrl}
                      onChange={(e) => setOutlineApiUrl(e.target.value)}
                    />
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Your Outline instance URL (e.g., https://app.getoutline.com or
                      https://outline.yourdomain.com). The /api path will be added automatically.
                    </Text>
                  </Box>

                  <Box>
                    <FormLabel>API Key</FormLabel>
                    <Input
                      type="password"
                      placeholder="Enter your Outline API key"
                      value={outlineApiKey}
                      onChange={(e) => setOutlineApiKey(e.target.value)}
                    />
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Get your API key from Outline Settings → API & Apps
                    </Text>
                  </Box>

                  <Box>
                    <FormLabel>Default Collection (Optional)</FormLabel>
                    {collectionsLoading ? (
                      <Center p="4">
                        <Spinner size="sm" />
                      </Center>
                    ) : outlineCollections && outlineCollections.length > 0 ? (
                      <Select.Root
                        positioning={{ sameWidth: true }}
                        collection={createListCollection({
                          items: outlineCollections.map((c: OutlineCollection) => ({
                            label: c.name,
                            value: c.id
                          }))
                        })}
                        value={outlineCollectionId ? [outlineCollectionId] : []}
                        onValueChange={(e) => setOutlineCollectionId(e.value[0] || '')}
                      >
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder="Select a collection" />
                          </Select.Trigger>
                        </Select.Control>
                        <Portal>
                          <Select.Positioner>
                            <Select.Content>
                              {outlineCollections.map((collection: OutlineCollection) => (
                                <Select.Item key={collection.id} item={collection}>
                                  <Select.ItemText>{collection.name}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Portal>
                      </Select.Root>
                    ) : (
                      <Text fontSize="sm" color="fg.muted">
                        {settings?.outlineApiUrl && settings?.outlineApiKey
                          ? 'No collections found. Create a collection in Outline first.'
                          : 'Configure API URL and Key to load collections'}
                      </Text>
                    )}
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Default collection for creating new notes from tasks
                    </Text>
                  </Box>

                  <HStack gap="2" justifyContent="flex-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOutlineApiUrl(settings?.outlineApiUrl || '');
                        setOutlineApiKey(settings?.outlineApiKey || '');
                        setOutlineCollectionId(settings?.outlineCollectionId || '');
                      }}
                      disabled={!settings}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        updateSettings.mutate({
                          outlineApiUrl: outlineApiUrl || undefined,
                          outlineApiKey: outlineApiKey || undefined,
                          outlineCollectionId: outlineCollectionId || undefined
                        });
                      }}
                      disabled={!outlineApiUrl || !outlineApiKey || updateSettings.isPending}
                      loading={updateSettings.isPending}
                    >
                      Save Outline Settings
                    </Button>
                  </HStack>

                  {settings?.outlineApiUrl && settings?.outlineApiKey && (
                    <Box
                      p="3"
                      borderWidth="1px"
                      borderRadius="l2"
                      borderColor="border.emphasized"
                      bg="green.subtle"
                    >
                      <HStack gap="2">
                        <Text fontSize="sm" fontWeight="medium" color="green.fg">
                          ✓ Outline integration is configured
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </Fieldset.Root>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Appearance Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <Moon width="20" height="20" />
              <Heading size="lg">Appearance</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <HStack justifyContent="space-between">
                <VStack gap="1" alignItems="start">
                  <Text color="fg.muted" fontWeight="medium">
                    Theme
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Choose your preferred theme (Coming soon)
                  </Text>
                </VStack>
                <Text color="fg.muted">{settings.theme}</Text>
              </HStack>

              <HStack justifyContent="space-between">
                <VStack gap="1" alignItems="start">
                  <Text color="fg.muted" fontWeight="medium">
                    Default space
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Starting workspace when you log in (Coming soon)
                  </Text>
                </VStack>
                <Text color="fg.muted">{settings.defaultSpace}</Text>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Keyboard Shortcuts */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <Keyboard width="20" height="20" />
              <Heading size="lg">Keyboard Shortcuts</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="3" alignItems="stretch">
              <HStack justifyContent="space-between">
                <Text fontSize="sm">Open command bar</Text>
                <Text
                  borderRadius="md"
                  py="1"
                  px="2"
                  color="fg.muted"
                  fontFamily="mono"
                  fontSize="sm"
                  bg="bg.subtle"
                >
                  ⌘K
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text fontSize="sm">Quick add task</Text>
                <Text
                  borderRadius="md"
                  py="1"
                  px="2"
                  color="fg.muted"
                  fontFamily="mono"
                  fontSize="sm"
                  bg="bg.subtle"
                >
                  ⌘⇧A
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text fontSize="sm">Search</Text>
                <Text
                  borderRadius="md"
                  py="1"
                  px="2"
                  color="fg.muted"
                  fontFamily="mono"
                  fontSize="sm"
                  bg="bg.subtle"
                >
                  ⌘/
                </Text>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Data Management */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2">
              <Download width="20" height="20" />
              <Heading size="lg">Data Management</Heading>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <HStack justifyContent="space-between">
                <VStack gap="1" alignItems="start">
                  <Text color="fg.muted" fontWeight="medium">
                    Export data
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Download all your data as JSON (Coming soon)
                  </Text>
                </VStack>
                <Button variant="outline" size="sm" disabled>
                  <Download width="16" height="16" />
                  Export
                </Button>
              </HStack>

              <HStack justifyContent="space-between">
                <VStack gap="1" alignItems="start">
                  <Text color="fg.muted" fontWeight="medium">
                    Import data
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Upload previously exported data (Coming soon)
                  </Text>
                </VStack>
                <Button variant="outline" size="sm" disabled>
                  <Upload width="16" height="16" />
                  Import
                </Button>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
}
