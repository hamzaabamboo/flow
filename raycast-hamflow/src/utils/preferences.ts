import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  apiToken: string;
  serverUrl: string;
  defaultSpace: "work" | "personal";
}

export function getPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}
