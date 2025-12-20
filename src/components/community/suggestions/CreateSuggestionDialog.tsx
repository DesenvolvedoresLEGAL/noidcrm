import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lightbulb, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSuggestions, ImpactArea, PerceivedImpact, CreateSuggestionData } from "@/hooks/useSuggestions";

const suggestionSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(255),
  description: z.string().min(50, "Descrição deve ter pelo menos 50 caracteres"),
  impact_area: z.enum(["sales", "ai", "cs", "ux", "other"] as const),
  perceived_impact: z.enum(["low", "medium", "high", "critical"] as const),
});

type SuggestionFormData = z.infer<typeof suggestionSchema>;

const impactAreaOptions = [
  { value: "sales", label: "Vendas" },
  { value: "ai", label: "Inteligência Artificial" },
  { value: "cs", label: "Customer Success" },
  { value: "ux", label: "Experiência do Usuário" },
  { value: "other", label: "Outro" },
];

const perceivedImpactOptions = [
  { value: "low", label: "Baixo", description: "Melhoria incremental" },
  { value: "medium", label: "Médio", description: "Impacto moderado" },
  { value: "high", label: "Alto", description: "Grande diferença" },
  { value: "critical", label: "Crítico", description: "Transformador" },
];

export function CreateSuggestionDialog() {
  const [open, setOpen] = useState(false);
  const { createSuggestion } = useSuggestions();

  const form = useForm<SuggestionFormData>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: "",
      description: "",
      impact_area: "sales",
      perceived_impact: "medium",
    },
  });

  const onSubmit = async (data: SuggestionFormData) => {
    await createSuggestion.mutateAsync(data as CreateSuggestionData);
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Nova Sugestão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Sugira melhorias para o NOID
          </DialogTitle>
          <DialogDescription>
            Sua ideia pode virar a próxima funcionalidade. Descreva em detalhes 
            o que você gostaria de ver no produto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da sugestão</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Integração com WhatsApp Business" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição detalhada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva sua sugestão em detalhes. Quanto mais contexto, melhor entenderemos sua necessidade..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mínimo 50 caracteres. Inclua exemplos de uso se possível.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="impact_area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área impactada</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {impactAreaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="perceived_impact"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Impacto percebido</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      {perceivedImpactOptions.map((option) => (
                        <div key={option.value}>
                          <RadioGroupItem
                            value={option.value}
                            id={option.value}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={option.value}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSuggestion.isPending}
              >
                {createSuggestion.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enviar sugestão
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
