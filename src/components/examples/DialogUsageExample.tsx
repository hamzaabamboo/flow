// Example of how to use the new Ark UI 5.25 Dialog pattern with useDialogContext

import React from 'react';
import * as Dialog from '../ui/styled/dialog';
import { Button } from '../ui/button';
import { EnhancedTaskDialogV2 } from '../ui/EnhancedTaskDialogV2';

// Example 1: Simple Dialog with useDialogContext
export function SimpleDialogExample() {
  const dialog = Dialog.useDialogContext();

  return (
    <>
      {/* Button to open dialog programmatically */}
      <Button onClick={() => dialog.setOpen(true)}>Open Simple Dialog</Button>

      <Dialog.RootProvider value={dialog}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Simple Dialog Title</Dialog.Title>
              <Dialog.Description>
                This is a simple dialog using the new pattern.
              </Dialog.Description>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.RootProvider>
    </>
  );
}

// Example 2: Task Dialog Usage
export function TaskDialogExample() {
  const taskDialog = Dialog.useDialogContext();

  const handleTaskSubmit = (taskData: Record<string, unknown>) => {
    console.log('Task submitted:', taskData);
    // Handle task creation/update here
  };

  const columns = [
    { id: '1', name: 'To Do' },
    { id: '2', name: 'In Progress' },
    { id: '3', name: 'Done' }
  ];

  return (
    <>
      {/* Button to open task dialog */}
      <Button onClick={() => taskDialog.setOpen(true)}>Create New Task</Button>

      {/* Enhanced Task Dialog */}
      <EnhancedTaskDialogV2
        dialog={taskDialog}
        mode="create"
        onSubmit={handleTaskSubmit}
        defaultColumnId="1"
        columns={columns}
      />
    </>
  );
}

// Example 3: Dialog with Trigger (hybrid approach)
export function HybridDialogExample() {
  const dialog = Dialog.useDialogContext();

  return (
    <>
      {/* You can still use Dialog.Trigger if needed */}
      <Dialog.RootProvider value={dialog}>
        <Dialog.Trigger asChild>
          <Button>Open with Trigger</Button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Hybrid Dialog</Dialog.Title>
              <Dialog.Description>
                This dialog can be opened with either the trigger or programmatically.
              </Dialog.Description>

              {/* You can also control it programmatically from inside */}
              <Button onClick={() => dialog.setOpen(false)}>Close Programmatically</Button>

              {/* Or use the standard close trigger */}
              <Dialog.CloseTrigger>Close with Trigger</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.RootProvider>

      {/* Additional button to open programmatically */}
      <Button onClick={() => dialog.setOpen(true)}>Open Programmatically</Button>
    </>
  );
}

// Example 4: Multiple Dialogs
export function MultipleDialogsExample() {
  const confirmDialog = Dialog.useDialogContext();
  const detailsDialog = Dialog.useDialogContext();

  return (
    <>
      <Button onClick={() => confirmDialog.setOpen(true)}>Open Confirm Dialog</Button>
      <Button onClick={() => detailsDialog.setOpen(true)}>Open Details Dialog</Button>

      {/* First Dialog */}
      <Dialog.RootProvider value={confirmDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Confirm Action</Dialog.Title>
              <Dialog.Description>Are you sure you want to proceed?</Dialog.Description>
              <Button onClick={() => confirmDialog.setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  confirmDialog.setOpen(false);
                  detailsDialog.setOpen(true);
                }}
              >
                Confirm and Show Details
              </Button>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.RootProvider>

      {/* Second Dialog */}
      <Dialog.RootProvider value={detailsDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Details</Dialog.Title>
              <Dialog.Description>Here are the details of your action.</Dialog.Description>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.RootProvider>
    </>
  );
}
