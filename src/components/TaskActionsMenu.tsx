import { MoreVertical, Edit2, Copy, MoveRight, Trash2 } from 'lucide-react';
import type { Task } from '../shared/types';
import type { CalendarEvent, ExtendedTask } from '../shared/types/calendar';
import { IconButton } from './ui/icon-button';
import * as Menu from './ui/styled/menu';
import { HStack } from 'styled-system/jsx';

type TaskLike = Task | CalendarEvent | ExtendedTask;

interface TaskActionsMenuProps<T extends TaskLike = TaskLike> {
  task: T;
  onEdit: (task: T) => void;
  onDelete?: (task: T) => void;
  onDuplicate?: (task: T) => void;
  onMove?: (task: T) => void;
  size?: 'xs' | 'sm' | 'md';
  extraActions?: Array<{
    value: string;
    label: string;
    icon: React.ReactNode;
    onClick: (task: T) => void;
  }>;
}

/**
 * Shared task actions menu component used across Board and Tasks pages.
 * Ensures consistent UI and feature parity between different views.
 */
export function TaskActionsMenu<T extends TaskLike = TaskLike>({
  task,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
  size = 'xs',
  extraActions
}: TaskActionsMenuProps<T>) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          size={size}
          aria-label="Task actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical width={size === 'xs' ? '14' : '16'} height={size === 'xs' ? '14' : '16'} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.ItemGroup>
            <Menu.Item value="edit" asChild>
              <HStack
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                gap="2"
              >
                <Edit2 width="16" height="16" />
                <Menu.ItemText>Edit</Menu.ItemText>
              </HStack>
            </Menu.Item>
            {onDuplicate && (
              <Menu.Item value="duplicate" asChild>
                <HStack
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(task);
                  }}
                  gap="2"
                >
                  <Copy width="16" height="16" />
                  <Menu.ItemText>Duplicate</Menu.ItemText>
                </HStack>
              </Menu.Item>
            )}
            {onMove && (
              <Menu.Item value="move" asChild>
                <HStack
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(task);
                  }}
                  gap="2"
                >
                  <MoveRight width="16" height="16" />
                  <Menu.ItemText>Move to Board</Menu.ItemText>
                </HStack>
              </Menu.Item>
            )}
            {extraActions?.map((action) => (
              <Menu.Item key={action.value} value={action.value} asChild>
                <HStack
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(task);
                  }}
                  gap="2"
                >
                  {action.icon}
                  <Menu.ItemText>{action.label}</Menu.ItemText>
                </HStack>
              </Menu.Item>
            ))}
            {onDelete && (
              <>
                <Menu.Separator />
                <Menu.Item value="delete" asChild>
                  <HStack
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task);
                    }}
                    gap="2"
                    color="red.default"
                  >
                    <Trash2 width="16" height="16" />
                    <Menu.ItemText>Delete</Menu.ItemText>
                  </HStack>
                </Menu.Item>
              </>
            )}
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
