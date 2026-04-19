import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionsBar({ selectedCount, onDelete, onClear }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur animate-fade-in">
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'atividade selecionada' : 'atividades selecionadas'}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-2">
          <X className="h-4 w-4" />
          Cancelar
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="gap-2">
          <Trash2 className="h-4 w-4" />
          Excluir selecionadas
        </Button>
      </div>
    </div>
  );
}
