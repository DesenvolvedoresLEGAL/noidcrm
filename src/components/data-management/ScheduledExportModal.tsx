import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveScheduledExport, getExportTemplates, type ExportTemplate } from "@/services/crm/data-export";

interface ScheduledExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ScheduledExportModal({ open, onOpenChange, onSuccess }: ScheduledExportModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await getExportTemplates();
      setTemplates(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar templates",
        description: "Não foi possível carregar os templates disponíveis.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    if (emailRecipients.includes(email)) {
      toast({
        title: "Email já adicionado",
        description: "Este email já está na lista.",
        variant: "destructive",
      });
      return;
    }

    setEmailRecipients([...emailRecipients, email]);
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const getCronExpression = (freq: string): string => {
    const cronMap: Record<string, string> = {
      hourly: "0 * * * *",
      daily: "0 0 * * *",
      weekly: "0 0 * * 0",
      monthly: "0 0 1 * *",
    };
    return cronMap[freq] || cronMap.daily;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para a exportação agendada.",
        variant: "destructive",
      });
      return;
    }

    if (!templateId) {
      toast({
        title: "Template obrigatório",
        description: "Selecione um template de exportação.",
        variant: "destructive",
      });
      return;
    }

    if (emailRecipients.length === 0) {
      toast({
        title: "Adicione destinatários",
        description: "Adicione pelo menos um email para receber as exportações.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveScheduledExport({
        name,
        description,
        template_id: templateId,
        cron_expression: getCronExpression(frequency),
        email_recipients: emailRecipients,
      });

      toast({
        title: "Exportação agendada!",
        description: "A exportação será executada automaticamente na frequência definida.",
      });

      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setName("");
      setDescription("");
      setTemplateId("");
      setEmailRecipients([]);
    } catch (error) {
      toast({
        title: "Erro ao agendar exportação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Agendar Exportação Automática</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Agendamento *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Relatório Semanal de Vendas"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              rows={2}
            />
          </div>

          <div>
            <Label>Template de Exportação *</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um template"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id!}>
                    {template.name} ({template.format.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && templates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum template disponível. Crie um template primeiro.
              </p>
            )}
          </div>

          <div>
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">A cada hora</SelectItem>
                <SelectItem value="daily">Diariamente</SelectItem>
                <SelectItem value="weekly">Semanalmente</SelectItem>
                <SelectItem value="monthly">Mensalmente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Destinatários de Email *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
              />
              <Button type="button" onClick={handleAddEmail} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {emailRecipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {emailRecipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Agendar Exportação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
