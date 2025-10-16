import { ExternalLink } from 'lucide-react';
import { VStack, HStack, Center } from 'styled-system/jsx';
import * as Card from '../ui/styled/card';
import { Text } from '../ui/text';
import { Spinner } from '../ui/spinner';
import { StatsCard } from './StatsCard';
import type { Habit } from '../../shared/types/calendar';

interface AgendaSidebarProps {
  habits: Habit[] | undefined;
  isLoadingHabits: boolean;
  isErrorHabits: boolean;
  stats: {
    total: number;
    completed: number;
    remaining: number;
    overdue: number;
    todo: number;
  };
  statsTitle: string;
}

export function AgendaSidebar({
  habits,
  isLoadingHabits,
  isErrorHabits,
  stats,
  statsTitle
}: AgendaSidebarProps) {
  return (
    <VStack gap={6} h="full" justifyContent="space-between">
      {/* Habits Section for Week View */}
      <Card.Root w="full">
        <Card.Header p="3">
          <Card.Title fontSize="sm">This Week's Habits</Card.Title>
        </Card.Header>
        <Card.Body p="3" pt="0">
          {isLoadingHabits ? (
            <Center>
              <Spinner size="sm" />
            </Center>
          ) : isErrorHabits ? (
            <Center>
              <Text color="red.default" fontSize="xs">
                Error loading habits
              </Text>
            </Center>
          ) : (
            <VStack gap="1.5" alignItems="stretch" maxH="300px" overflowY="auto">
              {(() => {
                const uniqueHabits = Array.from(
                  new Map(habits?.map((h) => [h.id, h]) || []).values()
                );
                return uniqueHabits.length > 0 ? (
                  uniqueHabits.map((habit) => (
                    <HStack
                      key={habit.id}
                      justifyContent="space-between"
                      borderRadius="md"
                      p="1.5"
                      bg="bg.subtle"
                    >
                      <Text fontSize="xs" fontWeight="medium">
                        {habit.name}
                      </Text>
                      {habit.link && (
                        <a
                          href={habit.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center' }}
                        >
                          <ExternalLink width="12" height="12" />
                        </a>
                      )}
                    </HStack>
                  ))
                ) : (
                  <Text py="2" color="fg.subtle" fontSize="xs" textAlign="center">
                    No habits this week
                  </Text>
                );
              })()}
            </VStack>
          )}
        </Card.Body>
      </Card.Root>

      {/* Stats Section */}
      <StatsCard title={statsTitle} stats={stats} />
    </VStack>
  );
}
