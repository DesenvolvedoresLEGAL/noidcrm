import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BackupHistory {
  id: string;
  organization_id: string | null;
  backup_type: 'daily' | 'manual' | 'before_delete' | 'export';
  entities_count: Record<string, number>;
  size_bytes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message: string | null;
  file_url: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
}

interface UseBackupHistoryOptions {
  organizationId?: string;
  limit?: number;
}

export function useBackupHistory({ organizationId, limit = 50 }: UseBackupHistoryOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch backup history
  const { data: backups = [], isLoading, refetch } = useQuery({
    queryKey: ['backup-history', organizationId, limit],
    queryFn: async () => {
      let query = supabase
        .from('backup_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching backup history:', error);
        throw error;
      }

      return data as BackupHistory[];
    },
  });

  // Create manual backup
  const createBackupMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data, error } = await supabase.rpc('create_organization_backup', {
        p_organization_id: orgId,
        p_backup_type: 'manual',
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      toast.success('Backup criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar backup', {
        description: error.message,
      });
    },
  });

  // Export backup (download)
  const exportBackupMutation = useMutation({
    mutationFn: async ({ orgId, includeDeleted = false }: { orgId: string; includeDeleted?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('export-backup', {
        body: {
          organization_id: orgId,
          include_deleted: includeDeleted,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${data.organization_id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      toast.success('Backup exportado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao exportar backup', {
        description: error.message,
      });
    },
  });

  // Stats
  const stats = {
    total: backups.length,
    completed: backups.filter((b) => b.status === 'completed').length,
    failed: backups.filter((b) => b.status === 'failed').length,
    lastBackup: backups.find((b) => b.status === 'completed')?.created_at,
    totalEntities: backups.reduce((sum, b) => {
      if (b.status === 'completed' && b.entities_count) {
        return sum + Object.values(b.entities_count).reduce((a, c) => a + c, 0);
      }
      return sum;
    }, 0),
  };

  return {
    backups,
    stats,
    isLoading,
    refetch,
    createBackup: createBackupMutation.mutate,
    exportBackup: exportBackupMutation.mutate,
    isCreatingBackup: createBackupMutation.isPending,
    isExporting: exportBackupMutation.isPending,
  };
}
