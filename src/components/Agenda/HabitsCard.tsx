import { ExternalLink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Text } from '../ui/text';
import { Card } from '../ui/card';
import type { Habit } from '../../shared/types/calendar';
import { Center, HStack, VStack } from 'styled-system/jsx';
import { css } from 'styled-system/css';

interface HabitsCardProps {
  habits: Habit[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onToggleHabit: (habit: Habit) => void;
}

export function HabitsCard({ habits, isLoading, isError, onToggleHabit }: HabitsCardProps) {
  return (
    <Card.Root w="full" h="full">
      <Card.Header p="3">
        <Card.Title fontSize="sm">Daily Habits</Card.Title>
      </Card.Header>
      <Card.Body p="3" pt="0">
        {isLoading ? (
          <Center>Loading habits...</Center>
        ) : isError ? (
          <Center>Error loading habits</Center>
        ) : (
          <VStack gap="1.5" alignItems="stretch">
            {habits?.map((habit) => (
              <HStack
                className={css({
                  bg: 'bg.subtle',
                  '&[data-completed=true]': {
                    bg: 'green.subtle'
                  }
                })}
                key={habit.id}
                onClick={() => onToggleHabit(habit)}
                data-completed={habit.completedToday}
                cursor="pointer"
                justifyContent="space-between"
                borderRadius="md"
                p="1.5"
                transition="all 0.2s"
                _hover={{ bg: 'bg.emphasized' }}
              >
                <Checkbox checked={habit.completedToday} size="sm" readOnly flex="1">
                  <Text
                    textDecoration={habit.completedToday ? 'line-through' : 'none'}
                    fontSize="xs"
                    fontWeight="medium"
                  >
                    {habit.name}
                  </Text>
                </Checkbox>
                <HStack gap="1" alignItems="center">
                  {habit.link && (
                    <a
                      href={habit.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <ExternalLink width="12" height="12" />
                    </a>
                  )}
                  {(habit.currentStreak ?? 0) > 0 && (
                    <Badge variant="subtle" size="sm">
                      🔥{habit.currentStreak}
                    </Badge>
                  )}
                </HStack>
              </HStack>
            ))}
            {(!habits || habits.length === 0) && (
              <Text py="2" color="fg.subtle" fontSize="xs" textAlign="center">
                No habits yet
              </Text>
            )}
          </VStack>
        )}
      </Card.Body>
    </Card.Root>
  );
}
