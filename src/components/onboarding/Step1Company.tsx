import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, CheckCircle, Users, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Step1Props {
  onNext: (data: Step1Data) => void;
}

export interface Step1Data {
  companyName: string;
  industry: string;
  teamSize: string;
  cnpj?: string;
  slgProposalId?: string;
  slgPlan?: string;
  slgMaxUsers?: number;
}

interface AcceptedProposal {
  id: string;
  proposal_number: string;
  account_name: string;
  plan_name: string;
  max_users: number;
  monthly_value: number;
}

const TEAM_SIZES = [
  'Apenas eu',
  '2-5 pessoas',
  '6-10 pessoas',
  '11-25 pessoas',
  '26-50 pessoas',
  '51+ pessoas'
];

// Função para formatar CNPJ
const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

export function Step1Company({ onNext }: Step1Props) {
  const [formData, setFormData] = useState<Step1Data>({
    companyName: '',
    industry: '',
    teamSize: '',
    cnpj: ''
  });
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [acceptedProposal, setAcceptedProposal] = useState<AcceptedProposal | null>(null);
  const [isSearchingProposal, setIsSearchingProposal] = useState(false);
  const [cnpjSearched, setCnpjSearched] = useState('');

  // Fetch system default industries from database
  const { data: industries = [], isLoading: isLoadingIndustries } = useQuery({
    queryKey: ['industries', 'system-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('id, name, icon')
        .is('organization_id', null)
        .eq('is_active', true)
        .eq('is_system_default', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Buscar proposta aceita quando CNPJ for preenchido completamente
  useEffect(() => {
    const searchProposalByCNPJ = async () => {
      const cleanCNPJ = formData.cnpj?.replace(/\D/g, '') || '';
      
      // Verificar se o CNPJ tem 14 dígitos e ainda não foi pesquisado
      if (cleanCNPJ.length === 14 && cleanCNPJ !== cnpjSearched) {
        setIsSearchingProposal(true);
        setCnpjSearched(cleanCNPJ);

        try {
          // Formatar CNPJ para buscar no banco
          const formattedCNPJ = `${cleanCNPJ.slice(0,2)}.${cleanCNPJ.slice(2,5)}.${cleanCNPJ.slice(5,8)}/${cleanCNPJ.slice(8,12)}-${cleanCNPJ.slice(12,14)}`;
          
          // Buscar conta pelo CNPJ formatado
          const { data: account } = await supabase
            .from('accounts')
            .select('id, razao_social, cnpj')
            .eq('cnpj', formattedCNPJ)
            .maybeSingle();

          if (account) {
            // Buscar oportunidades dessa conta com propostas aceitas
            const { data: opportunities } = await supabase
              .from('opportunities')
              .select('id')
              .eq('account_id', account.id);

            if (opportunities && opportunities.length > 0) {
              const oppIds = opportunities.map(o => o.id);

              // Buscar proposta aceita vinculada às oportunidades
              const { data: proposals } = await supabase
                .from('proposals')
                .select(`
                  id,
                  proposal_number,
                  title,
                  total_amount
                `)
                .in('opportunity_id', oppIds)
                .eq('status', 'accepted')
                .order('created_at', { ascending: false })
                .limit(1);

              if (proposals && proposals.length > 0) {
                const proposal = proposals[0];

                // Buscar payment terms para pegar o valor mensal
                const { data: paymentTerms } = await supabase
                  .from('proposal_payment_terms')
                  .select('monthly_value')
                  .eq('proposal_id', proposal.id)
                  .in('payment_type', ['recurring', 'subscription'])
                  .limit(1);

                const monthlyValue = paymentTerms?.[0]?.monthly_value || 0;
                
                // Calcular número de usuários baseado no valor (R$ 199,90/usuário plano Neural)
                const PRICE_PER_USER = 199.90;
                const estimatedUsers = monthlyValue > 0 ? Math.round(monthlyValue / PRICE_PER_USER) : 1;

                setAcceptedProposal({
                  id: proposal.id,
                  proposal_number: proposal.proposal_number,
                  account_name: account.razao_social,
                  plan_name: 'Neural', // Plano padrão para SLG
                  max_users: estimatedUsers,
                  monthly_value: monthlyValue,
                });

                // Auto-preencher nome da empresa
                if (!formData.companyName) {
                  setFormData(prev => ({ ...prev, companyName: account.razao_social }));
                }

                setShowProposalModal(true);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar proposta por CNPJ:', error);
        } finally {
          setIsSearchingProposal(false);
        }
      }
    };

    searchProposalByCNPJ();
  }, [formData.cnpj, cnpjSearched, formData.companyName]);

  const handleConfirmProposal = () => {
    if (acceptedProposal) {
      // Atualizar formData com dados da proposta SLG
      setFormData(prev => ({
        ...prev,
        slgProposalId: acceptedProposal.id,
        slgPlan: acceptedProposal.plan_name.toLowerCase(),
        slgMaxUsers: acceptedProposal.max_users,
      }));
    }
    setShowProposalModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  // CNPJ é obrigatório
  const cleanCNPJ = formData.cnpj?.replace(/\D/g, '') || '';
  const isValidCNPJ = cleanCNPJ.length === 14;
  const isValid = formData.companyName.length >= 2 && formData.industry && formData.teamSize && isValidCNPJ;

  return (
    <Card className="border-2 shadow-xl animate-fade-in">
      <CardContent className="pt-12 pb-8 px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Vamos começar! 🚀</h2>
          <p className="text-lg text-muted-foreground">
            Conte-nos sobre sua empresa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da empresa *</Label>
            <Input
              id="companyName"
              placeholder="Ex: Acme Corporation"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Segmento *</Label>
            <Select 
              value={formData.industry} 
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
              disabled={isLoadingIndustries}
            >
              <SelectTrigger id="industry" className="h-11">
                {isLoadingIndustries ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground">Carregando...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Selecione seu segmento" />
                )}
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry.id} value={industry.name}>
                    {industry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamSize">Tamanho do time *</Label>
            <Select value={formData.teamSize} onValueChange={(value) => setFormData({ ...formData, teamSize: value })}>
              <SelectTrigger id="teamSize" className="h-11">
                <SelectValue placeholder="Quantas pessoas?" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <div className="relative">
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                className="h-11"
                maxLength={18}
                required
              />
              {isSearchingProposal && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {acceptedProposal && formData.slgProposalId && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            {acceptedProposal && formData.slgProposalId && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Proposta aprovada: {acceptedProposal.plan_name} com {acceptedProposal.max_users} usuário(s)
              </p>
            )}
            {!isValidCNPJ && formData.cnpj && formData.cnpj.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Digite o CNPJ completo (14 dígitos)
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!isValid}>
            Continuar →
          </Button>
        </form>
      </CardContent>

      {/* Modal de confirmação da proposta SLG */}
      <Dialog open={showProposalModal} onOpenChange={setShowProposalModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Proposta Comercial Encontrada!
            </DialogTitle>
            <DialogDescription>
              Encontramos uma proposta aprovada para este CNPJ. Confirme os dados abaixo.
            </DialogDescription>
          </DialogHeader>

          {acceptedProposal && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Empresa</span>
                <span className="font-medium">{acceptedProposal.account_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Proposta</span>
                <Badge variant="outline">{acceptedProposal.proposal_number}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plano</span>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {acceptedProposal.plan_name}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Usuários Contratados
                </span>
                <span className="font-bold text-lg">{acceptedProposal.max_users}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  Mensalidade
                </span>
                <span className="font-bold text-lg text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acceptedProposal.monthly_value)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowProposalModal(false)}>
              Não sou eu
            </Button>
            <Button onClick={handleConfirmProposal}>
              Confirmar e Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
