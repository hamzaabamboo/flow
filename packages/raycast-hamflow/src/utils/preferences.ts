import { getPreferenceValues } from '@raycast/api';

interface Preferences {
  serverUrl: string;
  apiToken: string;
  defaultSpace: 'work' | 'personal';
}

export function getPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}
