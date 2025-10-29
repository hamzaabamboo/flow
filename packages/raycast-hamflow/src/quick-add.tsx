import { useState, useEffect } from 'react';
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  popToRoot,
  open,
  Icon,
  LaunchProps
} from '@raycast/api';
import { format } from 'date-fns';
import { api } from './lib/api';
import { getPreferences } from './utils/preferences';
import type { Board } from './lib/types';

interface QuickAddArguments {
  title?: string;
}

function QuickAddTask(props: LaunchProps<{ arguments: QuickAddArguments }>) {
  const { title: initialTitle = '' } = props.arguments;
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [space, setSpace] = useState<'work' | 'personal'>('work');
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const prefs = getPreferences();

  // Fetch boards when space changes
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const boardsData = await api.getBoards(space);
        setBoards(boardsData);
        if (boardsData.length > 0) {
          setSelectedBoardId(boardsData[0].id);
          if (boardsData[0].columns.length > 0) {
            setSelectedColumnId(boardsData[0].columns[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch boards:', error);
      }
    };
    fetchBoards();
  }, [space]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Title Required',
        message: 'Please enter a task title'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Combine date and time if both provided
      let combinedDateTime: string | undefined;
      if (dueDate) {
        const dateStr = format(dueDate, 'yyyy-MM-dd');
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
        priority: priority === 'none' ? undefined : priority,
        columnId: selectedColumnId || undefined
      });

      await showToast({
        style: Toast.Style.Success,
        title: 'Task Created',
        message: `"${task.title}" added`
      });

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create task'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndAddAnother = async () => {
    if (!title.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Title Required',
        message: 'Please enter a task title'
      });
      return;
    }

    setIsLoading(true);

    try {
      let combinedDateTime: string | undefined;
      if (dueDate) {
        const dateStr = format(dueDate, 'yyyy-MM-dd');
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
        priority: priority === 'none' ? undefined : priority,
        columnId: selectedColumnId || undefined
      });

      await showToast({
        style: Toast.Style.Success,
        title: 'Task Created',
        message: `"${task.title}" added`
      });

      // Reset form
      setTitle('');
      setDescription('');
      setDueDate(null);
      setDueTime('');
      setPriority('medium');
      // Keep board/column selection
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create task'
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
          <Action.SubmitForm title="Create Task" icon={Icon.Check} onSubmit={handleSubmit} />
          <Action
            title="Create & Add Another"
            icon={Icon.Plus}
            shortcut={{ modifiers: ['cmd'], key: 'n' }}
            onAction={handleCreateAndAddAnother}
          />
          <Action
            title="Open HamFlow"
            icon={Icon.Globe}
            shortcut={{ modifiers: ['cmd'], key: 'o' }}
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

      <Form.Dropdown
        id="space"
        title="Space"
        value={space}
        onChange={(newSpace) => setSpace(newSpace as 'work' | 'personal')}
      >
        <Form.Dropdown.Item value="work" title="💼 Work" />
        <Form.Dropdown.Item value="personal" title="🏠 Personal" />
      </Form.Dropdown>

      {boards.length > 0 && (
        <>
          <Form.Dropdown
            id="board"
            title="Board"
            value={selectedBoardId}
            onChange={(newBoardId) => {
              setSelectedBoardId(newBoardId);
              const board = boards.find((b) => b.id === newBoardId);
              if (board && board.columns.length > 0) {
                setSelectedColumnId(board.columns[0].id);
              }
            }}
          >
            {boards.map((board) => (
              <Form.Dropdown.Item key={board.id} value={board.id} title={board.name} />
            ))}
          </Form.Dropdown>

          {selectedBoardId && boards.find((b) => b.id === selectedBoardId)?.columns && (
            <Form.Dropdown
              id="column"
              title="Column"
              value={selectedColumnId}
              onChange={setSelectedColumnId}
            >
              {boards
                .find((b) => b.id === selectedBoardId)
                ?.columns.map((column) => (
                  <Form.Dropdown.Item key={column.id} value={column.id} title={column.name} />
                ))}
            </Form.Dropdown>
          )}
        </>
      )}

      <Form.Separator />

      <Form.DatePicker id="dueDate" title="Due Date" value={dueDate} onChange={setDueDate} />

      <Form.TextField
        id="dueTime"
        title="Due Time"
        placeholder="HH:MM (e.g., 14:30)"
        value={dueTime}
        onChange={setDueTime}
        info="24-hour format (e.g., 09:00, 14:30)"
      />

      <Form.Dropdown id="priority" title="Priority" value={priority} onChange={setPriority}>
        <Form.Dropdown.Item value="none" title="None" />
        <Form.Dropdown.Item value="low" title="🟢 Low" />
        <Form.Dropdown.Item value="medium" title="🟡 Medium" />
        <Form.Dropdown.Item value="high" title="🟠 High" />
        <Form.Dropdown.Item value="urgent" title="🔴 Urgent" />
      </Form.Dropdown>
    </Form>
  );
}

export default QuickAddTask;
