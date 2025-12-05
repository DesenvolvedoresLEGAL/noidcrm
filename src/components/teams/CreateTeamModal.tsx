import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAvailableManagers } from '@/hooks/useAvailableManagers';
import { Team } from '@/hooks/useTeams';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

const TEAM_COLORS = [
  { value: '#6366f1', label: 'Índigo' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#0ea5e9', label: 'Azul' },
  { value: '#64748b', label: 'Cinza' },
];

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (team: Partial<Team>) => Promise<{ error: any }>;
  editingTeam?: Team | null;
}

export function CreateTeamModal({ open, onOpenChange, onSubmit, editingTeam }: CreateTeamModalProps) {
  const { managers, loading: loadingManagers } = useAvailableManagers();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: editingTeam?.name || '',
    description: editingTeam?.description || '',
    color: editingTeam?.color || '#6366f1',
    monthly_goal: editingTeam?.monthly_goal?.toString() || '0',
    manager_id: editingTeam?.manager_id || '',
  });

  // Reset form when editingTeam changes
  useEffect(() => {
    if (editingTeam) {
      setFormData({
        name: editingTeam.name,
        description: editingTeam.description || '',
        color: editingTeam.color,
        monthly_goal: editingTeam.monthly_goal?.toString() || '0',
        manager_id: editingTeam.manager_id || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#6366f1',
        monthly_goal: '0',
        manager_id: '',
      });
    }
  }, [editingTeam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const result = await onSubmit({
      name: formData.name,
      description: formData.description || null,
      color: formData.color,
      monthly_goal: parseFloat(formData.monthly_goal) || 0,
      manager_id: formData.manager_id || null,
    });

    setSaving(false);
    
    if (!result.error) {
      onOpenChange(false);
      setFormData({
        name: '',
        description: '',
        color: '#6366f1',
        monthly_goal: '0',
        manager_id: '',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingTeam ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Equipe *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Equipe Comercial Sul"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional da equipe..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: formData.color }} 
                      />
                      {TEAM_COLORS.find(c => c.value === formData.color)?.label || 'Selecionar'}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TEAM_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: color.value }} 
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_goal">Meta Mensal (R$)</Label>
              <Input
                id="monthly_goal"
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_goal}
                onChange={(e) => setFormData({ ...formData, monthly_goal: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gestor da Equipe</Label>
            <Select
              value={formData.manager_id}
              onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
              disabled={loadingManagers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingManagers ? "Carregando..." : "Selecionar gestor"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum gestor</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={manager.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {manager.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{manager.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTeam ? 'Salvar' : 'Criar Equipe'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
