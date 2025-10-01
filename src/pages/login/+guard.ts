import { redirect } from 'vike/abort';
import type { PageContext } from 'vike/types';

export const guard = (pageContext: PageContext) => {
  const { user } = pageContext;

  // If already authenticated, redirect to home
  if (user) {
    throw redirect('/');
  }
};
