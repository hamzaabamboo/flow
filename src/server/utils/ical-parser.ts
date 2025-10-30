import ical from 'node-ical';
import type { CalendarEvent } from '../../shared/types/calendar';
import { logger } from '../logger';

interface ICalEvent {
  type: string;
  summary?: string;
  description?: string;
  start?: Date;
  end?: Date;
  rrule?: {
    between: (
      start: Date,
      end: Date,
      inc?: boolean,
      iterator?: (date: Date, i: number) => boolean
    ) => Date[];
  };
  uid?: string;
  location?: string;
  [key: string]: unknown;
}

/**
 * Fetch and parse an iCal feed from a URL
 */
export async function fetchAndParseIcal(url: string): Promise<Record<string, ICalEvent>> {
  try {
    // Fetch the .ics file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HamFlow/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed: ${response.status} ${response.statusText}`);
    }

    const icsData = await response.text();

    // Parse using node-ical
    const parsed = ical.parseICS(icsData);

    return parsed as Record<string, ICalEvent>;
  } catch (error) {
    logger.error(error, 'Failed to fetch or parse iCal feed');
    throw error;
  }
}

/**
 * Convert iCal events to CalendarEvent format
 */
export function convertIcalToEvents(
  icalData: Record<string, ICalEvent>,
  startDate: Date,
  endDate: Date,
  calendarId: string,
  calendarName: string,
  calendarColor: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const [key, component] of Object.entries(icalData)) {
    // Only process VEVENT components
    if (component.type !== 'VEVENT') {
      continue;
    }

    try {
      // Handle recurring events
      if (component.rrule) {
        const occurrences = component.rrule.between(startDate, endDate, true);

        for (const occurrence of occurrences) {
          events.push(
            createCalendarEvent(
              component,
              occurrence,
              calendarId,
              calendarName,
              calendarColor,
              `${key}-${occurrence.getTime()}`
            )
          );
        }
      } else if (component.start) {
        // Single event - check if it falls within the date range
        const eventStart = new Date(component.start);
        if (eventStart >= startDate && eventStart <= endDate) {
          events.push(
            createCalendarEvent(
              component,
              component.start,
              calendarId,
              calendarName,
              calendarColor,
              key
            )
          );
        }
      }
    } catch (error) {
      logger.error(error, `Failed to process iCal event: ${key}`);
      // Continue processing other events
    }
  }

  return events;
}

/**
 * Create a CalendarEvent from an iCal component
 */
function createCalendarEvent(
  component: ICalEvent,
  startDate: Date,
  calendarId: string,
  calendarName: string,
  calendarColor: string,
  eventId: string
): CalendarEvent {
  return {
    id: eventId,
    title: component.summary || 'Untitled Event',
    description: component.description || undefined,
    dueDate: startDate,
    type: 'external',
    externalCalendarId: calendarId,
    externalCalendarName: calendarName,
    externalCalendarColor: calendarColor,
    isExternal: true,
    completed: false,
    // External events don't have HamFlow-specific fields
    priority: undefined,
    labels: [],
    subtasks: []
  };
}

/**
 * Validate an iCal URL by attempting to fetch and parse it
 */
export async function validateIcalUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Basic URL validation
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol'
      };
    }

    // Try to fetch and parse
    await fetchAndParseIcal(url);

    return { valid: true };
  } catch (error) {
    logger.error(error, 'iCal URL validation failed');
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
