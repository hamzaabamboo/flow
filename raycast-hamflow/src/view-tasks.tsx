import { useState } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  open,
  showToast,
  Toast,
  confirmAlert,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { format } from "date-fns";
import { api } from "./lib/api";
import type { Task } from "./lib/types";
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

function getSpaceEmoji(space?: string): string {
  return space === "work" ? "💼" : "🏠";
}

export default function ViewTasks() {
  const [searchText, setSearchText] = useState("");
  const [spaceFilter, setSpaceFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const prefs = getPreferences();

  const { data: tasks = [], isLoading, revalidate } = useCachedPromise(
    async (search: string, space: string, priority: string) => {
      return await api.getTasks({
        search: search || undefined,
        space: space === "all" ? undefined : (space as "work" | "personal"),
        priority: priority === "all" ? undefined : priority,
        sortBy: "dueDate",
      });
    },
    [searchText, spaceFilter, priorityFilter],
    {
      keepPreviousData: true,
    }
  );

  const handleComplete = async (task: Task) => {
    try {
      await api.completeTask(task.id);
      await showToast({
        style: Toast.Style.Success,
        title: "Task Completed",
        message: task.title,
      });
      await revalidate();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to complete task",
      });
    }
  };

  const handleDelete = async (task: Task) => {
    const confirmed = await confirmAlert({
      title: "Delete Task",
      message: `Are you sure you want to delete "${task.title}"?`,
      primaryAction: {
        title: "Delete",
        style: Action.Style.Destructive,
      },
    });

    if (confirmed) {
      try {
        await api.deleteTask(task.id);
        await showToast({
          style: Toast.Style.Success,
          title: "Task Deleted",
        });
        await revalidate();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: error instanceof Error ? error.message : "Failed to delete task",
        });
      }
    }
  };

  const handleOpen = async (task: Task) => {
    if (task.boardId) {
      await open(`${prefs.serverUrl}/board/${task.boardId}`);
    } else if (task.dueDate) {
      const dateStr = format(new Date(task.dueDate), "yyyy-MM-dd");
      await open(`${prefs.serverUrl}/agenda?date=${dateStr}`);
    } else {
      await open(`${prefs.serverUrl}/tasks`);
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search tasks..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Space"
          value={spaceFilter}
          onChange={setSpaceFilter}
        >
          <List.Dropdown.Item title="All Spaces" value="all" />
          <List.Dropdown.Item title="💼 Work" value="work" />
          <List.Dropdown.Item title="🏠 Personal" value="personal" />
        </List.Dropdown>
      }
      filtering={false}
    >
      <List.Dropdown tooltip="Filter by Priority" value={priorityFilter} onChange={setPriorityFilter}>
        <List.Dropdown.Item title="All Priorities" value="all" />
        <List.Dropdown.Item title="Urgent" value="urgent" />
        <List.Dropdown.Item title="High" value="high" />
        <List.Dropdown.Item title="Medium" value="medium" />
        <List.Dropdown.Item title="Low" value="low" />
      </List.Dropdown>

      {tasks.map((task) => {
        const priorityIcon = getPriorityIcon(task.priority);
        const subtitle = [
          task.dueDate && format(new Date(task.dueDate), "MMM d, h:mm a"),
          task.boardName && `📋 ${task.boardName}`,
          task.columnName && `→ ${task.columnName}`,
        ]
          .filter(Boolean)
          .join(" • ");

        const accessories: List.Item.Accessory[] = [];
        if (task.labels && task.labels.length > 0) {
          task.labels.forEach((label) => {
            accessories.push({ tag: label });
          });
        }

        return (
          <List.Item
            key={task.id}
            icon={priorityIcon}
            title={`${getSpaceEmoji(task.boardSpace)} ${task.title}`}
            subtitle={subtitle}
            accessories={accessories}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action
                    title="Open in HamFlow"
                    icon={Icon.Globe}
                    onAction={() => handleOpen(task)}
                  />
                  {task.columnName?.toLowerCase() !== "done" && (
                    <Action
                      title="Mark Complete"
                      icon={Icon.Check}
                      shortcut={{ modifiers: ["cmd"], key: "e" }}
                      onAction={() => handleComplete(task)}
                    />
                  )}
                </ActionPanel.Section>

                <ActionPanel.Section>
                  <Action
                    title="Delete Task"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                    onAction={() => handleDelete(task)}
                  />
                </ActionPanel.Section>

                <ActionPanel.Section>
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={revalidate}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}

      {tasks.length === 0 && !isLoading && (
        <List.EmptyView
          icon={Icon.CheckCircle}
          title="No Tasks Found"
          description={searchText ? "Try a different search" : "You're all caught up!"}
        />
      )}
    </List>
  );
}
