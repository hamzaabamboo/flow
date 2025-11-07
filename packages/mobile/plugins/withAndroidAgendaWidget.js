const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

/**
 * Adds Android Agenda Widget configuration to AndroidManifest.xml
 * and creates the necessary widget files
 */
function withAndroidAgendaWidget(config) {
  // Add widget receiver to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults
    )

    // Add widget receiver
    if (!mainApplication.receiver) {
      mainApplication.receiver = []
    }

    // Check if widget receiver already exists
    const hasWidgetReceiver = mainApplication.receiver.some((receiver) => {
      return receiver.$?.['android:name'] === '.AgendaWidgetProvider'
    })

    if (!hasWidgetReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.AgendaWidgetProvider',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/agenda_widget_info',
            },
          },
        ],
      })
    }

    // Add widget service
    if (!mainApplication.service) {
      mainApplication.service = []
    }

    const hasWidgetService = mainApplication.service.some((service) => {
      return service.$?.['android:name'] === '.AgendaWidgetService'
    })

    if (!hasWidgetService) {
      mainApplication.service.push({
        $: {
          'android:name': '.AgendaWidgetService',
          'android:permission': 'android.permission.BIND_REMOTEVIEWS',
          'android:exported': 'false',
        },
      })
    }

    return config
  })

  // Add widget files using dangerous mod
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      await createWidgetFiles(config.modRequest.projectRoot)
      await copyWidgetKotlinFiles(config.modRequest.projectRoot)
      return config
    },
  ])

  return config
}

async function copyWidgetKotlinFiles(projectRoot) {
  const packagePath = 'net/ham_san/flow/android'
  const srcPath = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    ...packagePath.split('/')
  )

  // Create package directory if it doesn't exist
  if (!fs.existsSync(srcPath)) {
    fs.mkdirSync(srcPath, { recursive: true })
  }

  // Copy widget provider Kotlin file
  const widgetKotlinPath = path.join(projectRoot, 'android-widget', 'AgendaWidgetProvider.kt')
  const destPath = path.join(srcPath, 'AgendaWidgetProvider.kt')

  if (fs.existsSync(widgetKotlinPath)) {
    fs.copyFileSync(widgetKotlinPath, destPath)
    console.log('✅ Widget Kotlin files copied successfully')
  } else {
    console.warn('⚠️  Widget Kotlin file not found, skipping copy')
  }
}

async function createWidgetFiles(projectRoot) {
  const androidPath = path.join(projectRoot, 'android', 'app', 'src', 'main')

  // Create res/xml directory if it doesn't exist
  const xmlPath = path.join(androidPath, 'res', 'xml')
  if (!fs.existsSync(xmlPath)) {
    fs.mkdirSync(xmlPath, { recursive: true })
  }

  // Create res/layout directory if it doesn't exist
  const layoutPath = path.join(androidPath, 'res', 'layout')
  if (!fs.existsSync(layoutPath)) {
    fs.mkdirSync(layoutPath, { recursive: true })
  }

  // Create widget info XML
  const widgetInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="900000"
    android:initialLayout="@layout/agenda_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/agenda_widget_description" />
`

  fs.writeFileSync(path.join(xmlPath, 'agenda_widget_info.xml'), widgetInfoXml)

  // Create widget layout XML
  const widgetLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="8dp"
    android:background="#FFFFFF">

    <TextView
        android:id="@+id/widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Today's Agenda"
        android:textSize="18sp"
        android:textStyle="bold"
        android:paddingBottom="8dp"
        android:textColor="#000000" />

    <ListView
        android:id="@+id/widget_task_list"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:divider="#E0E0E0"
        android:dividerHeight="1dp" />

    <TextView
        android:id="@+id/widget_empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:text="No tasks for today"
        android:gravity="center"
        android:textColor="#666666"
        android:visibility="gone" />

</LinearLayout>
`

  fs.writeFileSync(
    path.join(layoutPath, 'agenda_widget.xml'),
    widgetLayoutXml
  )

  // Create widget task item layout
  const taskItemLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:padding="8dp">

    <CheckBox
        android:id="@+id/task_checkbox"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:clickable="false"
        android:focusable="false" />

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:orientation="vertical"
        android:paddingStart="8dp">

        <TextView
            android:id="@+id/task_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="14sp"
            android:textColor="#000000"
            android:maxLines="2"
            android:ellipsize="end" />

        <TextView
            android:id="@+id/task_time"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="12sp"
            android:textColor="#666666" />

    </LinearLayout>

</LinearLayout>
`

  fs.writeFileSync(
    path.join(layoutPath, 'widget_task_item.xml'),
    taskItemLayoutXml
  )

  console.log('✅ Android widget files created successfully')
}

module.exports = createRunOncePlugin(
  withAndroidAgendaWidget,
  'withAndroidAgendaWidget',
  '1.0.0'
)
