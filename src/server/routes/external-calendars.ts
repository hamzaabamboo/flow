import { Elysia, t } from 'elysia';
import { db } from '../db';
import { externalCalendars } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import { validateIcalUrl } from '../utils/ical-parser';

export const externalCalendarsRoutes = new Elysia({ prefix: '/external-calendars' })
  .decorate('db', db)
  .group('', (app) =>
    app
      .use(withAuth())
      // List user's external calendars
      .get('/', async ({ user, db }) => {
        try {
          const calendars = await db
            .select()
            .from(externalCalendars)
            .where(eq(externalCalendars.userId, user.id));

          return calendars;
        } catch (error) {
          logger.error(error, 'Failed to fetch external calendars');
          throw error;
        }
      })
      // Add new external calendar
      .post(
        '/',
        async ({ user, db, body, set }) => {
          try {
            // Validate the iCal URL first
            const validation = await validateIcalUrl(body.icalUrl);
            if (!validation.valid) {
              set.status = 400;
              return {
                error: validation.error || 'Invalid iCal URL'
              };
            }

            // Insert the calendar
            const [calendar] = await db
              .insert(externalCalendars)
              .values({
                userId: user.id,
                name: body.name,
                icalUrl: body.icalUrl,
                space: body.space,
                color: body.color,
                enabled: true
              })
              .returning();

            return calendar;
          } catch (error) {
            logger.error(error, 'Failed to create external calendar');
            set.status = 500;
            return {
              error: 'Failed to create external calendar'
            };
          }
        },
        {
          body: t.Object({
            name: t.String(),
            icalUrl: t.String(),
            space: t.Union([t.Literal('work'), t.Literal('personal')]),
            color: t.String()
          })
        }
      )
      // Update external calendar
      .patch(
        '/:id',
        async ({ user, db, params, body, set }) => {
          try {
            // Verify ownership
            const existing = await db
              .select()
              .from(externalCalendars)
              .where(
                and(eq(externalCalendars.id, params.id), eq(externalCalendars.userId, user.id))
              )
              .limit(1);

            if (existing.length === 0) {
              set.status = 404;
              return { error: 'Calendar not found' };
            }

            // Validate URL if it's being updated
            if (body.icalUrl && body.icalUrl !== existing[0].icalUrl) {
              const validation = await validateIcalUrl(body.icalUrl);
              if (!validation.valid) {
                set.status = 400;
                return {
                  error: validation.error || 'Invalid iCal URL'
                };
              }
            }

            // Update the calendar
            const [updated] = await db
              .update(externalCalendars)
              .set({
                ...body,
                updatedAt: new Date()
              })
              .where(
                and(eq(externalCalendars.id, params.id), eq(externalCalendars.userId, user.id))
              )
              .returning();

            return updated;
          } catch (error) {
            logger.error(error, 'Failed to update external calendar');
            set.status = 500;
            return {
              error: 'Failed to update external calendar'
            };
          }
        },
        {
          params: t.Object({
            id: t.String()
          }),
          body: t.Partial(
            t.Object({
              name: t.String(),
              icalUrl: t.String(),
              space: t.Union([t.Literal('work'), t.Literal('personal')]),
              color: t.String(),
              enabled: t.Boolean()
            })
          )
        }
      )
      // Delete external calendar
      .delete(
        '/:id',
        async ({ user, db, params, set }) => {
          try {
            // Verify ownership and delete
            const [deleted] = await db
              .delete(externalCalendars)
              .where(
                and(eq(externalCalendars.id, params.id), eq(externalCalendars.userId, user.id))
              )
              .returning();

            if (!deleted) {
              set.status = 404;
              return { error: 'Calendar not found' };
            }

            return { success: true };
          } catch (error) {
            logger.error(error, 'Failed to delete external calendar');
            set.status = 500;
            return {
              error: 'Failed to delete external calendar'
            };
          }
        },
        {
          params: t.Object({
            id: t.String()
          })
        }
      )
  );
