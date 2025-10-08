import { createContext, useContext, useState, lazy, Suspense, type ReactNode } from 'react';

const DialogComponents = lazy(() =>
  import('./DialogComponents').then((module) => ({ default: module.DialogComponents }))
);

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

interface AlertOptions {
  title?: string;
  description: string;
  confirmText?: string;
  variant?: 'danger' | 'info';
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmDialog, setConfirmDialog] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    options: AlertOptions;
    resolve: () => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ options, resolve });
    });
  };

  const alert = (options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertDialog({ options, resolve });
    });
  };

  const handleConfirmClose = (confirmed: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(confirmed);
      setConfirmDialog(null);
    }
  };

  const handleAlertClose = () => {
    if (alertDialog) {
      alertDialog.resolve();
      setAlertDialog(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {(confirmDialog || alertDialog) && (
        <Suspense fallback={null}>
          <DialogComponents
            confirmDialog={confirmDialog}
            alertDialog={alertDialog}
            onConfirmClose={handleConfirmClose}
            onAlertClose={handleAlertClose}
          />
        </Suspense>
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogs must be used within DialogProvider');
  }
  return context;
}
