import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Clock, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { VStack, HStack, Box } from '../../../styled-system/jsx';
import * as Popover from '../ui/styled/popover';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';

interface Reminder {
  id: string;
  taskId: string | null;
  reminderTime: string;
  message: string;
  sent: boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);

  // Fetch upcoming reminders (not sent yet, in the future)
  const { data: reminders = [], refetch } = useQuery<Reminder[]>({
    queryKey: ['reminders', 'upcoming'],
    queryFn: async () => {
      const response = await fetch('/api/reminders');
      if (!response.ok) throw new Error('Failed to fetch reminders');
      const allReminders = await response.json();

      // Filter to only show unsent reminders in the future
      const now = new Date();
      return allReminders
        .filter((r: Reminder) => !r.sent && new Date(r.reminderTime) > now)
        .sort(
          (a: Reminder, b: Reminder) =>
            new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime()
        )
        .slice(0, 10); // Show max 10 upcoming
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const upcomingCount = reminders.length;

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'DELETE'
      });
      refetch();
    } catch (error) {
      console.error('Failed to dismiss reminder:', error);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={({ open }) => setOpen(open)}>
      <Popover.Trigger asChild>
        <IconButton
          variant="ghost"
          size="md"
          aria-label="Notifications"
          position="relative"
          color="fg.muted"
          _hover={{ bg: 'bg.subtle' }}
        >
          <Bell width="20" height="20" />
          {upcomingCount > 0 && (
            <Box
              colorPalette="red"
              display="flex"
              position="absolute"
              top="2"
              right="2"
              justifyContent="center"
              alignItems="center"
              borderRadius="full"
              minW="5"
              h="5"
              px="1"
              bg="colorPalette.solid"
            >
              <Text color="white" fontSize="2xs" fontWeight="bold">
                {upcomingCount > 9 ? '9+' : upcomingCount}
              </Text>
            </Box>
          )}
        </IconButton>
      </Popover.Trigger>

      <Popover.Positioner>
        <Popover.Content width="350px" maxH="400px" overflow="auto">
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>

          <VStack gap="3" alignItems="stretch">
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" fontWeight="semibold">
                Upcoming Reminders
              </Text>
              <Popover.CloseTrigger asChild>
                <IconButton variant="ghost" size="xs" aria-label="Close">
                  <X width="16" height="16" />
                </IconButton>
              </Popover.CloseTrigger>
            </HStack>

            {reminders.length === 0 ? (
              <Box py="8" textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                  No upcoming reminders
                </Text>
              </Box>
            ) : (
              <VStack gap="2" alignItems="stretch">
                {reminders.map((reminder) => (
                  <Box
                    key={reminder.id}
                    position="relative"
                    borderColor="border.default"
                    borderRadius="md"
                    borderWidth="1px"
                    p="3"
                    bg="bg.subtle"
                    _hover={{ bg: 'bg.muted' }}
                  >
                    <HStack gap="2" alignItems="start">
                      <Clock
                        flexShrink="0"
                        width="16"
                        height="16"
                        mt="0.5"
                        color="var(--colors-fg-muted)"
                      />
                      <VStack flex="1" gap="1" alignItems="start">
                        <Text fontSize="sm" lineHeight="1.4">
                          {reminder.message}
                        </Text>
                        <Badge size="sm" variant="subtle" colorPalette="blue">
                          in {formatDistanceToNow(new Date(reminder.reminderTime))}
                        </Badge>
                      </VStack>
                      <IconButton
                        variant="ghost"
                        size="xs"
                        aria-label="Dismiss"
                        onClick={() => handleDismiss(reminder.id)}
                        flexShrink="0"
                      >
                        <X width="14" height="14" />
                      </IconButton>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </VStack>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}
