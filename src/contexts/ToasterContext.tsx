import type { CreateToasterReturn } from '@ark-ui/react';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

type ToastOptions = Parameters<CreateToasterReturn['create']>[0];
export const ToasterContext = createContext<{
  toast?: (msg: ReactNode, options?: ToastOptions) => void;
}>({});

export const useToaster = () => useContext(ToasterContext);
