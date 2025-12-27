import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Key } from "lucide-react";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    full_name: string;
    email: string;
  } | null;
}

export function ResetPasswordDialog({ 
  open, 
  onOpenChange, 
  user 
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!user) return;

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: {
          userId: user.user_id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Senha alterada com sucesso para ${user.full_name || user.email}`);
      onOpenChange(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Alterar Senha do Usuário
          </DialogTitle>
          <DialogDescription>
            Definir uma nova senha para <strong>{user?.full_name || user?.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              showStrength
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Senha</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleReset} disabled={loading || !newPassword || !confirmPassword}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando...
              </>
            ) : (
              "Alterar Senha"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
