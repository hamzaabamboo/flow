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

// oxlint-disable-next-line require-module-specifiers
export {};
