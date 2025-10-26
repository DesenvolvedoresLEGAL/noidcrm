import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket, Check, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';

interface Step2Props {
  companyName: string;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
}

export interface Step2Data {
  workspaceName: string;
  workspaceSlug: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function Step2Workspace({ companyName, onNext, onBack }: Step2Props) {
  const [formData, setFormData] = useState<Step2Data>({
    workspaceName: companyName,
    workspaceSlug: generateSlug(companyName)
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const debouncedSlug = useDebounce(formData.workspaceSlug, 500);

  useEffect(() => {
    if (debouncedSlug.length >= 3) {
      checkAvailability(debouncedSlug);
    } else {
      setIsAvailable(null);
    }
  }, [debouncedSlug]);

  const checkAvailability = async (slug: string) => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-org-slug', {
        body: { slug }
      });

      if (error) throw error;
      setIsAvailable(data.available);
    } catch (error) {
      console.error('Error checking slug:', error);
      setIsAvailable(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSlugChange = (value: string) => {
    const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, workspaceSlug: cleanSlug });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAvailable) {
      onNext(formData);
    }
  };

  const isValid = formData.workspaceName.length >= 2 && isAvailable === true;

  return (
    <Card className="border-2 shadow-xl animate-fade-in">
      <CardContent className="pt-12 pb-8 px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Seu espaço de vendas 🎯</h2>
          <p className="text-lg text-muted-foreground">
            Configure o nome e endereço do seu workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Nome do workspace *</Label>
            <Input
              id="workspaceName"
              placeholder="Ex: Acme Vendas"
              value={formData.workspaceName}
              onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspaceSlug">Endereço do workspace *</Label>
            <div className="relative">
              <Input
                id="workspaceSlug"
                placeholder="seu-workspace"
                value={formData.workspaceSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="h-11 pr-10"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
                {!isChecking && isAvailable === true && <Check className="w-5 h-5 text-green-500" />}
                {!isChecking && isAvailable === false && <X className="w-5 h-5 text-destructive" />}
              </div>
            </div>
            {formData.workspaceSlug.length >= 3 && (
              <p className="text-sm text-muted-foreground">
                {isAvailable === true && '✓ Disponível'}
                {isAvailable === false && '✗ Já existe, escolha outro'}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={onBack} className="flex-1 h-12">
              ← Voltar
            </Button>
            <Button type="submit" size="lg" className="flex-1 h-12 text-base" disabled={!isValid}>
              Continuar →
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
