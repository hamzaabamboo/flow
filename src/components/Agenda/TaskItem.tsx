import { ExternalLink, ArrowRight, Calendar, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Text } from '../ui/text';
import { IconButton } from '../ui/icon-button';
import { Button } from '../ui/button';
import { PriorityBadge } from '../PriorityBadge';
import { LinkifiedText } from '../ui/linkified-text';
import { Countdown } from '../ui/countdown';
import { TaskActionsMenu } from '../TaskActionsMenu';
import { CarryOverControls } from './CarryOverControls';
import type { CalendarEvent } from '../../shared/types/calendar';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { isTaskCompleted } from '../../shared/utils/taskCompletion';

export function TaskItem({
  event,
  onToggleComplete,
  onTaskClick,
  onDuplicate,
  onDelete,
  onMove,
  extraBadges,
  actions,
  extraActions,
  onCarryOver,
  hideCheckboxOnOverdue = false,
  onCreateCopy
}: {
  event: CalendarEvent;
  onToggleComplete: () => void;
  onTaskClick: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  extraBadges?: ReactNode;
  actions?: ReactNode;
  extraActions?: Array<{
    value: string;
    label: string;
    icon: ReactNode;
    onClick: (task: CalendarEvent) => void;
  }>;
  onCarryOver?: (taskId: string, targetDate: Date) => void;
  hideCheckboxOnOverdue?: boolean;
  onCreateCopy?: (event: CalendarEvent) => void;
}) {
  // Check if task is overdue (has due date in the past and not completed)
  const now = new Date();
  const completed = isTaskCompleted(event);
  const isOverdue = event.dueDate && new Date(event.dueDate) < now && !completed;
  const [showCarryOver, setShowCarryOver] = useState(false);
  const isExternal = event.type === 'external';

  return (
    <>
      <Box
        data-priority={event.priority || 'none'}
        data-calendar-color={isExternal ? event.externalCalendarColor : undefined}
        data-is-external={isExternal}
        onClick={isExternal ? undefined : onTaskClick}
        borderColor="border.default"
        borderLeftWidth="4px"
        borderLeftColor="colorPalette.default"
        borderRadius="md"
        borderWidth="1px"
        w="full"
        p="3"
        transition="all 0.2s"
        className={css({
          cursor: 'pointer',
          bg: 'bg.default',
          '&[data-is-external=true]': {
            cursor: 'default',
            bg: 'bg.subtle'
          },
          '&[data-is-external=false]:hover': {
            bg: 'bg.subtle',
            boxShadow: 'sm'
          }
        })}
      >
        <HStack gap="2" justify="space-between" alignItems="center">
          <HStack flex="1" gap="2" alignItems="center">
            {isExternal ? (
              <Box color="colorPalette.default">
                <Calendar width="20" height="20" />
              </Box>
            ) : !(isOverdue && hideCheckboxOnOverdue) ? (
              <Checkbox
                size="sm"
                checked={completed}
                onCheckedChange={onToggleComplete}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
            <VStack flex="1" gap="1" alignItems="start">
              <HStack gap="2" alignItems="center" flexWrap="wrap">
                <LinkifiedText
                  color={completed ? 'fg.subtle' : 'fg.default'}
                  textDecoration={completed ? 'line-through' : 'none'}
                  fontSize="sm"
                  fontWeight="medium"
                  lineClamp="2"
                >
                  {event.title}
                </LinkifiedText>
                {event.link && (
                  <IconButton
                    asChild
                    variant="ghost"
                    size="xs"
                    aria-label="Open link"
                    onClick={(e) => e.stopPropagation()}
                    colorPalette="gray"
                  >
                    <a href={event.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink width="14" height="14" />
                    </a>
                  </IconButton>
                )}
                {isExternal && event.externalCalendarName && (
                  <Box data-calendar-color={event.externalCalendarColor}>
                    <Badge variant="subtle" size="sm">
                      {event.externalCalendarName}
                    </Badge>
                  </Box>
                )}
                {event.priority && <PriorityBadge priority={event.priority} size="sm" />}
                {extraBadges}
              </HStack>
              <HStack gap="2" flexWrap="wrap">
                {event.dueDate && !completed && <Countdown targetDate={event.dueDate} size="sm" />}
                {event.labels && event.labels.length > 0 && (
                  <>
                    {event.labels.slice(0, 2).map((label) => (
                      <Badge key={label} variant="subtle" size="sm">
                        {label}
                      </Badge>
                    ))}
                    {event.labels.length > 2 && (
                      <Text color="fg.muted" fontSize="xs">
                        +{event.labels.length - 2}
                      </Text>
                    )}
                  </>
                )}
              </HStack>
            </VStack>
          </HStack>
          <HStack gap="1" flexShrink={0}>
            {isExternal && onCreateCopy ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateCopy(event);
                }}
              >
                <Copy width="14" height="14" />
                Create Task
              </Button>
            ) : (
              <>
                {isOverdue && hideCheckboxOnOverdue && onCarryOver && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCarryOver(!showCarryOver);
                    }}
                    colorPalette="orange"
                  >
                    <ArrowRight width="14" height="14" />
                    {showCarryOver ? 'Cancel' : 'Carry Over'}
                  </Button>
                )}
                <TaskActionsMenu
                  task={event}
                  onEdit={() => onTaskClick()}
                  {...(onDuplicate && { onDuplicate: () => onDuplicate() })}
                  {...(onDelete && { onDelete: () => onDelete() })}
                  {...(onMove && { onMove: () => onMove() })}
                  size="sm"
                  extraActions={extraActions}
                />
                {actions}
              </>
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Carry Over Dialog */}
      {isOverdue && hideCheckboxOnOverdue && onCarryOver && (
        <CarryOverControls
          open={showCarryOver}
          onOpenChange={setShowCarryOver}
          onCarryOver={(targetDate) => {
            onCarryOver(event.id, targetDate);
          }}
          buttonText="Move Task"
          colorPalette="orange"
        />
      )}
    </>
  );
}
