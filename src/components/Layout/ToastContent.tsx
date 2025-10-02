import { X } from 'lucide-react';
import type { CreateToasterReturn } from '@ark-ui/react/toast';
import { IconButton } from '../ui/icon-button';
import * as Toast from '../ui/styled/toast';

export function ToastContent({ toaster }: { toaster: CreateToasterReturn }) {
  return (
    <Toast.Toaster toaster={toaster}>
      {(toast) => {
        return (
          <Toast.Root>
            <Toast.Title>{toast.title}</Toast.Title>
            <Toast.Description>{toast.description}</Toast.Description>
            <Toast.CloseTrigger asChild>
              <IconButton size="sm" variant="link">
                <X />
              </IconButton>
            </Toast.CloseTrigger>
          </Toast.Root>
        );
      }}
    </Toast.Toaster>
  );
}
