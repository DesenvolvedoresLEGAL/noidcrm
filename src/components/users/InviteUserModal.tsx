import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  orgRole: z.string().min(1, "Selecione uma função"),
  salesRole: z.string().optional(),
  teamId: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserModal({ open, onOpenChange, onSuccess }: InviteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      orgRole: "sales",
      salesRole: "SDR",
      teamId: "none",
    },
  });

  const watchOrgRole = form.watch('orgRole');
  const showSalesRole = watchOrgRole === 'sales' || watchOrgRole === 'cs';

  // Load teams
  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (data) setTeams(data);
    };
    fetchTeams();
  }, []);

  const onSubmit = async (data: InviteFormData) => {
    try {
      setLoading(true);

      const { data: result, error } = await supabase.functions.invoke("send-user-invitation", {
        body: {
          email: data.email,
          orgRole: data.orgRole,
          salesRole: showSalesRole ? data.salesRole : null,
          teamId: data.teamId && data.teamId !== 'none' ? data.teamId : null,
        },
      });

      if (error) throw error;

      // Check if there's an existing invitation
      if (result?.existingInvitation) {
        toast.warning(
          result.error || "Já existe um convite pendente para este email.",
          {
            description: "Você pode aguardar o convite atual expirar ou cancelá-lo na aba 'Aguardando'.",
            duration: 5000,
          }
        );
        return;
      }

      // Check email sending status
      if (result?.emailSent) {
        toast.success("Convite enviado com sucesso! Email de convite foi enviado.");
      } else if (result?.emailError) {
        toast.warning(
          `Convite criado, mas o email não foi enviado: ${result.emailError}. ` +
          `Você pode copiar o link de convite na aba "Aguardando".`
        );
      } else {
        toast.success("Convite criado com sucesso!");
      }

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orgRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="owner">Proprietário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="sales">Vendedor</SelectItem>
                      <SelectItem value="cs">Customer Success</SelectItem>
                      <SelectItem value="finance">Financeiro/ADM</SelectItem>
                      <SelectItem value="operations">Operacional</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sales Role - Only show for sales/cs org roles */}
            {showSalesRole && (
              <FormField
                control={form.control}
                name="salesRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função Comercial</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a função comercial" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SDR">SDR (Pré-vendas)</SelectItem>
                        <SelectItem value="BDR">BDR (Outbound)</SelectItem>
                        <SelectItem value="AE">AE (Account Executive)</SelectItem>
                        <SelectItem value="Closer">Closer (Fechador)</SelectItem>
                        <SelectItem value="Hunter">Hunter (Novos negócios)</SelectItem>
                        <SelectItem value="Farmer">Farmer (Gestão de carteira)</SelectItem>
                        <SelectItem value="AM">AM (Account Manager)</SelectItem>
                        <SelectItem value="CS">CS (Customer Success)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipe (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma equipe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Convite
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}