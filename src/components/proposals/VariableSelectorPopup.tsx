import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Variable, Search, Copy, Check } from 'lucide-react';
import { PROPOSAL_VARIABLES } from '@/lib/proposalVariables';
import { toast } from 'sonner';

interface VariableSelectorPopupProps {
  onSelectVariable: (variable: string) => void;
}

export function VariableSelectorPopup({ onSelectVariable }: VariableSelectorPopupProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const filteredCategories = PROPOSAL_VARIABLES.map(category => ({
    ...category,
    variables: Object.entries(category.variables).filter(([variable, description]) => {
      const query = searchQuery.toLowerCase();
      return (
        variable.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)
      );
    }),
  })).filter(category => category.variables.length > 0);

  const handleSelectVariable = (variable: string) => {
    onSelectVariable(variable);
    setOpen(false);
    toast.success('Variável inserida!');
  };

  const handleCopyVariable = (variable: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(variable);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
    toast.success('Variável copiada!');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Variable className="h-4 w-4" />
          Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="flex flex-col h-[500px]">
          {/* Header */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Variáveis Dinâmicas</h3>
              <Badge variant="secondary" className="text-xs">
                {filteredCategories.reduce((acc, cat) => acc + cat.variables.length, 0)} disponíveis
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar variável..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Variables List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Variable className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma variável encontrada</p>
                </div>
              ) : (
                filteredCategories.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {category.name}
                    </h4>
                    <div className="space-y-1">
                      {category.variables.map(([variable, description]) => (
                        <button
                          key={variable}
                          onClick={() => handleSelectVariable(variable)}
                          className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <code className="text-sm font-mono text-primary block truncate">
                                {variable}
                              </code>
                              <p className="text-xs text-muted-foreground mt-1">
                                {description}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleCopyVariable(variable, e)}
                            >
                              {copiedVariable === variable ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/50">
            <p className="text-xs text-muted-foreground">
              💡 Dica: As variáveis serão substituídas automaticamente pelos dados reais ao gerar o PDF
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
