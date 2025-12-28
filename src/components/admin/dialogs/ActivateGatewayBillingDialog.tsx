import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Copy, ExternalLink, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ActivateGatewayBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: {
    id: string;
    name: string;
    current_plan_id: string | null;
  };
  currentMRR?: number | null;
}

const PLAN_PRICES: Record<string, number> = {
  neural: 19990,
  pro: 49990,
  enterprise: 99990,
};

export function ActivateGatewayBillingDialog({
  open,
  onOpenChange,
  organization,
  currentMRR,
}: ActivateGatewayBillingDialogProps) {
  const queryClient = useQueryClient();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState<string>("");

  const planId = organization.current_plan_id || "neural";
  const defaultPrice = PLAN_PRICES[planId] || 19990;
  const displayPrice = currentMRR || defaultPrice;

  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const priceToUse = customPrice 
        ? Math.round(parseFloat(customPrice) * 100) 
        : displayPrice;

      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: {
          planId,
          organizationId: organization.id,
          action: "migrate_from_proposal",
          customPrice: priceToUse,
        },
      });

      if (error) throw error;
      if (!data?.checkoutUrl) throw new Error("URL de checkout não gerada");

      return data.checkoutUrl;
    },
    onSuccess: (url) => {
      setCheckoutUrl(url);
      toast.success("Link de checkout gerado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao gerar checkout: ${error.message}`);
    },
  });

  const copyToClipboard = async () => {
    if (checkoutUrl) {
      await navigator.clipboard.writeText(checkoutUrl);
      toast.success("Link copiado para a área de transferência");
    }
  };

  const openCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const handleClose = () => {
    setCheckoutUrl(null);
    setCustomPrice("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ativar Cobrança Automática
          </DialogTitle>
          <DialogDescription>
            Gerar link de checkout para migrar cliente de proposta para assinatura recorrente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Organization Info */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Organização</Label>
            <p className="font-medium">{organization.name}</p>
          </div>

          {/* Plan Info */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Plano</Label>
            <Badge variant="outline" className="capitalize">
              {planId}
            </Badge>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Valor Mensal Sugerido</Label>
            <p className="text-lg font-semibold text-emerald-600">
              {formatCurrency(displayPrice)}
            </p>
            {currentMRR && (
              <p className="text-xs text-muted-foreground">
                Baseado no MRR da proposta vinculada
              </p>
            )}
          </div>

          {/* Custom Price Override */}
          <div className="space-y-2">
            <Label htmlFor="customPrice">Valor Personalizado (opcional)</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">R$</span>
              <Input
                id="customPrice"
                type="number"
                step="0.01"
                placeholder="199.90"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Generated Checkout URL */}
          {checkoutUrl && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <Label className="text-muted-foreground">Link de Checkout</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={checkoutUrl}
                  readOnly
                  className="text-xs"
                />
                <Button size="icon" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={openCheckout}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          
          {!checkoutUrl ? (
            <Button
              onClick={() => createCheckoutMutation.mutate()}
              disabled={createCheckoutMutation.isPending}
            >
              {createCheckoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Link de Checkout"
              )}
            </Button>
          ) : (
            <Button onClick={copyToClipboard} className="gap-2">
              <Mail className="h-4 w-4" />
              Copiar e Enviar ao Cliente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
