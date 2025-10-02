import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { users } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';

// User preferences/settings
export const settingsRoutes = new Elysia({ prefix: '/settings' })
  .use(withAuth())

  // Get user settings
  .get('/', async ({ db, user }) => {
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    const userSettings =
      (dbUser?.settings as {
        eveningSummaryEnabled?: boolean;
        morningSummaryEnabled?: boolean;
        summarySpaces?: ('work' | 'personal')[];
      } | null) || {};

    // TODO: Store other settings (theme, defaultSpace, pomodoro, integrations) in users.settings
    // Currently only morningSummary, eveningSummary, and summarySpaces are persisted
    return {
      theme: 'light',
      defaultSpace: 'work',
      pomodoroSettings: {
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      },
      notifications: {
        enabled: true,
        reminders: true,
        pomodoroComplete: true,
        taskDue: true,
        morningSummary: userSettings.morningSummaryEnabled ?? false,
        eveningSummary: userSettings.eveningSummaryEnabled ?? false,
        summarySpaces: userSettings.summarySpaces ?? ['work', 'personal']
      },
      integrations: {
        hambot: false,
        github: false,
        slack: false
      },
      commandBar: {
        shortcuts: [
          { key: 'cmd+k', action: 'open_command_bar' },
          { key: 'cmd+shift+a', action: 'add_task' },
          { key: 'cmd+shift+n', action: 'add_note' }
        ]
      }
    };
  })

  // Update user settings
  .patch(
    '/',
    async ({ body, db, user }) => {
      // Update user settings in database
      if (body.notifications) {
        const [currentUser] = await db.select().from(users).where(eq(users.id, user.id));
        const existingSettings =
          (currentUser?.settings as {
            eveningSummaryEnabled?: boolean;
            morningSummaryEnabled?: boolean;
            summarySpaces?: ('work' | 'personal')[];
          } | null) || {};

        const newSettings = {
          ...existingSettings,
          ...(body.notifications.morningSummary !== undefined && {
            morningSummaryEnabled: body.notifications.morningSummary
          }),
          ...(body.notifications.eveningSummary !== undefined && {
            eveningSummaryEnabled: body.notifications.eveningSummary
          }),
          ...(body.notifications.summarySpaces !== undefined && {
            summarySpaces: body.notifications.summarySpaces
          })
        };

        await db.update(users).set({ settings: newSettings }).where(eq(users.id, user.id));
      }

      return {
        success: true,
        settings: body
      };
    },
    {
      body: t.Object({
        theme: t.Optional(t.Union([t.Literal('light'), t.Literal('dark'), t.Literal('auto')])),
        defaultSpace: t.Optional(t.Union([t.Literal('work'), t.Literal('personal')])),
        pomodoroSettings: t.Optional(
          t.Object({
            workDuration: t.Number(),
            shortBreakDuration: t.Number(),
            longBreakDuration: t.Number(),
            sessionsBeforeLongBreak: t.Number()
          })
        ),
        notifications: t.Optional(
          t.Object({
            enabled: t.Boolean(),
            reminders: t.Boolean(),
            pomodoroComplete: t.Boolean(),
            taskDue: t.Boolean(),
            morningSummary: t.Optional(t.Boolean()),
            eveningSummary: t.Optional(t.Boolean()),
            summarySpaces: t.Optional(t.Array(t.Union([t.Literal('work'), t.Literal('personal')])))
          })
        ),
        integrations: t.Optional(
          t.Object({
            hambot: t.Boolean(),
            github: t.Boolean(),
            slack: t.Boolean()
          })
        )
      })
    }
  )

  // Get keyboard shortcuts
  .get('/shortcuts', () => {
    return [
      { key: 'cmd+k', action: 'open_command_bar', description: 'Open command bar' },
      { key: 'cmd+shift+a', action: 'add_task', description: 'Quick add task' },
      { key: 'cmd+shift+n', action: 'add_note', description: 'Quick add note' },
      { key: 'cmd+/', action: 'search', description: 'Search tasks and boards' },
      { key: 'cmd+shift+p', action: 'start_pomodoro', description: 'Start/stop Pomodoro' },
      { key: 'g w', action: 'go_work', description: 'Go to work space' },
      { key: 'g p', action: 'go_personal', description: 'Go to personal space' },
      { key: 'g i', action: 'go_inbox', description: 'Go to inbox' }
    ];
  })

  // Update keyboard shortcuts
  .post(
    '/shortcuts',
    ({ body }) => {
      // Store custom shortcuts (would be saved to database)
      return {
        success: true,
        shortcuts: body.shortcuts
      };
    },
    {
      body: t.Object({
        shortcuts: t.Array(
          t.Object({
            key: t.String(),
            action: t.String(),
            description: t.Optional(t.String())
          })
        )
      })
    }
  )

  // Export user data
  .get('/export', ({ db: _db, user }) => {
    // Gather all user data for export
    // This would fetch from multiple tables
    return {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email
      },
      data: {
        boards: [],
        tasks: [],
        inboxItems: [],
        reminders: []
      }
    };
  })

  // Import user data
  .post(
    '/import',
    ({ body: _body, db: _db, user: _user }) => {
      // Import user data from backup
      // This would validate and insert into multiple tables
      return {
        success: true,
        imported: {
          boards: 0,
          tasks: 0,
          inboxItems: 0,
          reminders: 0
        }
      };
    },
    {
      body: t.Object({
        data: t.Object({
          boards: t.Optional(t.Array(t.Any())),
          tasks: t.Optional(t.Array(t.Any())),
          inboxItems: t.Optional(t.Array(t.Any())),
          reminders: t.Optional(t.Array(t.Any()))
        })
      })
    }
  )

  // Test HamBot integration (sends via HamBot)
  .post(
    '/test-summary',
    async ({ body, db, user }) => {
      const { sendDailySummary } = await import('../cron');

      const result = await sendDailySummary(user.id, body.type, body.spaces, db);

      if (!result.sent) {
        throw new Error('HamBot is not configured. Set HAMBOT_API_KEY environment variable.');
      }

      return {
        success: true,
        message: 'Test summary sent via HamBot',
        summary: result.summary
      };
    },
    {
      body: t.Object({
        type: t.Union([t.Literal('morning'), t.Literal('evening')]),
        spaces: t.Array(t.Union([t.Literal('work'), t.Literal('personal')]))
      })
    }
  );
