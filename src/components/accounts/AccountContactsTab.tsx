import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { listContacts, deleteContact, type Contact } from '@/services/supabase/contacts';
import { ContactCard } from './ContactCard';
import { ContactModal } from '@/components/contacts/ContactModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { contactKeys, accountKeys } from '@/lib/query-keys';

interface AccountContactsTabProps {
  accountId: string;
  accountName: string;
}

export function AccountContactsTab({ accountId, accountName }: AccountContactsTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: [...contactKeys.lists(), accountId, searchQuery],
    queryFn: () => listContacts({ account_id: accountId, q: searchQuery }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.detailExtended(accountId) });
      toast({ title: 'Contato excluído com sucesso' });
      setDeleteDialog(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });

  const contacts = contactsData?.data || [];

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleSchedule = (contact: Contact) => {
    // Navigate to activities with pre-filled contact
    navigate('/app/activities', {
      state: {
        createActivity: true,
        prefilledData: {
          account_id: accountId,
          contact_id: contact.id,
        },
      },
    });
  };

  const handleOpenModal = (contact?: Contact) => {
    setEditingContact(contact);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingContact(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contatos</h2>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contato{contacts.length !== 1 ? 's' : ''} em {accountName}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contato
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              Carregando contatos...
            </div>
          </CardContent>
        </Card>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum contato cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'Nenhum contato encontrado com esse termo.'
                  : 'Comece adicionando o primeiro contato desta empresa.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Contato
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleOpenModal}
              onDelete={setDeleteDialog}
              onEmail={handleEmail}
              onCall={handleCall}
              onSchedule={handleSchedule}
            />
          ))}
        </div>
      )}

      {/* Contact Modal */}
      <ContactModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        contact={editingContact}
        defaultAccountId={accountId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
