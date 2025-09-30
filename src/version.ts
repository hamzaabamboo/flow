// This file tracks application version information
// You can update VERSION manually or use build scripts to auto-generate

/**
 * Application version from package.json
 */
export const VERSION = '1.0.0';

/**
 * Build timestamp - update during build process
 */
export const BUILD_TIMESTAMP = new Date().toISOString();

/**
 * Date formatter for version string (cached at module level)
 */
const versionDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

/**
 * Returns the application version with build information
 */
export const getVersionString = (): string => {
  return `v${VERSION} (Built: ${versionDateFormatter.format(new Date(BUILD_TIMESTAMP))})`;
};
