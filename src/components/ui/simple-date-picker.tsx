import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { parseDate } from '@internationalized/date';
import { Portal } from '@ark-ui/react/portal';
import { DatePicker } from './date-picker';
import { IconButton } from './icon-button';
import { Input } from './input';
import { Button } from './button';

interface SimpleDatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Simplified DatePicker wrapper that works with ISO date strings (YYYY-MM-DD).
 * Makes it easier to use the Park UI DatePicker without all the boilerplate.
 */
export function SimpleDatePicker({
  value,
  onChange,
  placeholder,
  size = 'md'
}: SimpleDatePickerProps) {
  const dateValue = value ? parseDate(value) : undefined;

  return (
    <DatePicker.Root
      value={dateValue ? [dateValue] : []}
      onValueChange={(details) => {
        if (details.value[0]) {
          const newDate = details.value[0];
          onChange(
            `${newDate.year}-${String(newDate.month).padStart(2, '0')}-${String(newDate.day).padStart(2, '0')}`
          );
        } else {
          onChange('');
        }
      }}
      positioning={{ sameWidth: true }}
    >
      <DatePicker.Control>
        <DatePicker.Input asChild>
          <Input size={size} placeholder={placeholder} />
        </DatePicker.Input>
        <DatePicker.Trigger asChild>
          <IconButton variant="ghost" size={size} aria-label="Open date picker">
            <CalendarIcon
              width={size === 'sm' ? '16' : '20'}
              height={size === 'sm' ? '16' : '20'}
            />
          </IconButton>
        </DatePicker.Trigger>
        {value && (
          <DatePicker.ClearTrigger asChild>
            <IconButton variant="ghost" size={size} aria-label="Clear date">
              ×
            </IconButton>
          </DatePicker.ClearTrigger>
        )}
      </DatePicker.Control>
      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content>
            <DatePicker.View view="day">
              <DatePicker.Context>
                {(datePicker) => (
                  <>
                    <DatePicker.ViewControl>
                      <DatePicker.PrevTrigger asChild>
                        <IconButton variant="ghost" size="sm">
                          <ChevronLeft />
                        </IconButton>
                      </DatePicker.PrevTrigger>
                      <DatePicker.ViewTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <DatePicker.RangeText />
                        </Button>
                      </DatePicker.ViewTrigger>
                      <DatePicker.NextTrigger asChild>
                        <IconButton variant="ghost" size="sm">
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
                                <DatePicker.TableCellTrigger>{day.day}</DatePicker.TableCellTrigger>
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
                        <IconButton variant="ghost" size="sm">
                          <ChevronLeft />
                        </IconButton>
                      </DatePicker.PrevTrigger>
                      <DatePicker.ViewTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <DatePicker.RangeText />
                        </Button>
                      </DatePicker.ViewTrigger>
                      <DatePicker.NextTrigger asChild>
                        <IconButton variant="ghost" size="sm">
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
                                  <DatePicker.TableCellTrigger>
                                    {month.label}
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
                        <IconButton variant="ghost" size="sm">
                          <ChevronLeft />
                        </IconButton>
                      </DatePicker.PrevTrigger>
                      <DatePicker.ViewTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <DatePicker.RangeText />
                        </Button>
                      </DatePicker.ViewTrigger>
                      <DatePicker.NextTrigger asChild>
                        <IconButton variant="ghost" size="sm">
                          <ChevronRight />
                        </IconButton>
                      </DatePicker.NextTrigger>
                    </DatePicker.ViewControl>
                    <DatePicker.Table>
                      <DatePicker.TableBody>
                        {datePicker.getYearsGrid({ columns: 4 }).map((years, rowIndex) => (
                          <DatePicker.TableRow key={`year-row-${rowIndex}`}>
                            {years.map((year) => (
                              <DatePicker.TableCell key={year.value.toString()} value={year.value}>
                                <DatePicker.TableCellTrigger>
                                  {year.label}
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
      </Portal>
    </DatePicker.Root>
  );
}
