import { createContext, useContext } from 'react';

export const ToasterContext = createContext<{
  toast?: (
    message: string,
    options?: { title?: string; type?: 'success' | 'error' | 'info' | 'warning'; duration?: number }
  ) => void;
}>({});

export const useToaster = () => useContext(ToasterContext);
