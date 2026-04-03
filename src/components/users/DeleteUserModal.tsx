import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userToDelete: {
    userId: string;
    fullName: string | null;
    email: string | null;
  } | null;
  onSuccess: () => void;
}

interface ActiveMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function DeleteUserModal({ open, onOpenChange, userToDelete, onSuccess }: DeleteUserModalProps) {
  const { organization } = useCurrentUser();
  const [transferToUserId, setTransferToUserId] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (open && organization && userToDelete) {
      setTransferToUserId('');
      setConfirmText('');
      fetchActiveMembers();
    }
  }, [open, organization, userToDelete]);

  const fetchActiveMembers = async () => {
    if (!organization || !userToDelete) return;
    setLoadingMembers(true);
    try {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .neq('user_id', userToDelete.userId);

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        setActiveMembers(
          (profiles || []).map(p => ({
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          }))
        );
      } else {
        setActiveMembers([]);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const expectedConfirmText = 'EXCLUIR';
  const canConfirm = transferToUserId && confirmText.toUpperCase() === expectedConfirmText && !isDeleting;

  const handleDelete = async () => {
    if (!canConfirm || !organization || !userToDelete) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-with-transfer', {
        body: {
          user_id_to_delete: userToDelete.userId,
          transfer_to_user_id: transferToUserId,
          organization_id: organization.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results = data?.transfer_results || {};
      const totalTransferred = Object.values(results).reduce((sum: number, v: any) => sum + (v || 0), 0);

      toast.success('Usuário excluído com sucesso', {
        description: `${totalTransferred} registros transferidos para o novo proprietário.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário', {
        description: error.message || 'Tente novamente mais tarde',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedRecipient = activeMembers.find(m => m.user_id === transferToUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Excluir Usuário</DialogTitle>
          </div>
          <DialogDescription>
            Esta ação é permanente. Todos os registros do usuário serão transferidos para outro membro antes da exclusão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* User being deleted */}
          <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20">
            <Label className="text-xs text-muted-foreground mb-2 block">Usuário a ser excluído:</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{getInitials(userToDelete?.fullName || null)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{userToDelete?.fullName || 'Sem nome'}</p>
                <p className="text-xs text-muted-foreground">{userToDelete?.email || ''}</p>
              </div>
            </div>
          </div>

          {/* Transfer recipient */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Transferir registros para <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Todos os registros (oportunidades, contas, atividades, contratos, etc.) serão transferidos para o usuário selecionado.
            </p>
            {loadingMembers ? (
              <div className="flex items-center gap-2 p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando membros...</span>
              </div>
            ) : (
              <Select value={transferToUserId} onValueChange={setTransferToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo proprietário dos registros" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{member.full_name || member.email || 'Sem nome'}</span>
                        {member.email && member.full_name && (
                          <span className="text-muted-foreground text-xs">({member.email})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Transfer preview */}
          {selectedRecipient && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{getInitials(userToDelete?.fullName || null)}</AvatarFallback>
              </Avatar>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Avatar className="h-7 w-7">
                <AvatarImage src={selectedRecipient.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(selectedRecipient.full_name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Registros serão transferidos para <strong>{selectedRecipient.full_name || selectedRecipient.email}</strong>
              </span>
            </div>
          )}

          {/* Typing confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Digite <span className="font-mono font-bold text-destructive">{expectedConfirmText}</span> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedConfirmText}
              className="font-mono"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm}
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Excluindo...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Excluir e Transferir
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
