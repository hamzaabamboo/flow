import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Moon, Keyboard, Download, Upload, Sunrise, Sunset, Calendar, Key, Trash2, Copy, Plus } from 'lucide-react';
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
import { Label } from '../../components/ui/label';

interface ApiToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

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
}

export default function SettingsPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();

  // API Token state
  const [createTokenDialogOpen, setCreateTokenDialogOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Fetch settings
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });

  // Fetch iCal feed URL
  const { data: calendarFeed } = useQuery<{ url: string; instructions: string }>({
    queryKey: ['calendar-feed'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/feed-url');
      if (!response.ok) throw new Error('Failed to fetch calendar feed URL');
      return response.json();
    }
  });

  // Fetch API tokens
  const { data: apiTokens = [] } = useQuery<ApiToken[]>({
    queryKey: ['api-tokens'],
    queryFn: async () => {
      const response = await fetch('/api/api-tokens');
      if (!response.ok) throw new Error('Failed to fetch API tokens');
      return response.json();
    }
  });

  // Create API token
  const createTokenMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('Failed to create token');
      return response.json();
    },
    onSuccess: (data: ApiToken & { token: string }) => {
      setCreatedToken(data.token);
      setNewTokenName('');
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast?.('API token created successfully', {
        title: 'Success',
        type: 'success'
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
  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/api-tokens/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete token');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast?.('API token deleted', {
        title: 'Success',
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

      const response = await fetch('/api/settings/test-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, spaces: settings.notifications.summarySpaces })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to send via HamBot');
      }
      return response.json();
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

        {/* API Tokens Section */}
        <Card.Root>
          <Card.Header>
            <HStack gap="2" justifyContent="space-between">
              <HStack gap="2">
                <Key width="20" height="20" />
                <Heading size="lg">API Tokens</Heading>
              </HStack>
              <Button
                size="sm"
                onClick={() => setCreateTokenDialogOpen(true)}
                disabled={createTokenMutation.isPending}
              >
                <Plus width="16" height="16" />
                Create Token
              </Button>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap="4" alignItems="stretch">
              <Fieldset.Root>
                <Fieldset.Legend>External API Access</Fieldset.Legend>
                <VStack gap="4" alignItems="stretch" mt="4">
                  <Fieldset.HelperText>
                    Use API tokens to access HamFlow from external apps like Raycast, scripts, or automation tools
                  </Fieldset.HelperText>

                  {apiTokens.length === 0 ? (
                    <Box p="4" borderRadius="md" bg="bg.subtle" textAlign="center">
                      <Text color="fg.muted" fontSize="sm">
                        No API tokens yet. Create one to get started.
                      </Text>
                    </Box>
                  ) : (
                    <VStack gap="2" alignItems="stretch">
                      {apiTokens.map((token) => (
                        <Box
                          key={token.id}
                          p="3"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="border.default"
                        >
                          <HStack justifyContent="space-between">
                            <VStack gap="1" alignItems="start">
                              <Text fontWeight="medium">{token.name}</Text>
                              <HStack gap="3" fontSize="xs" color="fg.muted">
                                <Text>
                                  Created: {new Date(token.createdAt).toLocaleDateString()}
                                </Text>
                                {token.lastUsedAt && (
                                  <Text>
                                    Last used: {new Date(token.lastUsedAt).toLocaleDateString()}
                                  </Text>
                                )}
                              </HStack>
                            </VStack>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTokenMutation.mutate(token.id)}
                              disabled={deleteTokenMutation.isPending}
                            >
                              <Trash2 width="16" height="16" color="red.500" />
                            </Button>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Fieldset.Root>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Create Token Dialog */}
        <Dialog.Root
          open={createTokenDialogOpen || createdToken !== null}
          onOpenChange={(e) => {
            setCreateTokenDialogOpen(e.open);
            if (!e.open) {
              setCreatedToken(null);
              setNewTokenName('');
            }
          }}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="500px">
              <Dialog.Header>
                <Dialog.Title>{createdToken ? 'Token Created' : 'Create API Token'}</Dialog.Title>
                <Dialog.Description>
                  {createdToken
                    ? 'Copy this token now - you won\'t be able to see it again!'
                    : 'Create a new API token for external access'}
                </Dialog.Description>
              </Dialog.Header>
              <Dialog.Body>
                {createdToken ? (
                  <VStack gap="4" alignItems="stretch">
                    <VStack gap="2" alignItems="stretch">
                      <Label>Your API Token:</Label>
                      <HStack gap="2">
                        <Input
                          value={createdToken}
                          readOnly
                          onClick={(e) => e.currentTarget.select()}
                          fontFamily="mono"
                          fontSize="sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void copyToClipboard(createdToken);
                          }}
                        >
                          <Copy width="16" height="16" />
                        </Button>
                      </HStack>
                    </VStack>
                    <Text fontSize="sm" color="orange.500">
                      ⚠️ Make sure to copy this token now. You won't be able to see it again!
                    </Text>
                  </VStack>
                ) : (
                  <VStack gap="4" alignItems="stretch">
                    <VStack gap="2" alignItems="stretch">
                      <Label>Token Name:</Label>
                      <Input
                        placeholder="e.g., Raycast, My Script, etc."
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTokenName.trim()) {
                            createTokenMutation.mutate(newTokenName.trim());
                          }
                        }}
                      />
                    </VStack>
                  </VStack>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">
                    {createdToken ? 'Done' : 'Cancel'}
                  </Button>
                </Dialog.CloseTrigger>
                {!createdToken && (
                  <Button
                    onClick={() => {
                      if (newTokenName.trim()) {
                        createTokenMutation.mutate(newTokenName.trim());
                      }
                    }}
                    disabled={!newTokenName.trim() || createTokenMutation.isPending}
                  >
                    Create Token
                  </Button>
                )}
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>

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
