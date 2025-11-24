package net.ham_san.flow.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

/**
 * Agenda Widget Provider for HamFlow
 * Displays today's tasks and habits on the home screen
 */
class AgendaWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update each widget instance
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Called when the first widget is added
    }

    override fun onDisabled(context: Context) {
        // Called when the last widget is removed
    }

    companion object {
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            // Create RemoteViews
            val views = RemoteViews(context.packageName, R.layout.agenda_widget)

            // Set up click intent to open app
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("hamflow://agenda")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_title, pendingIntent)

            // Fetch and display tasks (async in background)
            Thread {
                try {
                    val tasks = fetchTodaysTasks(context)

                    if (tasks.isEmpty()) {
                        views.setViewVisibility(R.id.widget_empty_view, android.view.View.VISIBLE)
                        views.setViewVisibility(R.id.widget_task_list, android.view.View.GONE)
                    } else {
                        views.setViewVisibility(R.id.widget_empty_view, android.view.View.GONE)
                        views.setViewVisibility(R.id.widget_task_list, android.view.View.VISIBLE)

                        // Set up ListView with adapter
                        val listIntent = Intent(context, AgendaWidgetService::class.java).apply {
                            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
                        }
                        views.setRemoteAdapter(R.id.widget_task_list, listIntent)
                    }

                    // Update widget on UI thread
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                } catch (e: Exception) {
                    e.printStackTrace()
                    // Show error state
                    views.setTextViewText(R.id.widget_title, "Error loading tasks")
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            }.start()
        }

        internal fun fetchTodaysTasks(context: Context): List<Task> {
            // Get stored API token and server URL from SharedPreferences
            val prefs = context.getSharedPreferences("hamflow_prefs", Context.MODE_PRIVATE)
            val token = prefs.getString("api_token", null) ?: return emptyList()
            val serverUrl = prefs.getString("server_url", "http://10.0.2.2:3000") ?: return emptyList()

            // Get today's date range
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            val startOfDay = calendar.timeInMillis / 1000

            calendar.set(Calendar.HOUR_OF_DAY, 23)
            calendar.set(Calendar.MINUTE, 59)
            calendar.set(Calendar.SECOND, 59)
            val endOfDay = calendar.timeInMillis / 1000

            // Fetch tasks from API
            val url = URL("$serverUrl/api/calendar?start=$startOfDay&end=$endOfDay")
            val connection = url.openConnection() as HttpURLConnection

            try {
                connection.requestMethod = "GET"
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Accept", "application/json")

                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().readText()
                    return parseTasksFromJson(response)
                }
            } finally {
                connection.disconnect()
            }

            return emptyList()
        }

        private fun parseTasksFromJson(json: String): List<Task> {
            val tasks = mutableListOf<Task>()
            val jsonArray = JSONArray(json)

            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.getJSONObject(i)

                // Only include tasks (not habits) that are not completed
                if (item.getString("type") == "task" && !item.getBoolean("completed")) {
                    tasks.add(
                        Task(
                            id = item.getString("id"),
                            title = item.getString("title"),
                            completed = item.getBoolean("completed"),
                            dueDate = if (item.has("dueDate")) item.getString("dueDate") else null,
                            priority = if (item.has("priority")) item.getString("priority") else "medium"
                        )
                    )
                }
            }

            // Sort by due date
            return tasks.sortedBy { it.dueDate }
        }
    }
}

/**
 * Data class for tasks
 */
data class Task(
    val id: String,
    val title: String,
    val completed: Boolean,
    val dueDate: String?,
    val priority: String
)

/**
 * Service to provide list data for the widget
 */
class AgendaWidgetService : android.widget.RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return AgendaRemoteViewsFactory(this.applicationContext, intent)
    }
}

/**
 * Factory to create views for the widget list
 */
class AgendaRemoteViewsFactory(
    private val context: Context,
    intent: Intent
) : android.widget.RemoteViewsService.RemoteViewsFactory {

    private var tasks = listOf<Task>()
    private val appWidgetId: Int = intent.getIntExtra(
        AppWidgetManager.EXTRA_APPWIDGET_ID,
        AppWidgetManager.INVALID_APPWIDGET_ID
    )

    override fun onCreate() {
        // Initialize
    }

    override fun onDataSetChanged() {
        // Fetch new data
        tasks = fetchTodaysTasks(context)
    }

    override fun onDestroy() {
        // Cleanup
    }

    override fun getCount(): Int = tasks.size

    override fun getViewAt(position: Int): RemoteViews {
        val task = tasks[position]
        val views = RemoteViews(context.packageName, R.layout.widget_task_item)

        // Set task data
        views.setTextViewText(R.id.task_title, task.title)
        views.setBoolean(R.id.task_checkbox, "setChecked", task.completed)

        // Format due date/time
        task.dueDate?.let { dueDate ->
            try {
                val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                val date = format.parse(dueDate)
                val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                views.setTextViewText(R.id.task_time, timeFormat.format(date))
            } catch (e: Exception) {
                views.setTextViewText(R.id.task_time, "")
            }
        } ?: run {
            views.setTextViewText(R.id.task_time, "No time set")
        }

        // Set click intent to open task detail
        val fillInIntent = Intent().apply {
            data = Uri.parse("hamflow://task/${task.id}")
        }
        views.setOnClickFillInIntent(R.id.task_checkbox, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true

    private fun fetchTodaysTasks(context: Context): List<Task> {
        // Reuse the same logic from AgendaWidgetProvider
        return AgendaWidgetProvider.fetchTodaysTasks(context)
    }
}
