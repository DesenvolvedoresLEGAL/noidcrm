import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkCreateUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Sales roles for commercial team members
type SalesRole = 'SDR' | 'BDR' | 'AE' | 'Closer' | 'Hunter' | 'Farmer' | 'AM' | 'CS';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: SalesRole;
}

export function BulkCreateUsersModal({ open, onOpenChange, onSuccess }: BulkCreateUsersModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([
    { id: crypto.randomUUID(), fullName: '', email: '', password: '', role: 'SDR' },
  ]);

  const addUserRow = () => {
    setUsers([...users, { id: crypto.randomUUID(), fullName: '', email: '', password: '', role: 'SDR' }]);
  };

  const removeUserRow = (id: string) => {
    if (users.length === 1) {
      toast.error('Deve haver pelo menos um usuário');
      return;
    }
    setUsers(users.filter(u => u.id !== id));
  };

  const updateUser = (id: string, field: keyof UserRow, value: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const handleSubmit = async () => {
    // Validate
    const invalidUsers = users.filter(u => !u.fullName || !u.email || !u.password);
    if (invalidUsers.length > 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = users.filter(u => !emailRegex.test(u.email));
    if (invalidEmails.length > 0) {
      toast.error('Verifique os emails informados');
      return;
    }

    // Validate password length
    const weakPasswords = users.filter(u => u.password.length < 6);
    if (weakPasswords.length > 0) {
      toast.error('As senhas devem ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-users', {
        body: { users },
      });

      if (error) throw error;

      const results = data.results;
      const summary = data.summary;

      console.log('[BulkCreate] Results:', results);

      // Show individual results
      results.forEach((result: any) => {
        if (result.success) {
          toast.success(`✓ ${result.email} criado com sucesso`);
        } else {
          toast.error(`✗ ${result.email}: ${result.error}`);
        }
      });

      // Show summary
      if (summary.success > 0) {
        toast.success(`${summary.success} de ${summary.total} usuários criados com sucesso!`, {
          duration: 5000,
        });
        
        if (summary.success === summary.total) {
          onSuccess();
          onOpenChange(false);
          // Reset form
          setUsers([{ id: crypto.randomUUID(), fullName: '', email: '', password: '', role: 'SDR' }]);
        }
      } else {
        toast.error('Nenhum usuário foi criado. Verifique os erros acima.');
      }

    } catch (error: any) {
      console.error('Error creating users:', error);
      toast.error(error.message || 'Erro ao criar usuários');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Múltiplos Usuários
          </DialogTitle>
          <DialogDescription>
            Crie várias contas de vendedor de uma vez. Todos terão acesso ao módulo Roleplay.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {users.map((user, index) => (
              <div key={user.id} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">Usuário {index + 1}</h4>
                  {users.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUserRow(user.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${user.id}`}>Nome Completo *</Label>
                    <Input
                      id={`name-${user.id}`}
                      value={user.fullName}
                      onChange={(e) => updateUser(user.id, 'fullName', e.target.value)}
                      placeholder="Ex: Jessica Machado"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`email-${user.id}`}>Email *</Label>
                    <Input
                      id={`email-${user.id}`}
                      type="email"
                      value={user.email}
                      onChange={(e) => updateUser(user.id, 'email', e.target.value)}
                      placeholder="email@operadora.legal"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`password-${user.id}`}>Senha *</Label>
                    <Input
                      id={`password-${user.id}`}
                      type="text"
                      value={user.password}
                      onChange={(e) => updateUser(user.id, 'password', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`role-${user.id}`}>Função</Label>
                    <Select
                      value={user.role}
                      onValueChange={(value) => updateUser(user.id, 'role', value)}
                      disabled={loading}
                    >
                      <SelectTrigger id={`role-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SDR">SDR (Pré-vendas)</SelectItem>
                        <SelectItem value="BDR">BDR (Outbound)</SelectItem>
                        <SelectItem value="AE">AE (Account Executive)</SelectItem>
                        <SelectItem value="Closer">Closer (Fechador)</SelectItem>
                        <SelectItem value="Hunter">Hunter (Novos negócios)</SelectItem>
                        <SelectItem value="Farmer">Farmer (Gestão de carteira)</SelectItem>
                        <SelectItem value="AM">AM (Account Manager)</SelectItem>
                        <SelectItem value="CS">CS (Customer Success)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addUserRow}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Outro Usuário
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Criar Todos ({users.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
