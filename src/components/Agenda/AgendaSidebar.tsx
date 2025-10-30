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
    <VStack gap={6} h="fit-content" justifyContent="space-between">
      {/* Habits Section for Week View */}
      <Card.Root w="full">
        <Card.Header p="4">
          <Card.Title fontSize="md">This Week's Habits</Card.Title>
        </Card.Header>
        <Card.Body p="4" pt="0">
          {isLoadingHabits ? (
            <Center py="4">
              <Spinner size="sm" />
            </Center>
          ) : isErrorHabits ? (
            <Center py="4">
              <Text color="red.default" fontSize="sm">
                Error loading habits
              </Text>
            </Center>
          ) : (
            <VStack gap="2.5" alignItems="stretch">
              {(() => {
                const uniqueHabits = Array.from(
                  new Map(habits?.map((h) => [h.id, h]) || []).values()
                );
                return uniqueHabits.length > 0 ? (
                  uniqueHabits.map((habit) => (
                    <HStack
                      key={habit.id}
                      justifyContent="space-between"
                      alignItems="start"
                      borderRadius="md"
                      p="2.5"
                      bg="bg.subtle"
                      gap="2"
                    >
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        flex="1"
                        minW="0"
                        wordBreak="break-word"
                      >
                        {habit.name}
                      </Text>
                      {habit.link && (
                        <a
                          href={habit.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        >
                          <ExternalLink width="14" height="14" />
                        </a>
                      )}
                    </HStack>
                  ))
                ) : (
                  <Text py="4" color="fg.subtle" fontSize="sm" textAlign="center">
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
