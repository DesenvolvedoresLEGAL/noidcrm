import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Send, X, Loader2, Github, Activity, Calendar } from "lucide-react";
import {
  type ReleaseDraft,
  type DraftChange,
  useUpdateDraft,
  usePublishDraft,
  useDiscardDraft,
} from "@/hooks/useReleaseNotesAdmin";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeColors: Record<DraftChange["type"], string> = {
  feature: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  fix: "bg-red-500/10 text-red-600 border-red-500/20",
  improvement: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  security: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function ReleaseDraftEditor({ draft }: { draft: ReleaseDraft }) {
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description || "");
  const [isMajor, setIsMajor] = useState(draft.is_major);
  const [changes, setChanges] = useState<DraftChange[]>(draft.changes);
  const [dirty, setDirty] = useState(false);

  const update = useUpdateDraft();
  const publish = usePublishDraft();
  const discard = useDiscardDraft();

  const handleSave = async () => {
    await update.mutateAsync({ id: draft.id, title, description, is_major: isMajor, changes });
    setDirty(false);
  };

  const handlePublish = async () => {
    if (dirty) await handleSave();
    await publish.mutateAsync(draft.id);
  };

  const updateChange = (i: number, patch: Partial<DraftChange>) => {
    setChanges((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  };

  const removeChange = (i: number) => {
    setChanges((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const addChange = () => {
    setChanges((prev) => [...prev, { type: "improvement", description: "" }]);
    setDirty(true);
  };

  const s = draft.source_summary || {};

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              Rascunho
            </Badge>
            <Badge>v{draft.version}</Badge>
            {draft.generated_by && (
              <Badge variant="secondary" className="text-xs">
                {draft.generated_by === "manual" ? "Manual" : "Agendado"}
              </Badge>
            )}
            {(s.github_prs ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Github className="h-3 w-3" /> {s.github_prs} PRs
              </Badge>
            )}
            {(s.system_events ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Activity className="h-3 w-3" /> {s.system_events} eventos
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              {format(parseISO(draft.created_at), "dd MMM HH:mm", { locale: ptBR })}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => discard.mutate(draft.id)}
              disabled={discard.isPending}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-1" /> Descartar
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={publish.isPending || changes.length === 0}>
              {publish.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Send className="h-4 w-4 mr-1" /> Publicar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Descrição</Label>
          <Textarea
            value={description}
            rows={2}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isMajor}
            onCheckedChange={(v) => {
              setIsMajor(v);
              setDirty(true);
            }}
          />
          <Label className="text-sm">Major release</Label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Alterações ({changes.length})</Label>
            <Button size="sm" variant="ghost" onClick={addChange}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          {changes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma alteração. Adicione ao menos uma antes de publicar.
            </p>
          )}
          {changes.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Select value={c.type} onValueChange={(v) => updateChange(i, { type: v as DraftChange["type"] })}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Novidade</SelectItem>
                  <SelectItem value="improvement">Melhoria</SelectItem>
                  <SelectItem value="fix">Correção</SelectItem>
                  <SelectItem value="security">Segurança</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className={`shrink-0 ${typeColors[c.type]}`}>
                {c.type}
              </Badge>
              <Textarea
                value={c.description}
                onChange={(e) => updateChange(i, { description: e.target.value })}
                rows={2}
                className="flex-1"
              />
              <Button size="icon" variant="ghost" onClick={() => removeChange(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
