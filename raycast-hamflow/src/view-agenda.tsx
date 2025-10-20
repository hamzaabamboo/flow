import { List, ActionPanel, Action, Icon, Color, open } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { format } from "date-fns";
import { api } from "./lib/api";
import type { CalendarEvent } from "./lib/types";
import { getPreferences } from "./utils/preferences";

function getPriorityIcon(priority?: string): {
  source: Icon;
  tintColor: Color;
} {
  switch (priority) {
    case "urgent":
      return { source: Icon.ExclamationMark, tintColor: Color.Red };
    case "high":
      return { source: Icon.ArrowUp, tintColor: Color.Orange };
    case "medium":
      return { source: Icon.Minus, tintColor: Color.Yellow };
    case "low":
      return { source: Icon.ArrowDown, tintColor: Color.Green };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

function getSpaceEmoji(space: string): string {
  return space === "work" ? "💼" : "🏠";
}

function getTimeGroup(date: string): string {
  const hour = new Date(date).getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function groupEventsByTime(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const now = new Date();
  const groups: Record<string, CalendarEvent[]> = {
    Overdue: [],
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  events.forEach((event) => {
    const eventDate = new Date(event.dueDate);
    if (eventDate < now && !event.completed) {
      groups.Overdue.push(event);
    } else {
      const timeGroup = getTimeGroup(event.dueDate);
      groups[timeGroup].push(event);
    }
  });

  return groups;
}

export default function ViewAgenda() {
  const prefs = getPreferences();

  const { data: events, isLoading, revalidate } = useCachedPromise(
    async () => {
      return await api.getTodayAgenda(prefs.defaultSpace);
    },
    [],
    {
      initialData: [],
    }
  );

  const groupedEvents = groupEventsByTime(events);

  const handleComplete = async (event: CalendarEvent) => {
    await api.completeTask(event.id);
    await revalidate();
  };

  const handleOpen = async (event: CalendarEvent) => {
    if (event.boardId) {
      await open(`${prefs.serverUrl}/board/${event.boardId}`);
    } else {
      const dateStr = format(new Date(event.dueDate), "yyyy-MM-dd");
      await open(`${prefs.serverUrl}/agenda?date=${dateStr}`);
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search today's tasks and habits">
      {Object.entries(groupedEvents).map(([group, groupEvents]) => {
        if (groupEvents.length === 0) return null;

        return (
          <List.Section key={group} title={group}>
            {groupEvents.map((event) => {
              const priorityIcon = getPriorityIcon(event.priority);
              const time = format(new Date(event.dueDate), "h:mm a");
              const subtitle = [
                time,
                event.boardName && `📋 ${event.boardName}`,
                event.columnName && `→ ${event.columnName}`,
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <List.Item
                  key={`${event.id}-${event.instanceDate || event.dueDate}`}
                  icon={priorityIcon}
                  title={`${getSpaceEmoji(event.space)} ${event.title}`}
                  subtitle={subtitle}
                  accessories={[
                    ...(event.completed
                      ? [{ icon: Icon.CheckCircle, tintColor: Color.Green }]
                      : []),
                    ...(event.type === "habit"
                      ? [{ tag: { value: "Habit", color: Color.Purple } }]
                      : []),
                  ]}
                  actions={
                    <ActionPanel>
                      {!event.completed && (
                        <Action
                          title="Mark Complete"
                          icon={Icon.Check}
                          onAction={() => handleComplete(event)}
                        />
                      )}
                      <Action
                        title="Open in HamFlow"
                        icon={Icon.Globe}
                        onAction={() => handleOpen(event)}
                      />
                      <Action
                        title="Refresh"
                        icon={Icon.ArrowClockwise}
                        onAction={revalidate}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                      />
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        );
      })}

      {events.length === 0 && !isLoading && (
        <List.EmptyView
          icon={Icon.Calendar}
          title="No events today"
          description="You're all caught up! 🎉"
        />
      )}
    </List>
  );
}
