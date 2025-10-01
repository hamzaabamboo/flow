declare global {
  namespace Vike {
    interface PageContext {
      user?: {
        id: string;
        email: string;
        name: string;
      } | null;
    }
  }
}

export {};
