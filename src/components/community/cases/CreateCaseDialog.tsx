import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trophy, Loader2 } from "lucide-react";
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
import { useCases, CaseCategory } from "@/hooks/useCases";

const caseSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(255),
  summary: z.string().min(20, "Resumo deve ter pelo menos 20 caracteres").max(500),
  content: z.string().min(100, "Conteúdo deve ter pelo menos 100 caracteres"),
  category: z.enum(["win_story", "learning", "tip", "process"] as const),
});

type CaseFormData = z.infer<typeof caseSchema>;

const categoryOptions = [
  { value: "win_story", label: "Win Story", description: "Compartilhe uma conquista" },
  { value: "learning", label: "Aprendizado", description: "O que você aprendeu" },
  { value: "tip", label: "Dica", description: "Uma dica prática" },
  { value: "process", label: "Processo", description: "Um processo que funciona" },
];

export function CreateCaseDialog() {
  const [open, setOpen] = useState(false);
  const { createCase } = useCases();

  const form = useForm<CaseFormData>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      title: "",
      summary: "",
      content: "",
      category: "win_story",
    },
  });

  const onSubmit = async (data: CaseFormData) => {
    await createCase.mutateAsync(data);
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Trophy className="h-4 w-4" />
          Compartilhar Case
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Compartilhar case ou aprendizado
          </DialogTitle>
          <DialogDescription>
            Compartilhe seus resultados e aprendizados com a comunidade. 
            Cases serão revisados antes da publicação.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de case</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-muted-foreground ml-2">- {option.description}</span>
                          </div>
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Como aumentamos 40% a conversão usando o Forecast com IA" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resumo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Um breve resumo do seu case (será exibido na listagem)"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Máximo 500 caracteres
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo completo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva seu case em detalhes. Inclua contexto, ações tomadas e resultados..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mínimo 100 caracteres. Quanto mais detalhes, melhor!
                  </FormDescription>
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
                disabled={createCase.isPending}
              >
                {createCase.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enviar para aprovação
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
