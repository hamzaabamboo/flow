import { redirect } from 'vike/abort';

export const guard = (pageContext: Vike.PageContext) => {
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
