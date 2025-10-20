import { useState } from "react";
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  popToRoot,
  open,
} from "@raycast/api";
import { format } from "date-fns";
import { api } from "./lib/api";
import { getPreferences } from "./utils/preferences";

export default function QuickAddTask() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [isLoading, setIsLoading] = useState(false);

  const prefs = getPreferences();

  const handleSubmit = async () => {
    if (!title.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Title Required",
        message: "Please enter a task title",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Combine date and time if both provided
      let combinedDateTime: string | undefined;
      if (dueDate) {
        const dateStr = format(dueDate, "yyyy-MM-dd");
        if (dueTime) {
          combinedDateTime = `${dateStr}T${dueTime}:00`;
        } else {
          combinedDateTime = `${dateStr}T09:00:00`;
        }
      }

      const task = await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: combinedDateTime,
        priority: priority === "none" ? undefined : priority,
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Task Created",
        message: `"${task.title}" added to inbox`,
      });

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create task",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndAddAnother = async () => {
    if (!title.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Title Required",
        message: "Please enter a task title",
      });
      return;
    }

    setIsLoading(true);

    try {
      let combinedDateTime: string | undefined;
      if (dueDate) {
        const dateStr = format(dueDate, "yyyy-MM-dd");
        if (dueTime) {
          combinedDateTime = `${dateStr}T${dueTime}:00`;
        } else {
          combinedDateTime = `${dateStr}T09:00:00`;
        }
      }

      const task = await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: combinedDateTime,
        priority: priority === "none" ? undefined : priority,
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Task Created",
        message: `"${task.title}" added`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setDueDate(null);
      setDueTime("");
      setPriority("medium");
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create task",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
          <Action
            title="Create & Add Another"
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            onAction={handleCreateAndAddAnother}
          />
          <Action
            title="Open HamFlow"
            shortcut={{ modifiers: ["cmd"], key: "o" }}
            onAction={() => open(prefs.serverUrl)}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Enter task title"
        value={title}
        onChange={setTitle}
        autoFocus
      />

      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Add more details (optional)"
        value={description}
        onChange={setDescription}
      />

      <Form.Separator />

      <Form.DatePicker
        id="dueDate"
        title="Due Date"
        value={dueDate}
        onChange={setDueDate}
      />

      <Form.TextField
        id="dueTime"
        title="Due Time"
        placeholder="HH:MM (e.g., 14:30)"
        value={dueTime}
        onChange={setDueTime}
        info="24-hour format (e.g., 09:00, 14:30)"
      />

      <Form.Dropdown
        id="priority"
        title="Priority"
        value={priority}
        onChange={setPriority}
      >
        <Form.Dropdown.Item value="none" title="None" />
        <Form.Dropdown.Item value="low" title="Low" />
        <Form.Dropdown.Item value="medium" title="Medium" />
        <Form.Dropdown.Item value="high" title="High" />
        <Form.Dropdown.Item value="urgent" title="Urgent" />
      </Form.Dropdown>

      <Form.Description
        title="Space"
        text={`Tasks will be created in ${prefs.defaultSpace} space (configure in preferences)`}
      />
    </Form>
  );
}
