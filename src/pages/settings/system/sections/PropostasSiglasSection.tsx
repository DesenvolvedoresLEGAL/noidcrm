import React, { useState } from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Sigla {
  id: string;
  nome: string;
  proximo_numero: number;
}

interface PropostasSiglasSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export function PropostasSiglasSection({ settings, onSettingChange }: PropostasSiglasSectionProps) {
  const [siglas, setSiglas] = useState<Sigla[]>(settings.propostas_siglas ?? []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSigla, setEditingSigla] = useState<Sigla | null>(null);
  const [formData, setFormData] = useState({ nome: '', proximo_numero: 1 });
  const { toast } = useToast();

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da sigla é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    let newSiglas: Sigla[];
    
    if (editingSigla) {
      newSiglas = siglas.map((s) =>
        s.id === editingSigla.id
          ? { ...s, nome: formData.nome, proximo_numero: formData.proximo_numero }
          : s
      );
      toast({
        title: 'Sigla atualizada',
        description: 'A sigla foi atualizada com sucesso.',
      });
    } else {
      const newSigla: Sigla = {
        id: crypto.randomUUID(),
        nome: formData.nome,
        proximo_numero: formData.proximo_numero,
      };
      newSiglas = [...siglas, newSigla];
      toast({
        title: 'Sigla adicionada',
        description: 'Nova sigla criada com sucesso.',
      });
    }

    setSiglas(newSiglas);
    onSettingChange('propostas_siglas', newSiglas);
    setIsDialogOpen(false);
    setEditingSigla(null);
    setFormData({ nome: '', proximo_numero: 1 });
  };

  const handleEdit = (sigla: Sigla) => {
    setEditingSigla(sigla);
    setFormData({ nome: sigla.nome, proximo_numero: sigla.proximo_numero });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const newSiglas = siglas.filter((s) => s.id !== id);
    setSiglas(newSiglas);
    onSettingChange('propostas_siglas', newSiglas);
    toast({
      title: 'Sigla removida',
      description: 'A sigla foi removida com sucesso.',
    });
  };

  const handleAdd = () => {
    setEditingSigla(null);
    setFormData({ nome: '', proximo_numero: 1 });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Siglas Sequenciais</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure siglas personalizadas para numeração de propostas
        </p>
      </div>

      <SettingCard>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Gerencie as siglas utilizadas na numeração automática de propostas
            </p>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Sigla
            </Button>
          </div>

          {siglas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Sigla</TableHead>
                  <TableHead>Número da Próxima Proposta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siglas.map((sigla) => (
                  <TableRow key={sigla.id}>
                    <TableCell className="font-medium">{sigla.nome}</TableCell>
                    <TableCell>{sigla.proximo_numero}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(sigla)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sigla.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma sigla configurada ainda.</p>
              <p className="text-sm mt-1">Clique em "Adicionar Sigla" para começar.</p>
            </div>
          )}
        </div>
      </SettingCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSigla ? 'Editar Sigla' : 'Nova Sigla'}
            </DialogTitle>
            <DialogDescription>
              Configure a sigla e o número inicial da sequência
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Sigla</Label>
              <Input
                id="nome"
                placeholder="Ex: PROP, ORÇ, VND"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numero">Próximo Número</Label>
              <Input
                id="numero"
                type="number"
                min="1"
                value={formData.proximo_numero}
                onChange={(e) => setFormData({ ...formData, proximo_numero: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingSigla ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
