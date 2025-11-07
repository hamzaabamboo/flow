const { AndroidConfig, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Adds Android share target configuration to AndroidManifest.xml
 * This allows the app to receive shared text and URLs from other apps
 */
function withAndroidShareTarget(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);

    // Add intent filter for sharing text and URLs
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    // Check if share intent filter already exists
    const hasShareIntent = mainActivity['intent-filter'].some((filter) => {
      const actions = filter.action || [];
      return actions.some((action) => action.$?.['android:name'] === 'android.intent.action.SEND');
    });

    if (!hasShareIntent) {
      mainActivity['intent-filter'].push({
        action: [
          {
            $: {
              'android:name': 'android.intent.action.SEND'
            }
          }
        ],
        category: [
          {
            $: {
              'android:name': 'android.intent.category.DEFAULT'
            }
          }
        ],
        data: [
          {
            $: {
              'android:mimeType': 'text/plain'
            }
          },
          {
            $: {
              'android:mimeType': 'text/*'
            }
          }
        ]
      });
    }

    return config;
  });
}

module.exports = createRunOncePlugin(withAndroidShareTarget, 'withAndroidShareTarget', '1.0.0');
