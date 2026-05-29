import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

const acceptSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type AcceptFormData = z.infer<typeof acceptSchema>;

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AcceptFormData>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token de convite não fornecido");
        setLoading(false);
        return;
      }

      try {
        // Secure token lookup via SECURITY DEFINER RPC — only returns the
        // single matching pending invitation when the exact token is provided.
        const { data, error } = await supabase
          .rpc("get_invitation_by_token", { p_token: token });

        const invite = Array.isArray(data) ? data[0] : data;
        if (error || !invite) {
          console.error("Invitation error:", error);
          setError("Convite inválido, expirado ou já utilizado");
          setLoading(false);
          return;
        }

        setInvitation(invite);
      } catch (err) {
        console.error("Error validating invitation:", err);
        setError("Erro ao validar o convite");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const onSubmit = async (data: AcceptFormData) => {
    if (!invitation || !token) return;

    try {
      setSubmitting(true);

      // Call edge function to handle invitation acceptance securely
      const { data: result, error } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token,
          fullName: data.fullName,
          password: data.password,
        },
      });

      if (error) {
        console.error("Error accepting invitation:", error);
        toast.error(error.message || "Erro ao aceitar convite");
        return;
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      // If session is returned, set it for automatic login
      if (result?.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        if (sessionError) {
          console.error("Error setting session:", sessionError);
          toast.success("Conta criada! Faça login para continuar.");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        toast.success("Conta criada com sucesso! Redirecionando...");
        setTimeout(() => navigate("/app/dashboard"), 1500);
      } else if (result?.requiresLogin) {
        toast.success(result.message || "Conta criada! Faça login para continuar.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.success("Conta criada com sucesso!");
        setTimeout(() => navigate("/app/dashboard"), 1500);
      }
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error(error.message || "Erro ao aceitar convite");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Convite Inválido</CardTitle>
            <CardDescription>{error || "Convite não encontrado"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/login")} className="w-full">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <CardTitle>Você foi convidado!</CardTitle>
          </div>
          <CardDescription>
            Você foi convidado para criar sua conta e fazer parte do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{invitation.email}</p>
              </div>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Mínimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Digite a senha novamente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aceitar Convite e Criar Conta
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}