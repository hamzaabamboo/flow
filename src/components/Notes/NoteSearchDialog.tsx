import { useState } from 'react';
import { Search, FileText, Loader2, ExternalLink } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import * as Dialog from '../ui/styled/dialog';
import { Box, VStack, HStack } from 'styled-system/jsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import { useSearchNotes, useLinkNote } from '../../hooks/useNotes';
import { useToaster } from '../../contexts/ToasterContext';

interface NoteSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  onNoteLinked?: () => void;
}

export function NoteSearchDialog({
  open,
  onOpenChange,
  taskId,
  onNoteLinked
}: NoteSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToaster();

  const searchNotes = useSearchNotes();
  const linkNote = useLinkNote();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchNotes.mutate({ query: searchQuery.trim() });
    }
  };

  const handleLinkNote = async (noteId: string, noteTitle: string) => {
    try {
      await linkNote.mutateAsync({ taskId, noteId });
      toast?.(`Linked note: ${noteTitle}`, {
        title: 'Note Linked',
        type: 'success'
      });
      onNoteLinked?.();
      // Don't close dialog - user may want to search more or view the linked note
    } catch (error) {
      toast?.(error instanceof Error ? error.message : 'Failed to link note', {
        title: 'Error',
        type: 'error'
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px" maxH="80vh">
            <VStack gap="4" p="6" alignItems="stretch">
              <VStack gap="1" alignItems="start">
                <Dialog.Title>Link Existing Note</Dialog.Title>
                <Dialog.Description>
                  Search for an existing note in Outline to link to this task
                </Dialog.Description>
              </VStack>

              {/* Search Input */}
              <HStack gap="2">
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searchNotes.isPending}
                  loading={searchNotes.isPending}
                >
                  <Search width="16" height="16" />
                  Search
                </Button>
              </HStack>

              {/* Search Results */}
              <Box
                maxH="400px"
                overflowY="auto"
                borderWidth="1px"
                borderRadius="l2"
                borderColor="border.default"
              >
                {searchNotes.isPending && (
                  <VStack gap="2" py="8" alignItems="center">
                    <Loader2 width="24" height="24" className="animate-spin" />
                    <Text color="fg.muted">Searching...</Text>
                  </VStack>
                )}

                {searchNotes.isSuccess && searchNotes.data.length === 0 && (
                  <VStack gap="2" py="8" alignItems="center">
                    <FileText width="24" height="24" color="fg.muted" />
                    <Text color="fg.muted">No notes found</Text>
                  </VStack>
                )}

                {searchNotes.isSuccess && searchNotes.data.length > 0 && (
                  <VStack gap="0" alignItems="stretch">
                    {searchNotes.data.map((note) => (
                      <HStack
                        key={note.id}
                        p="3"
                        justifyContent="space-between"
                        borderBottomWidth="1px"
                        borderColor="border.default"
                        _hover={{ bg: 'bg.subtle' }}
                      >
                        <VStack gap="1" alignItems="start" flex="1">
                          <Text fontWeight="medium">{note.title}</Text>
                          {note.context && (
                            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                              {note.context}
                            </Text>
                          )}
                          <Text fontSize="xs" color="fg.muted">
                            Updated: {new Date(note.updatedAt).toLocaleDateString()}
                          </Text>
                        </VStack>
                        <HStack gap="2">
                          {note.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(note.url, '_blank')}
                            >
                              <ExternalLink width="16" height="16" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleLinkNote(note.id, note.title)}
                            disabled={linkNote.isPending}
                          >
                            Link
                          </Button>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                )}

                {searchNotes.isError && (
                  <VStack gap="2" py="8" alignItems="center">
                    <Text color="red.fg">Search failed</Text>
                    <Text fontSize="sm" color="fg.muted">
                      {searchNotes.error instanceof Error
                        ? searchNotes.error.message
                        : 'An error occurred'}
                    </Text>
                  </VStack>
                )}
              </Box>

              {/* Actions */}
              <HStack gap="2" justifyContent="flex-end">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.CloseTrigger>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
