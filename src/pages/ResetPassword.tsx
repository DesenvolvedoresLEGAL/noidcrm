import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter ao menos 1 letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter ao menos 1 número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword, session } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se há uma sessão de recuperação ativa
    if (!session) {
      toast({
        title: 'Link inválido ou expirado',
        description: 'Por favor, solicite um novo link de recuperação.',
        variant: 'destructive',
      });
      navigate('/forgot-password');
    }
  }, [session, navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validação client-side
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: 'Erro de validação',
          description: firstError.message,
          variant: 'destructive',
        });
        return;
      }

      const { error } = await updatePassword(password);
      
      if (error) throw error;

      toast({
        title: 'Senha atualizada!',
        description: 'Sua senha foi redefinida com sucesso. Faça login com a nova senha.',
      });
      
      navigate('/login');
    } catch (error: any) {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold">NOID CRM</span>
          </div>
          <h1 className="text-2xl font-bold">Nova senha</h1>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>
              Digite sua nova senha para concluir a recuperação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <PasswordInput
                  id="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  showStrength
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
