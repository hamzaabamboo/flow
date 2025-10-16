import { useState } from 'react';
import { format, addDays, addWeeks, setHours, setMinutes, startOfDay } from 'date-fns';
import { parseDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { VStack, HStack, Box } from 'styled-system/jsx';
import { Text } from './text';
import { Button } from './button';
import { Input } from './input';
import * as DatePicker from './styled/date-picker';
import { IconButton } from './icon-button';

interface QuickDateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

type PresetOption = 'today_morning' | 'tonight' | 'tomorrow' | 'next_week' | 'custom';

/**
 * Quick Date Time Picker with preset buttons and full calendar component.
 * Works with Date objects and provides common presets like "Today 9 AM", "Tonight 8 PM", etc.
 */
export function QuickDateTimePicker({ value, onChange, size = 'md' }: QuickDateTimePickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetOption>('custom');
  const [customDate, setCustomDate] = useState<string>(
    value ? format(value, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [customTime, setCustomTime] = useState<string>(value ? format(value, 'HH:mm') : '09:00');

  const getPresetDate = (preset: PresetOption): Date | null => {
    const now = new Date();

    switch (preset) {
      case 'today_morning':
        return setMinutes(setHours(startOfDay(now), 9), 0); // 9:00 AM today
      case 'tonight':
        return setMinutes(setHours(startOfDay(now), 20), 0); // 8:00 PM today
      case 'tomorrow':
        return setMinutes(setHours(startOfDay(addDays(now, 1)), 9), 0); // 9:00 AM tomorrow
      case 'next_week':
        return setMinutes(setHours(startOfDay(addWeeks(now, 1)), 9), 0); // 9:00 AM next week
      case 'custom':
        // Build date from custom date + time
        if (!customDate) return null;
        const [hours, minutes] = customTime.split(':').map(Number);
        const date = new Date(customDate);
        return setMinutes(setHours(date, hours), minutes);
    }
  };

  const handlePresetClick = (preset: PresetOption) => {
    setSelectedPreset(preset);
    const newDate = getPresetDate(preset);
    onChange(newDate);
  };

  const handleCustomDateChange = (dateStr: string) => {
    setCustomDate(dateStr);
    setSelectedPreset('custom');

    if (dateStr && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const date = new Date(dateStr);
      onChange(setMinutes(setHours(date, hours), minutes));
    }
  };

  const handleCustomTimeChange = (timeStr: string) => {
    setCustomTime(timeStr);
    setSelectedPreset('custom');

    if (customDate && timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(customDate);
      onChange(setMinutes(setHours(date, hours), minutes));
    }
  };

  const presets: Array<{ label: string; value: PresetOption }> = [
    { label: 'Today 9 AM', value: 'today_morning' },
    { label: 'Tonight 8 PM', value: 'tonight' },
    { label: 'Tomorrow 9 AM', value: 'tomorrow' },
    { label: 'Next Week', value: 'next_week' },
    { label: 'Custom', value: 'custom' }
  ];

  return (
    <VStack gap="3" alignItems="stretch">
      {/* Preset Buttons */}
      <Box>
        <Text mb="2" fontSize="sm" fontWeight="medium">
          Quick Select
        </Text>
        <HStack gap="2" flexWrap="wrap">
          {presets.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              size={size}
              variant={selectedPreset === preset.value ? 'solid' : 'outline'}
              onClick={() => handlePresetClick(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </HStack>
      </Box>

      {/* Custom Date & Time Inputs with Full Calendar */}
      {selectedPreset === 'custom' && (
        <VStack gap="3" alignItems="stretch">
          <Box>
            <Text mb="2" fontSize="sm" fontWeight="medium">
              Date
            </Text>
            <DatePicker.Root
              value={customDate ? [parseDate(customDate)] : []}
              onValueChange={(details) => {
                if (details.value[0]) {
                  const newDate = details.value[0];
                  const dateStr = `${newDate.year}-${String(newDate.month).padStart(2, '0')}-${String(newDate.day).padStart(2, '0')}`;
                  handleCustomDateChange(dateStr);
                } else {
                  handleCustomDateChange('');
                }
              }}
              positioning={{ sameWidth: true }}
              closeOnSelect={false}
            >
              <DatePicker.Control>
                <DatePicker.Input asChild>
                  <Input size={size} placeholder="Select date" />
                </DatePicker.Input>
                <DatePicker.Trigger asChild>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={size}
                    aria-label="Open date picker"
                  >
                    <CalendarIcon
                      width={size === 'sm' ? '16' : '20'}
                      height={size === 'sm' ? '16' : '20'}
                    />
                  </IconButton>
                </DatePicker.Trigger>
                {customDate && (
                  <DatePicker.ClearTrigger asChild>
                    <IconButton type="button" variant="ghost" size={size} aria-label="Clear date">
                      ×
                    </IconButton>
                  </DatePicker.ClearTrigger>
                )}
              </DatePicker.Control>
              <DatePicker.Positioner zIndex={1400}>
                <DatePicker.Content onClick={(e) => e.stopPropagation()}>
                  <DatePicker.View view="day">
                    <DatePicker.Context>
                      {(datePicker) => (
                        <>
                          <DatePicker.ViewControl>
                            <DatePicker.PrevTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronLeft />
                              </IconButton>
                            </DatePicker.PrevTrigger>
                            <DatePicker.ViewTrigger asChild>
                              <Button type="button" variant="ghost" size="sm">
                                <DatePicker.RangeText />
                              </Button>
                            </DatePicker.ViewTrigger>
                            <DatePicker.NextTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronRight />
                              </IconButton>
                            </DatePicker.NextTrigger>
                          </DatePicker.ViewControl>
                          <DatePicker.Table>
                            <DatePicker.TableHead>
                              <DatePicker.TableRow>
                                {datePicker.weekDays.map((weekDay, idx) => (
                                  <DatePicker.TableHeader key={weekDay.short || idx}>
                                    {weekDay.short}
                                  </DatePicker.TableHeader>
                                ))}
                              </DatePicker.TableRow>
                            </DatePicker.TableHead>
                            <DatePicker.TableBody>
                              {datePicker.weeks.map((week, weekIndex) => (
                                <DatePicker.TableRow key={`week-${weekIndex}`}>
                                  {week.map((day) => (
                                    <DatePicker.TableCell key={day.toString()} value={day}>
                                      <DatePicker.TableCellTrigger asChild>
                                        <IconButton type="button" variant="ghost">
                                          {day.day}
                                        </IconButton>
                                      </DatePicker.TableCellTrigger>
                                    </DatePicker.TableCell>
                                  ))}
                                </DatePicker.TableRow>
                              ))}
                            </DatePicker.TableBody>
                          </DatePicker.Table>
                        </>
                      )}
                    </DatePicker.Context>
                  </DatePicker.View>
                  <DatePicker.View view="month">
                    <DatePicker.Context>
                      {(datePicker) => (
                        <>
                          <DatePicker.ViewControl>
                            <DatePicker.PrevTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronLeft />
                              </IconButton>
                            </DatePicker.PrevTrigger>
                            <DatePicker.ViewTrigger asChild>
                              <Button type="button" variant="ghost" size="sm">
                                <DatePicker.RangeText />
                              </Button>
                            </DatePicker.ViewTrigger>
                            <DatePicker.NextTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronRight />
                              </IconButton>
                            </DatePicker.NextTrigger>
                          </DatePicker.ViewControl>
                          <DatePicker.Table>
                            <DatePicker.TableBody>
                              {datePicker
                                .getMonthsGrid({ columns: 4, format: 'short' })
                                .map((months, rowIndex) => (
                                  <DatePicker.TableRow key={`month-row-${rowIndex}`}>
                                    {months.map((month) => (
                                      <DatePicker.TableCell
                                        key={month.value.toString()}
                                        value={month.value}
                                      >
                                        <DatePicker.TableCellTrigger asChild>
                                          <Button type="button" variant="ghost">
                                            {month.label}
                                          </Button>
                                        </DatePicker.TableCellTrigger>
                                      </DatePicker.TableCell>
                                    ))}
                                  </DatePicker.TableRow>
                                ))}
                            </DatePicker.TableBody>
                          </DatePicker.Table>
                        </>
                      )}
                    </DatePicker.Context>
                  </DatePicker.View>
                  <DatePicker.View view="year">
                    <DatePicker.Context>
                      {(datePicker) => (
                        <>
                          <DatePicker.ViewControl>
                            <DatePicker.PrevTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronLeft />
                              </IconButton>
                            </DatePicker.PrevTrigger>
                            <DatePicker.ViewTrigger asChild>
                              <Button type="button" variant="ghost" size="sm">
                                <DatePicker.RangeText />
                              </Button>
                            </DatePicker.ViewTrigger>
                            <DatePicker.NextTrigger asChild>
                              <IconButton type="button" variant="ghost" size="sm">
                                <ChevronRight />
                              </IconButton>
                            </DatePicker.NextTrigger>
                          </DatePicker.ViewControl>
                          <DatePicker.Table>
                            <DatePicker.TableBody>
                              {datePicker.getYearsGrid({ columns: 4 }).map((years, rowIndex) => (
                                <DatePicker.TableRow key={`year-row-${rowIndex}`}>
                                  {years.map((year) => (
                                    <DatePicker.TableCell
                                      key={year.value.toString()}
                                      value={year.value}
                                    >
                                      <DatePicker.TableCellTrigger asChild>
                                        <Button type="button" variant="ghost">
                                          {year.label}
                                        </Button>
                                      </DatePicker.TableCellTrigger>
                                    </DatePicker.TableCell>
                                  ))}
                                </DatePicker.TableRow>
                              ))}
                            </DatePicker.TableBody>
                          </DatePicker.Table>
                        </>
                      )}
                    </DatePicker.Context>
                  </DatePicker.View>
                </DatePicker.Content>
              </DatePicker.Positioner>
            </DatePicker.Root>
          </Box>
          <Box>
            <Text mb="1" fontSize="sm" fontWeight="medium">
              Time
            </Text>
            <Input
              type="time"
              value={customTime}
              onChange={(e) => handleCustomTimeChange(e.target.value)}
              size={size}
            />
          </Box>
        </VStack>
      )}

      {/* Preview */}
      {value && (
        <Box borderColor="border.default" borderRadius="md" borderWidth="1px" bg="bg.subtle" p="2">
          <Text color="fg.muted" fontSize="xs" fontWeight="medium">
            Selected:
          </Text>
          <Text fontSize="sm" fontWeight="medium">
            {format(value, 'MMM d, yyyy')} at {format(value, 'h:mm a')}
          </Text>
        </Box>
      )}
    </VStack>
  );
}
