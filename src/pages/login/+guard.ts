import { redirect } from 'vike/abort';

export const guard = (pageContext: Vike.PageContext) => {
  const { user } = pageContext;

  // If already authenticated, redirect to home
  if (user) {
    throw redirect('/');
  }
};
