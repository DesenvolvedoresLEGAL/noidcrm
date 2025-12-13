import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Credenciais inválidas");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Erro ao autenticar usuário");
        setLoading(false);
        return;
      }

      // Check if user is a platform admin
      const { data: isPlatformAdmin, error: checkError } = await supabase.rpc(
        'is_platform_admin',
        { _user_id: authData.user.id }
      );

      if (checkError || !isPlatformAdmin) {
        // Log unauthorized access attempt
        await supabase.from('admin_access_logs').insert({
          user_id: authData.user.id,
          action: 'unauthorized_login_attempt',
          ip_address: null,
          metadata: { email }
        });
        
        // Sign out the user
        await supabase.auth.signOut();
        setError("Acesso não autorizado. Você não é um administrador da plataforma.");
        setLoading(false);
        return;
      }

      // Log successful login
      await supabase.from('admin_access_logs').insert({
        user_id: authData.user.id,
        action: 'admin_login',
        ip_address: null,
        metadata: { email }
      });

      toast.success("Login realizado com sucesso!");
      navigate("/admin");
    } catch (err) {
      console.error("Login error:", err);
      setError("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Admin Panel</CardTitle>
            <CardDescription>Acesso restrito a administradores da plataforma</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Entrar no Admin
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              Este painel é restrito a administradores autorizados.
              <br />
              Todas as ações são registradas em log de auditoria.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
