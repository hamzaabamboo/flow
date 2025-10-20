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
import { api } from "./lib/api";
import { getPreferences } from "./utils/preferences";

export default function AICommand() {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<{
    action: string;
    data: Record<string, unknown>;
    description: string;
  } | null>(null);

  const prefs = getPreferences();

  const handleParse = async () => {
    if (!command.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Empty Command",
        message: "Please enter a command",
      });
      return;
    }

    setIsLoading(true);

    try {
      const intent = await api.sendCommand(command, prefs.defaultSpace);
      setParsedIntent(intent);

      await showToast({
        style: Toast.Style.Success,
        title: "Command Parsed",
        message: intent.description,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Parse Error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!parsedIntent) return;

    setIsLoading(true);

    try {
      const result = await api.executeCommand(
        parsedIntent.action,
        parsedIntent.data,
        prefs.defaultSpace
      );

      await showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: `${parsedIntent.action} executed`,
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
        title: "Execution Error",
        message: error instanceof Error ? error.message : "Unknown error",
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
              <Action
                title="Edit Command"
                onAction={() => setParsedIntent(null)}
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
          <Form.Description
            title="Parsed Command"
            text={parsedIntent.description}
          />
          <Form.Separator />
          <Form.Description
            title="Action"
            text={parsedIntent.action}
          />
          <Form.Description
            title="Details"
            text={JSON.stringify(parsedIntent.data, null, 2)}
          />
        </>
      )}
    </Form>
  );
}
