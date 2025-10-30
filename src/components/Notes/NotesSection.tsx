import { useState } from 'react';
import { FileText, ExternalLink, Plus, Link as LinkIcon, X } from 'lucide-react';
import { Box, VStack, HStack } from 'styled-system/jsx';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useNotesEnabled, useTaskNote, useCreateNote, useUnlinkNote } from '../../hooks/useNotes';
import { useToaster } from '../../contexts/ToasterContext';
import { NoteSearchDialog } from './NoteSearchDialog';

interface NotesSectionProps {
  taskId?: string;
  taskTitle: string;
}

export function NotesSection({ taskId, taskTitle }: NotesSectionProps) {
  const { toast } = useToaster();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const { data: notesStatus } = useNotesEnabled();
  const { data: taskNote, refetch: refetchNote } = useTaskNote(taskId, !!taskId);
  const createNote = useCreateNote();
  const unlinkNote = useUnlinkNote();

  if (!notesStatus?.enabled) {
    return (
      <Box p="3" borderWidth="1px" borderRadius="l2" borderColor="border.default" bg="bg.subtle">
        <VStack gap="2" alignItems="start">
          <HStack gap="2">
            <FileText width="16" height="16" color="fg.muted" />
            <Text fontSize="sm" fontWeight="medium" color="fg.muted">
              Notes Integration
            </Text>
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Configure Outline in Settings to link notes to tasks
          </Text>
        </VStack>
      </Box>
    );
  }

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) return;

    try {
      const result = await createNote.mutateAsync({
        title: noteTitle,
        text: noteText || undefined,
        taskId: taskId
      });

      toast?.('Note created and linked successfully', {
        title: 'Success',
        type: 'success'
      });

      setNoteTitle('');
      setNoteText('');
      // Don't close form - user can see the linked note display instead
      refetchNote();

      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      toast?.(error instanceof Error ? error.message : 'Failed to create note', {
        title: 'Error',
        type: 'error'
      });
    }
  };

  const handleUnlinkNote = async () => {
    if (!taskId) return;

    try {
      await unlinkNote.mutateAsync(taskId);
      toast?.('Note unlinked successfully', {
        title: 'Success',
        type: 'success'
      });
      refetchNote();
    } catch (error) {
      toast?.(error instanceof Error ? error.message : 'Failed to unlink note', {
        title: 'Error',
        type: 'error'
      });
    }
  };

  return (
    <>
      <VStack gap="3" alignItems="stretch">
        <HStack gap="2" justifyContent="space-between">
          <HStack gap="2">
            <FileText width="16" height="16" />
            <Text fontWeight="medium">Notes</Text>
          </HStack>
          {!taskNote && !showCreateForm && (
            <HStack gap="2">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus width="16" height="16" />
                Create Note
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSearchDialog(true)}>
                <LinkIcon width="16" height="16" />
                Link Existing
              </Button>
            </HStack>
          )}
        </HStack>

        {/* Linked Note Display */}
        {taskNote && (
          <Box
            p="3"
            borderWidth="1px"
            borderRadius="l2"
            borderColor="border.emphasized"
            bg="bg.subtle"
          >
            <HStack justifyContent="space-between">
              <VStack gap="1" alignItems="start" flex="1">
                <Text fontWeight="medium">{taskNote.title || 'Linked Note'}</Text>
                {taskNote.url && (
                  <Text fontSize="xs" color="fg.muted">
                    {taskNote.url}
                  </Text>
                )}
              </VStack>
              <HStack gap="2">
                {taskNote.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => taskNote.url && window.open(taskNote.url, '_blank')}
                  >
                    <ExternalLink width="16" height="16" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  colorPalette="red"
                  onClick={handleUnlinkNote}
                  disabled={unlinkNote.isPending}
                >
                  <X width="16" height="16" />
                </Button>
              </HStack>
            </HStack>
          </Box>
        )}

        {/* Create Note Form */}
        {showCreateForm && !taskNote && (
          <Box
            p="4"
            borderWidth="1px"
            borderRadius="l2"
            borderColor="border.default"
            bg="bg.default"
          >
            <VStack gap="3" alignItems="stretch">
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb="1">
                  Note Title
                </Text>
                <Input
                  placeholder={`Notes for: ${taskTitle}`}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb="1">
                  Initial Content (Optional)
                </Text>
                <Textarea
                  placeholder="Add initial note content..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                />
              </Box>

              <HStack gap="2" justifyContent="flex-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNoteTitle('');
                    setNoteText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateNote}
                  disabled={!noteTitle.trim() || createNote.isPending}
                  loading={createNote.isPending}
                >
                  Create & Link Note
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}
      </VStack>

      {/* Search Dialog */}
      {taskId && (
        <NoteSearchDialog
          open={showSearchDialog}
          onOpenChange={setShowSearchDialog}
          taskId={taskId}
          onNoteLinked={refetchNote}
        />
      )}
    </>
  );
}
