import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Clock, 
  Search, 
  RefreshCw,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  Unlock,
  MoreHorizontal,
  ArrowUpRight
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TrialOrg {
  id: string;
  name: string;
  status: string;
  trial_ends_at: string | null;
  current_plan_id: string | null;
  created_at: string;
  trial_block?: {
    id: string;
    blocked_at: string;
    grace_period_ends_at: string;
    unblocked_at: string | null;
  } | null;
}

export default function TrialManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'blocked'>('all');
  const queryClient = useQueryClient();

  // Fetch organizations with trial info
  const { data: organizations, isLoading, refetch } = useQuery({
    queryKey: ['admin-trial-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          status,
          trial_ends_at,
          current_plan_id,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch trial blocks separately
      const { data: blocks } = await supabase
        .from('trial_blocks')
        .select('*')
        .is('unblocked_at', null);

      const blocksMap = new Map(blocks?.map(b => [b.organization_id, b]));

      return (data || []).map(org => ({
        ...org,
        trial_block: blocksMap.get(org.id) || null,
      })) as TrialOrg[];
    },
  });

  // Unblock mutation
  const unblockMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc('unblock_trial', {
        org_id: orgId,
        by_user_id: (await supabase.auth.getUser()).data.user?.id,
        reason: 'admin_manual_unblock'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trial desbloqueado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin-trial-orgs'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao desbloquear: ${error.message}`);
    },
  });

  // Filter organizations
  const filteredOrgs = organizations?.filter(org => {
    // Search filter
    if (searchQuery && !org.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    const now = new Date();
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const daysRemaining = trialEnd ? differenceInDays(trialEnd, now) : null;

    switch (filter) {
      case 'active':
        return org.status === 'trial' && daysRemaining !== null && daysRemaining > 3;
      case 'expiring':
        return org.status === 'trial' && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
      case 'expired':
        return org.status === 'trial' && daysRemaining !== null && daysRemaining <= 0;
      case 'blocked':
        return org.trial_block !== null || org.status === 'suspended';
      default:
        return true;
    }
  });

  // Stats
  const stats = {
    total: organizations?.length || 0,
    active: organizations?.filter(o => o.status === 'trial' && o.trial_ends_at && differenceInDays(new Date(o.trial_ends_at), new Date()) > 3).length || 0,
    expiring: organizations?.filter(o => o.status === 'trial' && o.trial_ends_at && differenceInDays(new Date(o.trial_ends_at), new Date()) <= 3 && differenceInDays(new Date(o.trial_ends_at), new Date()) > 0).length || 0,
    blocked: organizations?.filter(o => o.trial_block || o.status === 'suspended').length || 0,
  };

  const getStatusBadge = (org: TrialOrg) => {
    if (org.trial_block || org.status === 'suspended') {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (org.status === 'active') {
      return <Badge className="bg-green-500">Ativo</Badge>;
    }
    if (org.status === 'trial' && org.trial_ends_at) {
      const days = differenceInDays(new Date(org.trial_ends_at), new Date());
      if (days <= 0) return <Badge variant="destructive">Expirado</Badge>;
      if (days <= 3) return <Badge className="bg-amber-500">Expirando</Badge>;
      return <Badge variant="secondary">Em Trial</Badge>;
    }
    return <Badge variant="outline">{org.status}</Badge>;
  };

  const getDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    const days = differenceInDays(new Date(trialEndsAt), new Date());
    if (days < 0) return `${Math.abs(days)}d atrás`;
    if (days === 0) return 'Hoje';
    return `${days}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Gestão de Trials
          </h1>
          <p className="text-muted-foreground">
            Monitore e gerencie períodos de teste de organizações
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${filter === 'active' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('active')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${filter === 'expiring' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('expiring')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.expiring}</p>
                <p className="text-sm text-muted-foreground">Expirando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${filter === 'blocked' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('blocked')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.blocked}</p>
                <p className="text-sm text-muted-foreground">Bloqueados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome da organização..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Organizações</CardTitle>
          <CardDescription>
            {filteredOrgs?.length || 0} organizações encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dias Restantes</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs?.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {org.current_plan_id || 'neural'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(org)}</TableCell>
                    <TableCell>
                      {org.trial_ends_at ? (
                        <span className={`font-mono ${
                          differenceInDays(new Date(org.trial_ends_at), new Date()) <= 3 
                            ? 'text-destructive font-bold' 
                            : ''
                        }`}>
                          {getDaysRemaining(org.trial_ends_at)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {org.trial_ends_at 
                        ? format(new Date(org.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => window.open(`/admin/organizations/${org.id}`, '_blank')}
                            className="gap-2"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {(org.trial_block || org.status === 'suspended') && (
                            <DropdownMenuItem 
                              onClick={() => unblockMutation.mutate(org.id)}
                              className="gap-2 text-green-600"
                            >
                              <Unlock className="w-4 h-4" />
                              Desbloquear Trial
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
