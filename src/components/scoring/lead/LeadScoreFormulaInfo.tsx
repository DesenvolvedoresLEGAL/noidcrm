import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function LeadScoreFormulaInfo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-background/50 backdrop-blur-sm"
          aria-label="Como o Lead Score é calculado?"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Como o Lead Score é calculado?
          </DialogTitle>
          <DialogDescription>
            Fórmula determinística baseada em FIT (perfil ideal) e INTENT (engajamento).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Formula */}
          <div className="rounded-lg border bg-muted/40 p-4 font-mono text-sm">
            <div className="text-center text-base font-semibold">
              LEAD SCORE = (FIT × 0.4) + (INTENT × 0.6)
            </div>
          </div>

          {/* FIT */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30" variant="outline">
                FIT
              </Badge>
              <h3 className="font-semibold">Perfil Ideal (0–100 pts)</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <Row label="Segmento premium (Eventos, Tecnologia, Marketing, Financeiro, Corporativo)" max="25 pts" />
              <Row label="Tamanho da empresa (Grande=20, Média=15, Pequena=10, Micro=5)" max="20 pts" />
              <Row label="Capital social (≥1M=15, ≥100k=10, demais=5)" max="15 pts" />
              <Row label="Localização (SP/RJ=15, MG/RS/PR/SC=10, demais=5)" max="15 pts" />
              <Row label="Dados completos (CNPJ, telefone, e-mail, cidade/UF, segmento)" max="25 pts" />
            </ul>
          </section>

          <Separator />

          {/* INTENT */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30" variant="outline">
                INTENT
              </Badge>
              <h3 className="font-semibold">Engajamento (0–100 pts)</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <Row label="Cliente ativo (possui deals 'won')" max="40 pts" />
              <Row label="Bônus por deals ganhos (10 pts cada, máx 20)" max="20 pts" />
              <Row label="Recência: deal ganho nos últimos 6 meses" max="10 pts" />
              <Row label="Valor ganho acumulado (≥100k=15, ≥50k=10)" max="15 pts" />
              <Row label="Atividades recentes (com decay -2 pts/semana)" max="40 pts" />
              <Row label="Propostas + visualizações + recência de view" max="40 pts" />
              <Row
                label="Penalidade: sem atividade nos últimos 14 dias"
                max="−15 pts (−5 se cliente)"
                negative
              />
            </ul>
          </section>

          <Separator />

          {/* Grades */}
          <section>
            <h3 className="font-semibold mb-3">Faixas (Grades)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
              <GradeBox grade="A" label="≥ 80" hint="Quente" color="bg-green-500/10 text-green-600 border-green-500/30" />
              <GradeBox grade="B" label="60 – 79" hint="Ativo" color="bg-blue-500/10 text-blue-600 border-blue-500/30" />
              <GradeBox grade="C" label="40 – 59" hint="Morno" color="bg-yellow-500/10 text-yellow-600 border-yellow-500/30" />
              <GradeBox grade="D" label="20 – 39" hint="Frio" color="bg-orange-500/10 text-orange-600 border-orange-500/30" />
              <GradeBox grade="F" label="< 20" hint="Gelado" color="bg-red-500/10 text-red-600 border-red-500/30" />
            </div>
          </section>

          <div className="text-xs text-muted-foreground border-t pt-3">
            <strong>Próxima fase (v2):</strong> camada de ML + RAG + KAG para incorporar contexto financeiro,
            histórico de oportunidades, contatos e padrões de conversão por segmento.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, max, negative }: { label: string; max: string; negative?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-1 border-b border-dashed border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs whitespace-nowrap ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {max}
      </span>
    </li>
  );
}

function GradeBox({ grade, label, hint, color }: { grade: string; label: string; hint: string; color: string }) {
  return (
    <div className={`rounded-md border p-2 ${color}`}>
      <div className="text-lg font-bold">{grade}</div>
      <div className="font-mono text-[11px]">{label}</div>
      <div className="text-[10px] opacity-80">{hint}</div>
    </div>
  );
}
