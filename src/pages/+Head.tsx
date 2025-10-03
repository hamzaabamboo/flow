import { getAssetUrl } from '~/utils/assets';

export function Head() {
  return (
    <>
      <link rel="manifest" href={getAssetUrl('/manifest.webmanifest')} />
      <link rel="apple-touch-icon" href={getAssetUrl('/apple-touch-icon-180x180.png')} />
      <meta name="theme-color" content="#3b82f6" />
    </>
  );
}
