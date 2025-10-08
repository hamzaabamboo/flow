import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { CreateToasterReturn } from '@ark-ui/react';
import { setGlobalToast } from '../hooks/useWebSocket';
import { ToasterContext } from './ToasterContext';

const LazyToast = lazy(() =>
  import('../components/Layout/ToastContent').then((module) => ({ default: module.ToastContent }))
);

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toaster, setToaster] = useState<CreateToasterReturn>();

  useEffect(() => {
    void import('@ark-ui/react/toast').then(({ createToaster }) => {
      const toaster = createToaster({
        placement: 'bottom-end',
        max: 10,
        overlap: true,
        duration: 8000 // Longer duration for reminders
      });
      setToaster(toaster);

      // Register global toast for WebSocket reminders
      const toastFn = (message: string, options?: { type?: 'success' | 'error' | 'info' }) => {
        toaster.create({
          description: message,
          type: 'info',
          ...options
        });
      };
      setGlobalToast(toastFn);
      return Promise.resolve();
    });
  }, []);

  return (
    <ToasterContext.Provider
      value={{
        toast: (message, options) => {
          toaster?.create({
            description: message,
            type: 'info',
            ...options
          });
        }
      }}
    >
      {children}
      {toaster && (
        <Suspense fallback={<></>}>
          <LazyToast toaster={toaster} />
        </Suspense>
      )}
    </ToasterContext.Provider>
  );
}
