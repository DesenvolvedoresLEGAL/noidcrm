import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface PendingMemoriesButtonProps {
  onComplete?: () => void;
}

export function PendingMemoriesButton({ onComplete }: PendingMemoriesButtonProps) {
  const [processing, setProcessing] = useState(false);

  // Fetch count of pending win_loss_records
  const { data: pendingCount, refetch: refetchCount } = useQuery({
    queryKey: ['pending-memory-extractions'],
    queryFn: async () => {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) return 0;

      const { count, error } = await supabase
        .from('win_loss_records')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('memories_extracted', false);

      if (error) {
        console.error('Error fetching pending count:', error);
        return 0;
      }

      return count || 0;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const handleExtractPending = async () => {
    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) {
        toast.error('Organização não encontrada');
        return;
      }

      // Fetch pending records
      const { data: pendingRecords, error } = await supabase
        .from('win_loss_records')
        .select('id')
        .eq('organization_id', orgId)
        .eq('memories_extracted', false)
        .limit(10); // Process max 10 at a time

      if (error) {
        throw error;
      }

      if (!pendingRecords || pendingRecords.length === 0) {
        toast.info('Não há registros pendentes para processar');
        return;
      }

      toast.info(`Processando ${pendingRecords.length} registros...`);

      // Process each record
      for (const record of pendingRecords) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke('extract-memory-engine', {
            body: {
              source_type: 'win_loss',
              source_id: record.id,
              organization_id: orgId
            }
          });

          if (fnError) {
            console.error('Extraction error for record:', record.id, fnError);
            errorCount++;
          } else {
            console.log('Extraction result:', data);
            successCount++;
          }
        } catch (err) {
          console.error('Failed to process record:', record.id, err);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`${successCount} registro(s) processado(s) com sucesso`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} registro(s) falharam`);
      }

      // Refresh data
      refetchCount();
      onComplete?.();

    } catch (err) {
      console.error('Error processing pending records:', err);
      toast.error('Erro ao processar registros pendentes');
    } finally {
      setProcessing(false);
    }
  };

  if (!pendingCount || pendingCount === 0) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExtractPending}
      disabled={processing}
      className="relative"
    >
      {processing ? (
        <>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          Extraindo...
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-1 text-yellow-500" />
          Extrair Pendentes
          <Badge 
            variant="secondary" 
            className="ml-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
          >
            {pendingCount}
          </Badge>
        </>
      )}
    </Button>
  );
}
