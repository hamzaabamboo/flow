declare global {
  namespace Vike {
    interface PageContext {
      urlPathname: string;
      user?: {
        id: string;
        email: string;
        name: string;
      } | null;
    }
  }
}

declare module 'pino-http-print';
