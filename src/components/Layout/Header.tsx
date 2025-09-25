import { useSpace } from '../../contexts/SpaceContext';
import { CommandBar } from '../CommandBar/CommandBar';
import { Button } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack, Box } from 'styled-system/jsx';
export function Header() {
  const { currentSpace, toggleSpace } = useSpace();

  return (
    <Box
      as="header"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      borderColor="border.default"
      borderBottomWidth="1px"
      py="4"
      px="8"
      bg="bg.subtle"
    >
      <HStack gap="8" alignItems="center">
        <Heading size="2xl" fontWeight="bold">
          HamFlow
        </Heading>

        {/* Space Switcher */}
        <Button
          onClick={toggleSpace}
          variant="solid"
          colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}
          borderRadius="full"
          textTransform="capitalize"
        >
          {currentSpace} Mode
        </Button>
      </HStack>

      <Box flex="1" maxWidth="600px" mx="8">
        <CommandBar />
      </Box>

      <HStack as="nav" gap="4">
        <a
          href="/"
          style={{
            color: 'var(--colors-fg-muted)',
            textDecoration: 'none'
          }}
        >
          Boards
        </a>
        <a
          href="/agenda"
          style={{
            color: 'var(--colors-fg-muted)',
            textDecoration: 'none'
          }}
        >
          Agenda
        </a>
        <a
          href="/inbox"
          style={{
            color: 'var(--colors-fg-muted)',
            textDecoration: 'none'
          }}
        >
          Inbox
        </a>
        <a
          href="/habits"
          style={{
            color: 'var(--colors-fg-muted)',
            textDecoration: 'none'
          }}
        >
          Habits
        </a>
        <a
          href="/analytics"
          style={{
            color: 'var(--colors-fg-muted)',
            textDecoration: 'none'
          }}
        >
          Analytics
        </a>
      </HStack>
    </Box>
  );
}
