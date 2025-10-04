import { Text } from '../ui/text';
import { Card } from '../ui/card';
import { HStack, VStack } from 'styled-system/jsx';

interface StatsCardProps {
  title: string;
  stats: {
    todo: number;
    overdue: number;
    completed: number;
    total: number;
  };
}

export function StatsCard({ title, stats }: StatsCardProps) {
  return (
    <Card.Root w="full" h="full">
      <Card.Header p="3">
        <Card.Title fontSize="sm">{title}</Card.Title>
      </Card.Header>
      <Card.Body p="3" pt="0">
        <VStack gap={2} alignItems="stretch">
          <HStack justifyContent="space-between">
            <Text color="fg.muted" fontSize="xs">
              Todo
            </Text>
            <Text fontSize="xl" fontWeight="bold">
              {stats.todo}
            </Text>
          </HStack>
          {stats.overdue > 0 && (
            <HStack justifyContent="space-between">
              <Text color="fg.muted" fontSize="xs">
                Overdue
              </Text>
              <Text color="red.default" fontSize="lg" fontWeight="semibold">
                {stats.overdue}
              </Text>
            </HStack>
          )}
          <HStack justifyContent="space-between">
            <Text color="fg.muted" fontSize="xs">
              Completed
            </Text>
            <Text color="green.default" fontSize="md" fontWeight="semibold">
              {stats.completed}/{stats.total}
            </Text>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
