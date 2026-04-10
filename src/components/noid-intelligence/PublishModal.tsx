import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Rocket } from 'lucide-react';
import { ENVIRONMENT_LABELS, ENVIRONMENT_COLORS } from '@/types/ai-agents';
import type { AgentEnvironment, AIAgentVersion } from '@/types/ai-agents';

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: AIAgentVersion[];
  currentVersionId?: string | null;
  onPublish: (versionId: string, environment: string) => Promise<void>;
  isPending: boolean;
}

export default function PublishModal({ open, onOpenChange, versions, currentVersionId, onPublish, isPending }: PublishModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedEnv, setSelectedEnv] = useState<string>('production');

  const handlePublish = async () => {
    if (!selectedVersion) return;
    await onPublish(selectedVersion, selectedEnv);
    onOpenChange(false);
  };

  const selectedV = versions.find((v) => v.id === selectedVersion);
  const currentV = versions.find((v) => v.id === currentVersionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Publicar Versão
          </DialogTitle>
          <DialogDescription>
            Selecione a versão e o ambiente de destino
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentV && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <span className="text-muted-foreground">Versão atual: </span>
              <span className="font-medium">v{currentV.version_number}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nova versão</Label>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger><SelectValue placeholder="Selecionar versão" /></SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_number} {v.is_published ? '(publicada)' : ''} — {v.change_summary || 'Sem resumo'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={selectedEnv} onValueChange={setSelectedEnv}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['draft', 'test', 'production'] as AgentEnvironment[]).map((env) => (
                  <SelectItem key={env} value={env}>{ENVIRONMENT_LABELS[env]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedV && (
            <div className="p-3 rounded-lg border space-y-1 text-sm">
              <div><span className="text-muted-foreground">Versão: </span>v{selectedV.version_number}</div>
              <div><span className="text-muted-foreground">Destino: </span>
                <Badge className={ENVIRONMENT_COLORS[selectedEnv as AgentEnvironment] || ''}>{ENVIRONMENT_LABELS[selectedEnv as AgentEnvironment]}</Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handlePublish} disabled={!selectedVersion || isPending}>
            {isPending ? 'Publicando...' : 'Confirmar Publicação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
