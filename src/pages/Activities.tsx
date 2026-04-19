import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  List, 
  Calendar as CalendarIcon, 
  Search, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2,
  Users,
  BarChart3,
  CheckSquare
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/activities/FilterBar';
import { ActivityTable } from '@/components/activities/ActivityTable';
import { ActivityCalendar } from '@/components/activities/ActivityCalendar';
import { ActivityCard } from '@/components/activities/ActivityCard';
import { CreateActivityModal } from '@/components/activities/CreateActivityModal';
import { EditActivityModal } from '@/components/activities/EditActivityModal';
import { ProductivityDashboard } from '@/components/activities/ProductivityDashboard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Activity } from '@/services/crm/types';
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
  markActivityAsNoShow,
  getActivityStats,
} from '@/services/crm/activities';
import { bulkDeleteActivities } from '@/services/supabase/activities';
import { BulkActionsBar } from '@/components/activities/BulkActionsBar';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { supabase } from '@/integrations/supabase/client';

interface Seller {
  id: string;
  name: string;
}

const PRIVILEGED_ROLES = ['owner', 'admin', 'manager', 'finance'];

export default function Activities() {
  const { visibleUserIds } = useTeamVisibility();
  const [activeTab, setActiveTab] = useState<'activities' | 'productivity'>('activities');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({ overdue: 0, today: 0, thisWeek: 0, thisMonth: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canFilterBySeller, setCanFilterBySeller] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  // Carregar role do usuário e vendedores da organização
  useEffect(() => {
    const loadUserRoleAndSellers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgId } = await supabase.rpc('get_user_organization_id');
        if (!orgId) return;

        // Buscar role do usuário atual
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('org_role')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .maybeSingle();

        const role = memberData?.org_role || null;
        setUserRole(role);
        
        const isPrivileged = role && PRIVILEGED_ROLES.includes(role);
        setCanFilterBySeller(isPrivileged);

        // Se for role privilegiada, carregar TODOS os usuários da organização (para o dropdown)
        if (isPrivileged) {
          const { data: members, error: membersError } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', orgId)
            .eq('status', 'active')
            .is('deleted_at', null);

          if (membersError) throw membersError;

          const userIds = (members || []).map((m: any) => m.user_id).filter(Boolean);

          if (userIds.length === 0) {
            setSellers([]);
            return;
          }

          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          if (profilesError) throw profilesError;

          const nameById: Record<string, string> = Object.fromEntries(
            (profiles || []).map((p: any) => [p.user_id, p.full_name || 'Sem nome'])
          );

          const usersList = userIds
            .map((id: string) => ({ id, name: nameById[id] || 'Sem nome' }))
            .sort((a, b) => a.name.localeCompare(b.name));

          setSellers(usersList);
        }
      } catch (error) {
        console.error('Error loading user role and sellers:', error);
      }
    };
    loadUserRoleAndSellers();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      // Determinar quais IDs usar para filtro
      let filterUserIds: string[] | undefined;
      
      if (selectedSellerId && selectedSellerId !== 'all') {
        // Filtro específico de vendedor
        filterUserIds = [selectedSellerId];
      } else if (visibleUserIds && visibleUserIds.length > 0) {
        // Visibilidade por time (para managers)
        filterUserIds = visibleUserIds;
      }

      const response = await listActivities({
        search: searchQuery,
        page,
        page_size: pageSize,
        owner_user_ids: filterUserIds,
        date_filter: activeFilter,
        status_filter: statusFilter,
      });
      setActivities(response.activities);
      setTotal(response.total);

      const statsData = await getActivityStats(filterUserIds);
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Erro ao carregar atividades',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [activeFilter, searchQuery, page, pageSize, visibleUserIds, selectedSellerId, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeFilter, searchQuery, selectedSellerId, statusFilter]);

  const handleCreateActivity = async (data: Partial<Activity>) => {
    try {
      await createActivity(data);
      toast({
        title: 'Atividade criada',
        description: 'A atividade foi criada com sucesso',
      });
      loadActivities();
    } catch (error) {
      console.error('Error creating activity:', error);
      toast({
        title: 'Erro ao criar atividade',
        description: 'Não foi possível criar a atividade. Tente novamente.',
        variant: 'destructive',
      });
      throw error; // Relançar erro para o modal saber que falhou
    }
  };

  const handleUpdateActivity = async (id: string, data: Partial<Activity>) => {
    try {
      await updateActivity(id, data);
      toast({
        title: 'Atividade atualizada',
        description: 'A atividade foi atualizada com sucesso',
      });
      loadActivities();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar atividade',
        description: 'Verifique suas permissões e tente novamente.',
        variant: 'destructive',
      });
      throw error; // importante: manter o modal aberto
    }
  };

  const handleCompleteActivity = async (id: string) => {
    try {
      await completeActivity(id);
      toast({
        title: 'Atividade concluída',
        description: 'A atividade foi marcada como concluída',
      });
      loadActivities();
    } catch (error) {
      toast({
        title: 'Erro ao concluir atividade',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  };

  const handleNoShowActivity = async (id: string) => {
    try {
      await markActivityAsNoShow(id);
      toast({
        title: 'Atividade marcada como no-show',
        description: 'A atividade foi marcada como no-show',
      });
      loadActivities();
    } catch (error) {
      toast({
        title: 'Erro ao marcar atividade',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteActivity = async () => {
    if (!activityToDelete) return;
    
    try {
      await deleteActivity(activityToDelete);
      toast({
        title: 'Atividade excluída',
        description: 'A atividade foi excluída com sucesso',
      });
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
      loadActivities();
    } catch (error) {
      toast({
        title: 'Erro ao excluir atividade',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (activity: Activity) => {
    setSelectedActivity(activity);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setActivityToDelete(id);
    setDeleteDialogOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  const statCards = [
    {
      title: 'Atividades Hoje',
      value: stats.today.toString(),
      icon: Calendar,
      color: 'text-primary',
      description: 'Agendadas para hoje',
    },
    {
      title: 'Atrasadas',
      value: stats.overdue.toString(),
      icon: AlertCircle,
      color: 'text-destructive',
      description: 'Requer atenção',
    },
    {
      title: 'Esta Semana',
      value: stats.thisWeek.toString(),
      icon: TrendingUp,
      color: 'text-accent',
      description: 'Próximos 7 dias',
    },
    {
      title: 'Agendadas',
      value: stats.scheduled.toString(),
      icon: CheckCircle2,
      color: 'text-secondary',
      description: 'Total futuras',
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header with Action Button */}
        <PageHeader
          icon={CheckSquare}
          title="Atividades"
          subtitle="Gerencie suas atividades de vendas"
          actions={
            <Button onClick={() => setCreateModalOpen(true)} className="w-full md:w-auto gap-2">
              <Plus className="h-4 w-4" />
              Nova Atividade
            </Button>
          }
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'activities' | 'productivity')} className="w-full">
          <TabsList>
            <TabsTrigger value="activities" className="gap-2">
              <List className="h-4 w-4" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="productivity" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Produtividade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-6 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <FilterBar
          activeFilter={activeFilter}
          statusFilter={statusFilter}
          stats={stats}
          onFilterChange={(filter) => {
            setActiveFilter(filter);
          }}
          onStatusFilterChange={(status) => {
            setStatusFilter(status);
            setActiveFilter(undefined); // Reset date filter when changing status
          }}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atividades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Filtro por Vendedor - apenas para roles privilegiadas */}
            {canFilterBySeller && (
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-[180px]">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 por página</SelectItem>
                <SelectItem value="20">20 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : viewMode === 'list' ? (
          <>
            <div className="hidden md:block">
              <ActivityTable
                activities={activities}
                onComplete={handleCompleteActivity}
                onNoShow={handleNoShowActivity}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            </div>
            <div className="md:hidden space-y-3">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onComplete={handleCompleteActivity}
                  onNoShow={handleNoShowActivity}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>

            {/* Pagination with total indicator */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {Math.min((page - 1) * pageSize + 1, total)}-{Math.min(page * pageSize, total)} de {total} atividades
              </p>
              
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(Math.max(1, page - 1))}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {/* Dynamic page numbers around current page */}
                    {(() => {
                      const pages: number[] = [];
                      const maxVisible = 5;
                      let start = Math.max(1, page - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      
                      // Adjust start if we're near the end
                      if (end - start + 1 < maxVisible) {
                        start = Math.max(1, end - maxVisible + 1);
                      }
                      
                      for (let i = start; i <= end; i++) {
                        pages.push(i);
                      }
                      
                      return pages.map((pageNum) => (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      ));
                    })()}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        ) : (
          <ActivityCalendar
            activities={activities}
            onComplete={handleCompleteActivity}
            onNoShow={handleNoShowActivity}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        )}
          </TabsContent>

          <TabsContent value="productivity" className="mt-6">
            <ProductivityDashboard />
          </TabsContent>
        </Tabs>
      </div>

      <CreateActivityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreateActivity}
      />

      <EditActivityModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        activity={selectedActivity}
        onSubmit={handleUpdateActivity}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A atividade será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActivity} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
