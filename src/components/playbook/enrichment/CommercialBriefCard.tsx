import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Copy, MessageSquare, Target, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface CommercialBriefCardProps {
  brief: {
    executive_summary?: string | null;
    why_now?: string | null;
    probable_pains?: any;
    value_hypotheses?: any;
    recommended_pitch_angle?: string | null;
    recommended_channel?: string | null;
    first_touch_message?: string | null;
    objection_predictions?: any;
    confidence?: number | null;
  };
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado!`);
}

export function CommercialBriefCard({ brief }: CommercialBriefCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Brief Comercial
          {brief.confidence != null && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {Math.round((brief.confidence as number) * 100)}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {brief.executive_summary && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Resumo Executivo</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(brief.executive_summary!, 'Resumo')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-muted-foreground">{brief.executive_summary}</p>
          </div>
        )}

        {brief.why_now && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Por que agora?</span>
            <p className="text-muted-foreground">{brief.why_now}</p>
          </div>
        )}

        {(brief.probable_pains as string[])?.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><Target className="h-3 w-3" />Dores Prováveis</span>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {(brief.probable_pains as string[]).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {(brief.value_hypotheses as string[])?.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Hipóteses de Valor</span>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {(brief.value_hypotheses as string[]).map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}

        {brief.recommended_pitch_angle && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Ângulo de Abordagem</span>
            <p className="text-muted-foreground">{brief.recommended_pitch_angle}</p>
          </div>
        )}

        {brief.first_touch_message && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><MessageSquare className="h-3 w-3" />Mensagem Inicial</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(brief.first_touch_message!, 'Mensagem')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3 rounded-md bg-primary/5 border border-primary/10 text-muted-foreground whitespace-pre-wrap">
              {brief.first_touch_message}
            </div>
          </div>
        )}

        {(brief.objection_predictions as string[])?.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><Shield className="h-3 w-3" />Objeções Previstas</span>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {(brief.objection_predictions as string[]).map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
