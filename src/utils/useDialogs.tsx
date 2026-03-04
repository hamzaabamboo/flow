import {
  createContext,
  useContext,
  useState,
  lazy,
  Suspense,
  useCallback,
  useMemo,
  type ReactNode
} from 'react';

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

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertDialog({ options, resolve });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

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
    <DialogContext.Provider value={value}>
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
