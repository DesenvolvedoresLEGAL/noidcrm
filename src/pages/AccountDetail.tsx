import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountDetailHeader } from '@/components/accounts/AccountDetailHeader';
import { AccountSidebar } from '@/components/accounts/AccountSidebar';
import { AccountOverviewTabEnhanced } from '@/components/accounts/AccountOverviewTabEnhanced';
import { AccountContactsTab } from '@/components/accounts/AccountContactsTab';
import { AccountOpportunitiesTab } from '@/components/accounts/AccountOpportunitiesTab';
import { AccountActivitiesTab } from '@/components/accounts/AccountActivitiesTab';
import { AccountTimelineTab } from '@/components/accounts/AccountTimelineTab';

import { useAccountDetails } from '@/hooks/useAccountDetails';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccount } from '@/services/supabase/accounts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Read tab and returnTo from URL query parameters
  const defaultTab = searchParams.get('tab') || 'overview';
  const returnTo = searchParams.get('returnTo');

  const { data: account, isLoading, error } = useAccountDetails(id!);

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta excluída com sucesso' });
      navigate('/app/accounts');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-muted-foreground">Carregando conta...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !account) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-destructive mb-4">
                  {error?.message || 'Conta não encontrada'}
                </p>
                <button
                  onClick={() => navigate('/app/accounts')}
                  className="text-primary hover:underline"
                >
                  Voltar para Contas
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {returnTo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(decodeURIComponent(returnTo))}
            className="text-muted-foreground hover:text-foreground -mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Oportunidade
          </Button>
        )}
        
        {/* Header */}
        <AccountDetailHeader
          account={account}
          onDelete={() => setDeleteDialogOpen(true)}
        />

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content - 8 columns */}
          <div className="lg:col-span-8">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="contacts">Contatos</TabsTrigger>
                <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
                <TabsTrigger value="activities">Atividades</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <AccountOverviewTabEnhanced account={account} />
              </TabsContent>

              <TabsContent value="contacts" className="mt-6">
                <AccountContactsTab
                  accountId={account.id}
                  accountName={account.nome_fantasia || account.razao_social}
                />
              </TabsContent>

              <TabsContent value="opportunities" className="mt-6">
                <AccountOpportunitiesTab
                  accountId={account.id}
                  accountName={account.nome_fantasia || account.razao_social}
                />
              </TabsContent>

              <TabsContent value="activities" className="mt-6">
                <AccountActivitiesTab
                  accountId={account.id}
                  accountName={account.nome_fantasia || account.razao_social}
                />
              </TabsContent>

              <TabsContent value="timeline" className="mt-6">
                <AccountTimelineTab
                  accountId={account.id}
                  accountName={account.nome_fantasia || account.razao_social}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - 4 columns */}
          <div className="lg:col-span-4">
            <AccountSidebar account={account} />
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{account.razao_social}"?
              Esta ação não pode ser desfeita e todos os dados relacionados
              (contatos, oportunidades, atividades) podem ser afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(account.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
