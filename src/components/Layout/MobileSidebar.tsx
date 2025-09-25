import React from 'react';
import { Menu, X } from 'lucide-react';
import { Drawer } from '../ui/drawer';
import { IconButton } from '../ui/icon-button';
import { SidebarContent } from './SidebarContent';

export function MobileSidebar() {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <IconButton variant="ghost" size="sm" aria-label="Open menu">
          <Menu />
        </IconButton>
      </Drawer.Trigger>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger asChild position="absolute" top="3" right="4">
            <IconButton variant="ghost" size="sm" aria-label="Close menu">
              <X />
            </IconButton>
          </Drawer.CloseTrigger>
          <Drawer.Body>
            <Drawer.Context>
              {(ctx) => <SidebarContent onNavigate={() => ctx.setOpen(false)} />}
            </Drawer.Context>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
