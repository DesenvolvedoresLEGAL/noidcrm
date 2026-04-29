import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Star, CheckCircle2 } from 'lucide-react';
import { useDynamicDashboardFeedback } from '@/hooks/dashboard/useDynamicDashboardFeedback';
import { useToast } from '@/hooks/use-toast';

const MISSING_CHIPS = [
  'Mais clareza nas propostas',
  'Mais clareza nas atividades',
  'Melhor cálculo do pace',
  'Mais velocidade',
  'CTAs melhores',
  'Outra informação',
] as const;


interface Props {
  tenantId: string;
}

export function CloserDashboardFeedbackCard({ tenantId }: Props) {
  const { submitFeedback, isSubmitting, submitted, error } = useDynamicDashboardFeedback(tenantId);
  const { toast } = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [isUseful, setIsUseful] = useState<boolean | null>(null);
  const [isConfusing, setIsConfusing] = useState<boolean | null>(null);
  const [isSlow, setIsSlow] = useState<boolean | null>(null);
  const [missingInfo, setMissingInfo] = useState('');
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const toggleChip = (chip: string) => {
    setMissingCategories((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  };

  if (submitted) {
    return (
      <Card className="border-success/30">
        <CardContent className="py-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="font-medium">Feedback registrado. Obrigado.</p>
            <p className="text-sm text-muted-foreground">
              Sua resposta ajuda a decidir o próximo rollout.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = () => {
    if (!rating) {
      toast({ title: 'Escolha uma nota de 1 a 5', variant: 'destructive' });
      return;
    }
    submitFeedback(
      {
        tenantId,
        dashboardType: 'closer',
        rating,
        isUseful,
        isConfusing,
        isSlow,
        missingInfo: missingInfo.trim() || null,
        comment: comment.trim() || null,
        metadata: {
          sprint: '6.7',
          source: 'runtime',
          missing_categories: missingCategories,
        },
      },
      {
        onError: (e: any) => {
          toast({
            title: 'Não foi possível enviar feedback',
            description: e?.message ?? 'Tente novamente em instantes.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como está esse novo Dashboard Comercial?</CardTitle>
        <CardDescription>Sua resposta ajuda a decidir o próximo rollout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm">Nota</Label>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1"
                aria-label={`Nota ${n}`}
              >
                <Star
                  className={`h-7 w-7 ${
                    rating !== null && n <= rating
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="useful" className="text-sm">Te ajudou hoje?</Label>
            <Switch
              id="useful"
              checked={isUseful === true}
              onCheckedChange={(v) => setIsUseful(v ? true : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="confusing" className="text-sm">Ficou confuso?</Label>
            <Switch
              id="confusing"
              checked={isConfusing === true}
              onCheckedChange={(v) => setIsConfusing(v ? true : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="slow" className="text-sm">Ficou lento?</Label>
            <Switch
              id="slow"
              checked={isSlow === true}
              onCheckedChange={(v) => setIsSlow(v ? true : null)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="missing" className="text-sm">Faltou alguma informação?</Label>
          <Input
            id="missing"
            value={missingInfo}
            onChange={(e) => setMissingInfo(e.target.value)}
            maxLength={500}
            placeholder="Ex: faltou ver propostas em revisão"
          />
        </div>

        <div>
          <Label htmlFor="comment" className="text-sm">Comentário (opcional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder="Conte como foi sua experiência."
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {(error as any)?.message ?? 'Erro ao enviar feedback.'}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar feedback'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
