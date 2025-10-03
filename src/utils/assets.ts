import { join } from 'path-browserify';

export const getAssetUrl = (path: string) => {
  return join(import.meta.env.BASE_URL ?? '/', path);
};
