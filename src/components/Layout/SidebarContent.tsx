import React from 'react';
import {
  LayoutGrid,
  Calendar,
  Inbox,
  Target,
  BarChart3,
  Briefcase,
  Home,
  Command,
  Timer,
  LogOut
} from 'lucide-react';
import { useSpace } from '../../contexts/SpaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Link } from '../ui/link';
import { Avatar } from '../ui/avatar';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { Box, VStack, HStack, Divider } from 'styled-system/jsx';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Boards', href: '/', icon: LayoutGrid },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Inbox', href: '/inbox', icon: Inbox, badge: 3 },
  { label: 'Habits', href: '/habits', icon: Target },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 }
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function isActiveRoute(href: string, currentPath: string): boolean {
  if (href === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(href);
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { currentSpace, toggleSpace } = useSpace();
  const { user, logout } = useAuth();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <VStack gap="0" h="full">
      {/* Space Switcher */}
      <Box w="full" p="4">
        <Button
          onClick={toggleSpace}
          variant="outline"
          size="lg"
          colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}
          gap="3"
          justifyContent="flex-start"
          borderRadius="lg"
          w="full"
        >
          {currentSpace === 'work' ? (
            <Briefcase width="20" height="20" />
          ) : (
            <Home width="20" height="20" />
          )}
          <Text fontWeight="semibold" textTransform="capitalize">
            {currentSpace} Space
          </Text>
        </Button>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <VStack flex="1" gap="1" w="full" p="4">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = isActiveRoute(item.href, currentPath);

          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} style={{ width: '100%' }}>
              <Button
                variant="ghost"
                size="lg"
                data-active={isActive ? 'true' : undefined}
                position="relative"
                justifyContent="flex-start"
                w="full"
                color={isActive ? 'colorPalette.default' : undefined}
                bg={isActive ? 'colorPalette.muted/10' : undefined}
                _hover={{ bg: 'bg.subtle' }}
              >
                <IconComponent style={{ marginRight: '12px' }} width="20" height="20" />
                {item.label}
                {item.badge && (
                  <Box
                    colorPalette="red"
                    borderRadius="full"
                    ml="auto"
                    py="0.5"
                    px="2"
                    color="colorPalette.fg"
                    fontSize="xs"
                    fontWeight="bold"
                    bg="colorPalette.default"
                  >
                    {item.badge}
                  </Box>
                )}
              </Button>
            </Link>
          );
        })}
      </VStack>

      <Divider />

      {/* Quick Actions */}
      <VStack gap="1" w="full" p="4">
        <Button variant="ghost" size="md" justifyContent="flex-start" w="full" color="fg.muted">
          <Command style={{ marginRight: '12px' }} width="20" height="20" />
          Command
          <Box ml="auto" color="fg.subtle" fontSize="xs">
            ⌘K
          </Box>
        </Button>

        <Button variant="ghost" size="md" justifyContent="flex-start" w="full" color="fg.muted">
          <Timer style={{ marginRight: '12px' }} width="20" height="20" />
          Timer
        </Button>
      </VStack>

      <Divider />

      {/* User Section */}
      <Box w="full" p="4">
        <HStack gap="3" alignItems="center">
          <Avatar name={user?.email || 'User'} size="sm" />
          <Box flex="1" minW="0">
            <Text
              fontSize="sm"
              fontWeight="medium"
              textOverflow="ellipsis"
              overflow="hidden"
              whiteSpace="nowrap"
            >
              {user?.email}
            </Text>
          </Box>
          <IconButton variant="ghost" size="sm" onClick={() => void logout()} aria-label="Logout">
            <LogOut />
          </IconButton>
        </HStack>
      </Box>
    </VStack>
  );
}
