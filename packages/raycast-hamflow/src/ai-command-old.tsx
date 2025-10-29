import { useState, useEffect } from 'react';
import { Form, ActionPanel, Action, showToast, Toast, popToRoot, open } from '@raycast/api';
import { api } from './lib/api';
import { getPreferences } from './utils/preferences';
import type { Board } from './lib/types';

export default function AICommand() {
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<{
    action: string;
    data: Record<string, unknown>;
    description: string;
  } | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  const prefs = getPreferences();

  // Fetch boards when intent is parsed and it's a create_task action
  useEffect(() => {
    if (parsedIntent && parsedIntent.action === 'create_task') {
      const fetchBoards = async () => {
        try {
          // Fetch boards from the detected space, or all boards if space wasn't detected
          const detectedSpace = parsedIntent.data.space as 'work' | 'personal' | undefined;
          const fetchSpace = detectedSpace || prefs.defaultSpace;

          // Fetch boards from both spaces to give user full choice
          const workBoards = await api.getBoards('work');
          const personalBoards = await api.getBoards('personal');
          const boardsData = [...workBoards, ...personalBoards];
          setBoards(boardsData);

          // Pre-select board/column from AI suggestion
          const aiBoard = parsedIntent.data.boardId as string | undefined;
          const aiColumn = parsedIntent.data.columnId as string | undefined;

          if (aiBoard && aiColumn) {
            setSelectedBoardId(aiBoard);
            setSelectedColumnId(aiColumn);
          } else if (boardsData.length > 0) {
            // Default to first board and its first column
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
    } else {
      // Reset board selection
      setBoards([]);
      setSelectedBoardId('');
      setSelectedColumnId('');
    }
  }, [parsedIntent]);

  const handleParse = async () => {
    if (!command.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Empty Command',
        message: 'Please enter a command'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use "auto" to let AI detect work vs personal from task content
      const intent = await api.sendCommand(command, 'auto');
      setParsedIntent(intent);

      await showToast({
        style: Toast.Style.Success,
        title: 'Command Parsed',
        message: intent.description
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Parse Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!parsedIntent) return;

    setIsLoading(true);

    try {
      // Override board/column with user selection if it's a task
      let finalData = { ...parsedIntent.data };
      if (parsedIntent.action === 'create_task' && selectedBoardId && selectedColumnId) {
        finalData = {
          ...finalData,
          boardId: selectedBoardId,
          columnId: selectedColumnId,
          directToBoard: true
        };
      }

      const result = await api.executeCommand(parsedIntent.action, finalData, 'auto');

      await showToast({
        style: Toast.Style.Success,
        title: 'Success',
        message: `${parsedIntent.action} executed`
      });

      // If task was created on a board, offer to open it
      if (result.boardId) {
        const openUrl = `${prefs.serverUrl}/board/${result.boardId}`;
        await open(openUrl);
      }

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Execution Error',
        message: error instanceof Error ? error.message : 'Unknown error'
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
          {!parsedIntent ? (
            <Action title="Parse Command" onAction={handleParse} />
          ) : (
            <>
              <Action title="Execute" onAction={handleExecute} />
              <Action title="Edit Command" onAction={() => setParsedIntent(null)} />
            </>
          )}
        </ActionPanel>
      }
    >
      {!parsedIntent ? (
        <>
          <Form.TextField
            id="command"
            title="Command"
            placeholder='e.g., "deploy staging tomorrow at 3pm high priority"'
            value={command}
            onChange={setCommand}
            info="Use natural language to create tasks, reminders, or notes"
          />
          <Form.Description
            title="Examples"
            text={`• "add fix bug to Engineering board"\n• "remind me to call dentist in 30 minutes"\n• "note: meeting ideas for Q4"\n• "deploy staging tomorrow at 3pm high priority"`}
          />
        </>
      ) : (
        <>
          <Form.Description title="Parsed Command" text={parsedIntent.description} />
          <Form.Separator />
          <Form.Description title="Action" text={parsedIntent.action} />

          {/* Board/Column picker for create_task */}
          {parsedIntent.action === 'create_task' && boards.length > 0 && (
            <>
              <Form.Separator />
              <Form.Dropdown
                id="board"
                title="Board"
                value={selectedBoardId}
                onChange={(newBoardId) => {
                  setSelectedBoardId(newBoardId);
                  // Auto-select first column of new board
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

              {selectedBoardId && (
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
          <Form.Description
            title="Task Details"
            text={JSON.stringify(parsedIntent.data, null, 2)}
          />
        </>
      )}
    </Form>
  );
}
