import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Box, VStack, HStack, Grid } from '../../../styled-system/jsx';
import { Heading } from '../../components/ui/heading';
import { Text } from '../../components/ui/text';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { useSpace } from '../../contexts/SpaceContext';
import { api } from '../../api/client';

type DateRange = 'today' | 'week' | 'month' | '7days' | '30days';

interface CompletionStatTask {
  id: string;
  title: string;
  priority?: string | null;
  dueDate?: string | null;
}

export default function AnalyticsPage() {
  const { currentSpace } = useSpace();
  const [dateRange, setDateRange] = useState<DateRange>('7days');

  // Calculate date range
  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date, rangeLabel: string;

    switch (dateRange) {
      case 'today':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        rangeLabel = 'Today';
        break;
      case 'week':
        start = startOfWeek(now);
        end = endOfWeek(now);
        rangeLabel = 'This Week';
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        rangeLabel = 'This Month';
        break;
      case '7days':
        start = subDays(now, 6);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        rangeLabel = 'Last 7 Days';
        break;
      case '30days':
      default:
        start = subDays(now, 29);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        rangeLabel = 'Last 30 Days';
        break;
    }

    return { startDate: start, endDate: end, label: rangeLabel };
  }, [dateRange]);

  // Fetch completion stats
  const {
    data: analyticsData,
    isLoading,
    isError
  } = useQuery({
    queryKey: ['analytics', 'completions', startDate, endDate, currentSpace],
    queryFn: async () => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const { data, error } = await api.api.stats.analytics.completions.get({
        query: { startDate: startStr, endDate: endStr, space: currentSpace }
      });
      if (error) throw new Error('Failed to fetch completions');
      return data as {
        completions: { date: string; count: number; tasks: CompletionStatTask[] }[];
      };
    }
  });

  const completions = useMemo(() => {
    if (!analyticsData || !analyticsData.completions) return [];
    return analyticsData.completions.flatMap((c) => c.tasks) || [];
  }, [analyticsData]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = completions.length;
    const daysInRange =
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const avgPerDay = daysInRange > 0 ? (total / daysInRange).toFixed(1) : '0';

    // Group by priority
    const byPriority = completions.reduce(
      (acc, task) => {
        const priority = task.priority || 'none';
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Group by date for chart
    const byDate: Record<string, number> = {};
    analyticsData?.completions.forEach((c) => {
      byDate[c.date] = c.count;
    });

    return { total, avgPerDay, byPriority, byDate, daysInRange };
  }, [completions, analyticsData, endDate, startDate]);

  return (
    <Box data-space={currentSpace} p={{ base: '2', md: '4' }}>
      <VStack gap="6" alignItems="stretch">
        {/* Header */}
        <VStack gap="1" alignItems="start">
          <Heading size="2xl">Task Analytics</Heading>
          <Text color="fg.muted">Track your task completion statistics over time</Text>
        </VStack>

        {/* Date Range Selector */}
        <Box borderRadius="lg" w="full" p="4" bg="bg.muted">
          <VStack gap="3" alignItems="stretch">
            <Text fontWeight="medium">Date Range</Text>
            <HStack gap="2" flexWrap="wrap">
              {[
                { value: 'today', label: 'Today' },
                { value: '7days', label: 'Last 7 Days' },
                { value: '30days', label: 'Last 30 Days' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' }
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={dateRange === option.value ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(option.value as DateRange)}
                >
                  {option.label}
                </Button>
              ))}
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {label}: {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
            </Text>
          </VStack>
        </Box>

        {isLoading ? (
          <VStack gap="3" justifyContent="center" alignItems="center" minH="40vh" p="8">
            <Spinner size="lg" />
            <Text color="fg.muted">Loading analytics...</Text>
          </VStack>
        ) : isError ? (
          <VStack gap="3" justifyContent="center" alignItems="center" minH="40vh" p="8">
            <Text color="fg.destructive">
              Failed to load analytics data. Please try again later.
            </Text>
          </VStack>
        ) : (
          <>
            {/* Summary Stats */}
            <Grid gap="4" w="full" columns={{ base: 1, sm: 2, md: 4 }}>
              <Box borderRadius="lg" p="4" bg="bg.muted">
                <VStack gap="1" justifyContent="flex-start">
                  <Text color="fg.muted" fontSize="sm">
                    Total Completed
                  </Text>
                  <Text color="green.default" fontSize="2xl" fontWeight="bold">
                    {stats.total}
                  </Text>
                </VStack>
              </Box>
              <Box borderRadius="lg" p="4" bg="bg.muted">
                <VStack gap="1" justifyContent="flex-start">
                  <Text color="fg.muted" fontSize="sm">
                    Average Per Day
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {stats.avgPerDay}
                  </Text>
                </VStack>
              </Box>
              <Box borderRadius="lg" p="4" bg="bg.muted">
                <VStack gap="1" justifyContent="flex-start">
                  <Text color="fg.muted" fontSize="sm">
                    Days in Range
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {stats.daysInRange}
                  </Text>
                </VStack>
              </Box>
              <Box borderRadius="lg" p="4" bg="bg.muted">
                <VStack gap="1" justifyContent="flex-start">
                  <Text color="fg.muted" fontSize="sm">
                    Completion Rate
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {stats.total > 0 ? ((stats.total / stats.daysInRange) * 100).toFixed(0) : 0}%
                  </Text>
                </VStack>
              </Box>
            </Grid>

            {/* By Priority */}
            <Box borderRadius="lg" w="full" p="4" bg="bg.muted">
              <VStack gap="3" alignItems="stretch">
                <Heading size="md">Completions by Priority</Heading>
                <Grid gap="3" columns={{ base: 2, sm: 4 }}>
                  {Object.entries(stats.byPriority).map(([priority, count]) => {
                    const bgMap: Record<string, string> = {
                      urgent: 'red.subtle',
                      high: 'orange.subtle',
                      medium: 'yellow.subtle',
                      low: 'gray.subtle'
                    };
                    const bgColor = bgMap[priority] || 'gray.subtle';
                    return (
                      <Box
                        key={priority}
                        borderRadius="md"
                        p="3"
                        style={{ backgroundColor: `var(--colors-${bgColor.replace('.', '-')})` }}
                      >
                        <VStack gap="1">
                          <Text fontSize="2xl" fontWeight="bold">
                            {count}
                          </Text>
                          <Text fontSize="sm" textTransform="capitalize">
                            {priority}
                          </Text>
                        </VStack>
                      </Box>
                    );
                  })}
                </Grid>
              </VStack>
            </Box>

            {/* Simple Daily Breakdown */}
            <Box borderRadius="lg" w="full" p="4" bg="bg.muted">
              <VStack gap="3" alignItems="stretch">
                <Heading size="md">Daily Breakdown</Heading>
                {Object.keys(stats.byDate).length > 0 ? (
                  <VStack gap="2" alignItems="stretch">
                    {Object.entries(stats.byDate)
                      .toSorted(([a], [b]) => b.localeCompare(a))
                      .map(([date, count]) => (
                        <HStack
                          key={date}
                          justifyContent="space-between"
                          p="2"
                          borderRadius="md"
                          bg="bg.default"
                        >
                          <Text>{format(new Date(date), 'EEE, MMM d, yyyy')}</Text>
                          <Text fontWeight="bold" color="green.default">
                            {count} tasks
                          </Text>
                        </HStack>
                      ))}
                  </VStack>
                ) : (
                  <Text color="fg.muted" textAlign="center" p="4">
                    No completed tasks in this date range
                  </Text>
                )}
              </VStack>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
}
