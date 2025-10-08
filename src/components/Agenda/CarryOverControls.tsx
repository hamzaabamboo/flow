import { useState } from 'react';
import { format, addDays, addWeeks, endOfDay, startOfDay, endOfMonth } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { VStack, HStack, Box } from 'styled-system/jsx';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { Select, createListCollection } from '../ui/select';
import { SimpleDatePicker } from '../ui/simple-date-picker';
import * as Dialog from '../ui/styled/dialog';

interface CarryOverControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCarryOver: (targetDate: Date) => void;
  isCarryingOver?: boolean;
  buttonText?: string;
  colorPalette?: string;
}

const carryOverOptions = createListCollection({
  items: [
    { label: 'End of Today', value: 'end_of_today' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: 'Next Week', value: 'next_week' },
    { label: 'End of Month', value: 'end_of_month' },
    { label: 'Custom Date', value: 'custom' }
  ]
});

export function CarryOverControls({
  open,
  onOpenChange,
  onCarryOver,
  isCarryingOver,
  buttonText = 'Move Task',
  colorPalette = 'orange'
}: CarryOverControlsProps) {
  const [carryOverTarget, setCarryOverTarget] = useState<
    'end_of_today' | 'tomorrow' | 'next_week' | 'end_of_month' | 'custom'
  >('end_of_today');
  const [customCarryOverDate, setCustomCarryOverDate] = useState<Date>(new Date());

  const getTargetDate = (): Date => {
    switch (carryOverTarget) {
      case 'end_of_today':
        return endOfDay(new Date());
      case 'tomorrow':
        return startOfDay(addDays(new Date(), 1));
      case 'next_week':
        return startOfDay(addWeeks(new Date(), 1));
      case 'end_of_month':
        return endOfMonth(new Date());
      case 'custom':
        return customCarryOverDate;
    }
  };

  const handleCarryOver = () => {
    onCarryOver(getTargetDate());
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="md">
          <VStack gap="6" alignItems="stretch" p="6">
            {/* Header */}
            <VStack gap="1" alignItems="stretch">
              <Dialog.Title>Carry Over Task</Dialog.Title>
              <Dialog.Description>Choose when to reschedule this task</Dialog.Description>
            </VStack>

            {/* Body */}
            <VStack gap="4" alignItems="stretch">
              <Box>
                <Text mb="2" fontSize="sm" fontWeight="medium">
                  Target Date
                </Text>
                <Select.Root
                  collection={carryOverOptions}
                  value={[carryOverTarget]}
                  onValueChange={(details) => {
                    setCarryOverTarget(details.value[0] as typeof carryOverTarget);
                  }}
                  size="md"
                >
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select target date" />
                  </Select.Trigger>
                  <Select.Positioner>
                    <Select.Content>
                      {carryOverOptions.items.map((item) => (
                        <Select.Item key={item.value} item={item}>
                          <Select.ItemText>{item.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              </Box>

              {carryOverTarget === 'custom' && (
                <Box>
                  <Text mb="2" fontSize="sm" fontWeight="medium">
                    Custom Date
                  </Text>
                  <SimpleDatePicker
                    value={format(customCarryOverDate, 'yyyy-MM-dd')}
                    onChange={(dateStr) => {
                      if (dateStr) {
                        const [year, month, day] = dateStr.split('-').map(Number);
                        setCustomCarryOverDate(new Date(year, month - 1, day));
                      }
                    }}
                    size="md"
                  />
                </Box>
              )}

              <Text color="fg.muted" fontSize="sm">
                Task will be moved to:{' '}
                <Text as="span" color="fg.default" fontWeight="medium">
                  {carryOverTarget === 'custom'
                    ? format(customCarryOverDate, 'MMM d, yyyy')
                    : carryOverOptions.items.find((i) => i.value === carryOverTarget)?.label}
                </Text>
              </Text>
            </VStack>

            {/* Footer */}
            <HStack gap="3" justify="flex-end">
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.CloseTrigger>
              <Button
                variant="solid"
                onClick={handleCarryOver}
                disabled={isCarryingOver}
                colorPalette={colorPalette}
              >
                <ArrowRight width="16" height="16" />
                {buttonText}
              </Button>
            </HStack>
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
