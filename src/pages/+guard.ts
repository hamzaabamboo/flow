import { redirect } from 'vike/abort';
import type { PageContext } from 'vike/types';

export const guard = (pageContext: PageContext) => {
  const { urlPathname, user } = pageContext;

  // Allow access to login page
  if (urlPathname === '/login') {
    return;
  }

  // Check authentication
  if (!user) {
    throw redirect(`/login?returnUrl=${encodeURIComponent(urlPathname)}`);
  }
};
