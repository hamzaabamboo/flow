import { redirect } from 'vike/abort';

export const guard = (pageContext: Vike.PageContext) => {
  const { user } = pageContext;

  if (user) {
    throw redirect('/');
  }
};
