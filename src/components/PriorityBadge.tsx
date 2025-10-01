import { HStack } from '../../styled-system/jsx';
import { priorityConfig, type Priority } from '../utils/priority';
import { Badge } from './ui/badge';

interface PriorityBadgeProps {
  priority: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PriorityBadge({ priority, size = 'sm', showIcon = true }: PriorityBadgeProps) {
  const p = priority as Priority;
  const config = priorityConfig[p];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge size={size} variant="solid" colorPalette={config.color}>
      <HStack gap="1">
        {showIcon && <Icon width="14" height="14" />}
        <span>{config.label}</span>
      </HStack>
    </Badge>
  );
}
