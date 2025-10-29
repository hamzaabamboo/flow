import { useState, useEffect } from 'react';
import { Form, ActionPanel, Action, showToast, Toast, open, Icon, LaunchProps } from '@raycast/api';
import { api } from './lib/api';
import { getPreferences } from './utils/preferences';
import type { Board } from './lib/types';

interface CommandSuggestion {
  action: string;
  data: Record<string, unknown>;
  description: string;
}

interface AICommandArguments {
  command?: string;
}

function AICommand(props: LaunchProps<{ arguments: AICommandArguments }>) {
  const { command: initialCommand = '' } = props.arguments;
  const [command, setCommand] = useState(initialCommand);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<CommandSuggestion | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  const prefs = getPreferences();

  // Fetch boards when intent is parsed and it's a create_task action
  useEffect(() => {
    if (parsedIntent && parsedIntent.action === 'create_task') {
      const fetchBoards = async () => {
        try {
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

    setIsProcessing(true);

    try {
      const intent = await api.sendCommand(command, 'auto');
      setParsedIntent(intent);

      await showToast({
        style: Toast.Style.Success,
        title: '✓ Parsed',
        message: intent.description
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Parse Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!parsedIntent) return;

    setIsProcessing(true);

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
        title: '✓ Created',
        message: `${parsedIntent.action} executed`
      });

      // If task was created on a board, offer to open it
      if (result.boardId) {
        const openUrl = `${prefs.serverUrl}/board/${result.boardId}`;
        await open(openUrl);
      }

      // Reset for next command
      setCommand('');
      setParsedIntent(null);
      setBoards([]);
      setSelectedBoardId('');
      setSelectedColumnId('');
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Execution Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setParsedIntent(null);
    setBoards([]);
    setSelectedBoardId('');
    setSelectedColumnId('');
  };

  // Auto-parse if command was provided as argument
  useEffect(() => {
    if (initialCommand && initialCommand.trim() && !parsedIntent) {
      handleParse();
    }
  }, [initialCommand]);

  return (
    <Form
      isLoading={isProcessing}
      actions={
        <ActionPanel>
          {!parsedIntent ? (
            <Action title="Parse Command" icon={Icon.Wand} onAction={handleParse} />
          ) : (
            <>
              <Action title="Confirm & Execute" icon={Icon.Check} onAction={handleExecute} />
              <Action
                title="Edit Command"
                icon={Icon.Pencil}
                shortcut={{ modifiers: ['cmd'], key: 'e' }}
                onAction={handleReset}
              />
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
            placeholder='e.g., "deploy staging tomorrow at 3pm"'
            value={command}
            onChange={setCommand}
            info="Use natural language to create tasks, reminders, or notes"
          />
          <Form.Description
            title="Examples"
            text={`• "fix auth bug tomorrow"\n• "remind me to call dentist in 30 minutes"\n• "buy groceries"\n• "deploy staging server high priority"`}
          />
        </>
      ) : (
        <>
          <Form.Description title="✓ Command Parsed" text={command} />
          <Form.Separator />
          <Form.Description title="Action" text={parsedIntent.action} />
          <Form.Description title="Result" text={parsedIntent.description} />

          {parsedIntent.data.title && (
            <Form.Description title="Task Title" text={parsedIntent.data.title as string} />
          )}
          {parsedIntent.data.priority && (
            <Form.Description
              title="Priority"
              text={(parsedIntent.data.priority as string).toUpperCase()}
            />
          )}
          {parsedIntent.data.deadline && (
            <Form.Description title="Due Date" text={parsedIntent.data.deadline as string} />
          )}

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
                  const board = boards.find((b) => b.id === newBoardId);
                  if (board && board.columns.length > 0) {
                    setSelectedColumnId(board.columns[0].id);
                  }
                }}
              >
                {boards.map((board) => (
                  <Form.Dropdown.Item
                    key={board.id}
                    value={board.id}
                    title={`${board.space === 'work' ? '💼' : '🏠'} ${board.name}`}
                  />
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
        </>
      )}
    </Form>
  );
}

export default AICommand;
