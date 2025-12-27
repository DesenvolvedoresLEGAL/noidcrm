import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  listOpportunityNotes,
  createOpportunityNote,
  updateOpportunityNote,
  deleteOpportunityNote,
  type OpportunityNote,
} from '@/services/crm/opportunity-notes';
import { logNoteEvent } from '@/services/crm/timeline-logger';

interface OpportunityNotesTabProps {
  opportunityId: string;
}

export function OpportunityNotesTab({ opportunityId }: OpportunityNotesTabProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<OpportunityNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await listOpportunityNotes(opportunityId);
      setNotes(data);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as notas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [opportunityId]);

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) {
      toast({
        title: 'Atenção',
        description: 'O conteúdo da nota não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      await createOpportunityNote({
        opportunity_id: opportunityId,
        content: newNoteContent,
      });
      
      // Log to timeline
      await logNoteEvent(opportunityId, 'note_created', newNoteContent);
      
      toast({
        title: 'Sucesso',
        description: 'Nota criada com sucesso!',
      });
      setNewNoteContent('');
      setShowNewNote(false);
      loadNotes();
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a nota.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editContent.trim()) {
      toast({
        title: 'Atenção',
        description: 'O conteúdo da nota não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateOpportunityNote(noteId, editContent);
      
      // Log to timeline
      await logNoteEvent(opportunityId, 'note_updated', editContent);
      
      toast({
        title: 'Sucesso',
        description: 'Nota atualizada com sucesso!',
      });
      setEditingNoteId(null);
      setEditContent('');
      loadNotes();
    } catch (error) {
      console.error('Erro ao atualizar nota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a nota.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    try {
      await deleteOpportunityNote(noteId);
      
      // Log to timeline
      await logNoteEvent(opportunityId, 'note_deleted');
      
      toast({
        title: 'Sucesso',
        description: 'Nota excluída com sucesso!',
      });
      loadNotes();
    } catch (error) {
      console.error('Erro ao excluir nota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a nota.',
        variant: 'destructive',
      });
    }
  };

  const startEdit = (note: OpportunityNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notas da Oportunidade</CardTitle>
            <Button 
              onClick={() => setShowNewNote(!showNewNote)} 
              size="sm"
              variant={showNewNote ? "outline" : "default"}
            >
              {showNewNote ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Nota
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nova Nota */}
          {showNewNote && (
            <Card className="border-2 border-primary/20 bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Digite sua nota aqui..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                  disabled={isCreating}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewNote(false);
                      setNewNoteContent('');
                    }}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateNote}
                    disabled={isCreating || !newNoteContent.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isCreating ? 'Salvando...' : 'Salvar Nota'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Notas */}
          <div className="space-y-3">
            {notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma nota encontrada.</p>
                <p className="text-sm mt-2">Clique em "Nova Nota" para começar.</p>
              </div>
            ) : (
              notes.map((note) => (
                <Card key={note.id} className="animate-fade-in">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="text-xs">
                          {note.creator?.full_name?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">
                              {note.creator?.full_name || 'Usuário'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(note.created_at)}
                              {note.updated_at !== note.created_at && ' (editado)'}
                            </p>
                          </div>
                          {editingNoteId !== note.id && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => startEdit(note)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[100px] resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditNote(note.id)}
                                disabled={!editContent.trim()}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
