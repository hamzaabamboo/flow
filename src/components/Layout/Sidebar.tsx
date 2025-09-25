import React from 'react';
import { SidebarContent } from './SidebarContent';
import { Box } from 'styled-system/jsx';

export function Sidebar() {
  return (
    <Box
      display="flex"
      zIndex="40"
      position="fixed"
      top="0"
      left="0"
      flexDirection="column"
      borderColor="border.default"
      borderRightWidth="1px"
      width="280px"
      height="100vh"
      bg="bg.default"
      overflow="hidden"
    >
      <SidebarContent />
    </Box>
  );
}
