import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useGenerateDraft } from "@/hooks/useReleaseNotesAdmin";

export function GenerateReleaseDraftButton() {
  const [open, setOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState("14");
  const gen = useGenerateDraft();

  const handleGenerate = async () => {
    await gen.mutateAsync(parseInt(periodDays, 10));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Gerar próxima release
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar rascunho de release</DialogTitle>
          <DialogDescription>
            A IA vai coletar PRs do GitHub (se conectado) + eventos internos do CRM no período
            selecionado, agrupar e gerar um rascunho. Nada é publicado automaticamente — você revisa
            e publica depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodDays} onValueChange={setPeriodDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias (padrão)</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={gen.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={gen.isPending} className="gap-2">
            {gen.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
