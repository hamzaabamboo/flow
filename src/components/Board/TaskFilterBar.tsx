import React from 'react';
import { Search, ArrowUpDown, Tag, Calendar, AlertCircle } from 'lucide-react';
import { Check } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, createListCollection } from '../ui/select';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { SimpleDatePicker } from '../ui/simple-date-picker';
import * as Popover from '../ui/styled/popover';
import type { FilterOptions } from '../../shared/types';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface TaskFilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableLabels?: string[];
}

const priorityOptions = createListCollection({
  items: [
    { label: 'All Priorities', value: '' },
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
  ]
});

const sortOptions = createListCollection({
  items: [
    { label: 'Updated Date', value: 'updatedAt' },
    { label: 'Created Date', value: 'createdAt' },
    { label: 'Due Date', value: 'dueDate' },
    { label: 'Priority', value: 'priority' }
  ]
});

export function TaskFilterBar({
  filters,
  onFiltersChange,
  availableLabels = []
}: TaskFilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handlePriorityChange = (value: string[]) => {
    onFiltersChange({ ...filters, priority: value[0] || '' });
  };

  const handleSortChange = (value: string[]) => {
    onFiltersChange({ ...filters, sortBy: value[0] });
  };

  const toggleSortOrder = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleLabelSelect = (label: string) => {
    onFiltersChange({
      ...filters,
      label: filters.label === label ? '' : label
    });
  };

  const handleDateFilter = (type: 'before' | 'after', date: string) => {
    if (type === 'before') {
      onFiltersChange({ ...filters, dueBefore: date });
    } else {
      onFiltersChange({ ...filters, dueAfter: date });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      priority: '',
      label: '',
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters =
    filters.search || filters.priority || filters.label || filters.dueBefore || filters.dueAfter;

  return (
    <Box borderColor="border.default" borderBottomWidth="1px" p="4" bg="bg.subtle">
      <VStack gap="3">
        {/* Main filter row */}
        <HStack gap="3" w="full" flexWrap="wrap">
          {/* Search */}
          <Box position="relative" flex="1" minW="200px">
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'fg.muted'
              }}
            />
            <Input
              placeholder="Search tasks..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              style={{ paddingLeft: '36px' }}
            />
          </Box>

          {/* Priority Filter */}
          <Select.Root
            collection={priorityOptions}
            value={filters.priority ? [filters.priority] : ['']}
            onValueChange={(e) => handlePriorityChange(e.value)}
          >
            <Select.Control>
              <Select.Trigger minW="150px">
                <AlertCircle size={14} />
                <Select.ValueText placeholder="All Priorities" />
              </Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {priorityOptions.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

          {/* Label Filter */}
          {availableLabels.length > 0 && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <Button variant="outline" size="sm">
                  <Tag size={14} />
                  {filters.label || 'All Labels'}
                </Button>
              </Popover.Trigger>
              <Popover.Positioner>
                <Popover.Content>
                  <Popover.Title>Filter by Label</Popover.Title>
                  <VStack gap="1" mt="2">
                    <Button
                      variant={!filters.label ? 'solid' : 'ghost'}
                      size="sm"
                      onClick={() => handleLabelSelect('')}
                      justifyContent="start"
                      w="full"
                    >
                      All Labels
                    </Button>
                    {availableLabels.map((label) => (
                      <Button
                        key={label}
                        variant={filters.label === label ? 'solid' : 'ghost'}
                        size="sm"
                        onClick={() => handleLabelSelect(label)}
                        justifyContent="start"
                        w="full"
                      >
                        {label}
                      </Button>
                    ))}
                  </VStack>
                </Popover.Content>
              </Popover.Positioner>
            </Popover.Root>
          )}

          {/* Date Filters */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline" size="sm">
                <Calendar size={14} />
                Due Date
              </Button>
            </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content>
                <Popover.Title>Filter by Due Date</Popover.Title>
                <VStack gap="3" mt="3">
                  <Box>
                    <Text mb="1" fontSize="sm">
                      Due Before:
                    </Text>
                    <SimpleDatePicker
                      value={filters.dueBefore || ''}
                      onChange={(value) => handleDateFilter('before', value)}
                      placeholder="Select date"
                      size="sm"
                    />
                  </Box>
                  <Box>
                    <Text mb="1" fontSize="sm">
                      Due After:
                    </Text>
                    <SimpleDatePicker
                      value={filters.dueAfter || ''}
                      onChange={(value) => handleDateFilter('after', value)}
                      placeholder="Select date"
                      size="sm"
                    />
                  </Box>
                </VStack>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>

          {/* Sort Controls */}
          <HStack gap="2">
            <Select.Root
              collection={sortOptions}
              value={[filters.sortBy || 'updatedAt']}
              onValueChange={(e) => handleSortChange(e.value)}
            >
              <Select.Control>
                <Select.Trigger minW="150px">
                  <ArrowUpDown size={14} />
                  <Select.ValueText placeholder="Sort by..." />
                </Select.Trigger>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {sortOptions.items.map((item) => (
                      <Select.Item key={item.value} item={item}>
                        <Select.ItemText>{item.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>

            <IconButton
              onClick={toggleSortOrder}
              variant="outline"
              size="sm"
              title={filters.sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              <ArrowUpDown
                size={16}
                style={{
                  transform: filters.sortOrder === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </IconButton>
          </HStack>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </HStack>

        {/* Active filters display */}
        {hasActiveFilters && (
          <HStack gap="2" flexWrap="wrap">
            <Text color="fg.muted" fontSize="sm">
              Active filters:
            </Text>
            {filters.search && (
              <Box borderRadius="md" py="1" px="2" fontSize="sm" bg="colorPalette.subtle">
                Search: {filters.search}
              </Box>
            )}
            {filters.priority && (
              <Box borderRadius="md" py="1" px="2" fontSize="sm" bg="colorPalette.subtle">
                Priority: {filters.priority}
              </Box>
            )}
            {filters.label && (
              <Box borderRadius="md" py="1" px="2" fontSize="sm" bg="colorPalette.subtle">
                Label: {filters.label}
              </Box>
            )}
            {filters.dueBefore && (
              <Box borderRadius="md" py="1" px="2" fontSize="sm" bg="colorPalette.subtle">
                Due before: {filters.dueBefore}
              </Box>
            )}
            {filters.dueAfter && (
              <Box borderRadius="md" py="1" px="2" fontSize="sm" bg="colorPalette.subtle">
                Due after: {filters.dueAfter}
              </Box>
            )}
          </HStack>
        )}
      </VStack>
    </Box>
  );
}
