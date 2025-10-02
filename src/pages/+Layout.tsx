import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu, Search, Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SpaceProvider, useSpace } from '../contexts/SpaceContext';
import { ColorModeProvider } from '../contexts/ColorModeContext';
import { ToasterProvider } from '../contexts/ToasterProvider';
import { Sidebar } from '../components/Layout/Sidebar';
import { SidebarContent } from '../components/Layout/SidebarContent';
import { ColorModeToggle } from '../components/Layout/ColorModeToggle';
import { CommandBar } from '../components/CommandBar/CommandBar';
import { PomodoroTimer } from '../components/Pomodoro/PomodoroTimer';
import { NotificationDropdown } from '../components/Layout/NotificationDropdown';
import { useWebSocket } from '../hooks/useWebSocket';
import ErrorBoundary from '../components/utils/ErrorBoundary';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { IconButton } from '../components/ui/icon-button';
import { Drawer } from '../components/ui/drawer';
import { Box, Center, HStack } from 'styled-system/jsx';
import '../index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false
    }
  }
});

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { currentSpace } = useSpace();
  const [showCommandBar, setShowCommandBar] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandBar(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Box
        display="flex"
        zIndex="40"
        position="fixed"
        top="0"
        left={{ base: 0, lg: '280px' }}
        right="0"
        alignItems="center"
        borderColor="border.default"
        borderBottomWidth="1px"
        height="64px"
        px="6"
        bg="bg.default"
        bgColor="bg.default/90"
        transition="all 0.3s"
        backdropFilter="blur(10px)"
      >
        <HStack justifyContent="space-between" w="full">
          {/* Left side */}
          <HStack gap="4">
            <IconButton
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
              aria-label="Menu"
              display={{ base: 'flex', lg: 'none' }}
              color="fg.muted"
              _hover={{ bg: 'bg.subtle' }}
            >
              <Menu />
            </IconButton>

            {/* Search Bar */}
            <Button
              variant="outline"
              onClick={() => setShowCommandBar(true)}
              gap="3"
              justifyContent="flex-start"
              borderColor="border.default"
              borderRadius="xl"
              w={{ base: 'auto', md: '400px' }}
              color="fg.subtle"
              bg="bg.muted"
              _hover={{
                borderColor: `${currentSpace === 'work' ? 'blue' : 'purple'}.300`,
                bg: 'bg.default',
                boxShadow: 'sm'
              }}
            >
              <Search width="16" height="16" />
              <Text display={{ base: 'none', sm: 'inline' }}>Search or type a command...</Text>
              <Box
                display={{ base: 'none', md: 'flex' }}
                borderRadius="md"
                ml="auto"
                py="0.5"
                px="2"
                color="fg.muted"
                fontSize="xs"
                fontWeight="medium"
                bg="bg.subtle"
              >
                ⌘K
              </Box>
            </Button>
          </HStack>

          {/* Right side */}
          <HStack gap="2">
            <ColorModeToggle />

            <NotificationDropdown />

            <Button
              variant="solid"
              size="sm"
              gap="2"
              borderRadius="lg"
              transition="all 0.2s"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: 'lg'
              }}
            >
              <Sparkles width="16" height="16" />
              <Text display={{ base: 'none', sm: 'inline' }}>Quick Add</Text>
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Command Bar Dialog */}
      <CommandBar open={showCommandBar} onOpenChange={setShowCommandBar} />
    </>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentSpace } = useSpace();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useWebSocket();

  if (isLoading) {
    return (
      <Center minHeight="100vh" bg="bg.subtle">
        <Box textAlign="center">
          <Box
            borderColor="accent.default"
            borderTopColor="transparent"
            borderRadius="full"
            borderWidth="4px"
            w="16"
            h="16"
            mx="auto"
            mb="4"
            borderStyle="solid"
            animation="spin 1s linear infinite"
          />
          <Text color="fg.muted" fontSize="lg">
            Loading your workspace...
          </Text>
        </Box>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box colorPalette="blue" minHeight="100vh" bg="bg.subtle">
        {children}
      </Box>
    );
  }

  return currentSpace === 'work' ? (
    <Box colorPalette="blue">
      {/* Desktop Sidebar */}
      <Box display={{ base: 'none', lg: 'block' }}>
        <Sidebar />
      </Box>

      {/* Mobile Sidebar Drawer */}
      <Box display={{ base: 'block', lg: 'none' }}>
        <Drawer.Root
          variant="left"
          open={mobileSidebarOpen}
          onOpenChange={(details) => setMobileSidebarOpen(details.open)}
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Body>
                <SidebarContent />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      </Box>

      {/* Top Bar */}
      <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />

      {/* Main Content */}
      <Box
        as="main"
        position="relative"
        h="100vh"
        ml={{ base: 0, lg: '280px' }}
        pt="64px"
        bg="bg.subtle"
        overflowX="auto"
        transition="all 0.3s"
      >
        <Box
          position="absolute"
          w="full"
          maxW="1600px"
          minH="calc(100vh - 64px)"
          mx="auto"
          p={{ base: '4', md: '6', lg: '8' }}
        >
          {children}
        </Box>
      </Box>

      {/* Floating Pomodoro Timer */}
      <Box zIndex="30" position="fixed" right="6" bottom="6">
        <PomodoroTimer />
      </Box>
    </Box>
  ) : (
    <Box colorPalette="purple">
      {/* Desktop Sidebar */}
      <Box display={{ base: 'none', lg: 'block' }}>
        <Sidebar />
      </Box>

      {/* Mobile Sidebar Drawer */}
      <Box display={{ base: 'block', lg: 'none' }}>
        <Drawer.Root
          open={mobileSidebarOpen}
          variant="left"
          onOpenChange={(details) => setMobileSidebarOpen(details.open)}
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Body>
                <SidebarContent />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      </Box>

      {/* Top Bar */}
      <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />

      {/* Main Content */}
      <Box
        as="main"
        minHeight="calc(100vh - 64px)"
        ml={{ base: 0, lg: '280px' }}
        mt="64px"
        bg="bg.subtle"
        transition="all 0.3s"
      >
        <Box
          maxW="1600px"
          mx="auto"
          p={{ base: '4', md: '6', lg: '8' }}
          pb={{ base: '20', md: '8' }}
        >
          {children}
        </Box>
      </Box>

      {/* Floating Pomodoro Timer */}
      <Box zIndex="30" position="fixed" right="6" bottom="6">
        <PomodoroTimer />
      </Box>
    </Box>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <AuthProvider>
          <SpaceProvider>
            <ToasterProvider>
              <Box id="app">
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes slideDown {
                    from {
                      opacity: 0;
                      transform: translateY(-20px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                  @keyframes slideIn {
                    from {
                      transform: translateX(-100%);
                    }
                    to {
                      transform: translateX(0);
                    }
                  }
                `}</style>
                <ErrorBoundary>
                  <AppContent>{children}</AppContent>
                </ErrorBoundary>
              </Box>
            </ToasterProvider>
          </SpaceProvider>
        </AuthProvider>
      </ColorModeProvider>
    </QueryClientProvider>
  );
}
