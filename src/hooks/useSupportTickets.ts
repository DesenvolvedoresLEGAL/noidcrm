import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export type RequestType = 'bug' | 'question' | 'improvement' | 'billing' | 'other';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  requestType: RequestType;
  affectedModule: string | null;
  subject: string;
  description: string;
  urgency: Urgency;
  status: TicketStatus;
  slaDeadline: string | null;
  resolvedAt: string | null;
  attachmentUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  userId: string | null;
  isSupportTeam: boolean;
  message: string;
  attachmentUrls: string[];
  createdAt: string;
}

export interface CreateTicketData {
  requestType: RequestType;
  affectedModule?: string;
  subject: string;
  description: string;
  urgency: Urgency;
  attachmentUrls?: string[];
}

export function useSupportTickets() {
  const { user, organization } = useCurrentUser();
  const organizationId = organization?.id;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(
        (data || []).map((t) => ({
          id: t.id,
          ticketNumber: t.ticket_number,
          requestType: t.request_type as RequestType,
          affectedModule: t.affected_module,
          subject: t.subject,
          description: t.description,
          urgency: t.urgency as Urgency,
          status: t.status as TicketStatus,
          slaDeadline: t.sla_deadline,
          resolvedAt: t.resolved_at,
          attachmentUrls: t.attachment_urls || [],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        }))
      );
    } catch (error) {
      console.error('[useSupportTickets] Error fetching tickets:', error);
      toast.error('Erro ao carregar chamados');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = useCallback(
    async (data: CreateTicketData): Promise<SupportTicket | null> => {
      if (!user?.id || !organizationId) {
        toast.error('Usuário não autenticado');
        return null;
      }

      try {
        setCreating(true);
        const { data: newTicket, error } = await supabase
          .from('support_tickets')
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            request_type: data.requestType,
            affected_module: data.affectedModule || null,
            subject: data.subject,
            description: data.description,
            urgency: data.urgency,
            attachment_urls: data.attachmentUrls || [],
          } as any)
          .select()
          .single();

        if (error) throw error;

        const ticket: SupportTicket = {
          id: newTicket.id,
          ticketNumber: newTicket.ticket_number,
          requestType: newTicket.request_type as RequestType,
          affectedModule: newTicket.affected_module,
          subject: newTicket.subject,
          description: newTicket.description,
          urgency: newTicket.urgency as Urgency,
          status: newTicket.status as TicketStatus,
          slaDeadline: newTicket.sla_deadline,
          resolvedAt: newTicket.resolved_at,
          attachmentUrls: newTicket.attachment_urls || [],
          createdAt: newTicket.created_at,
          updatedAt: newTicket.updated_at,
        };

        setTickets((prev) => [ticket, ...prev]);
        toast.success('Chamado criado com sucesso!');
        return ticket;
      } catch (error) {
        console.error('[useSupportTickets] Error creating ticket:', error);
        toast.error('Erro ao criar chamado');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [user?.id, organizationId]
  );

  const getTicketById = useCallback(
    async (ticketId: string): Promise<{ ticket: SupportTicket; responses: TicketResponse[] } | null> => {
      try {
        const [ticketResult, responsesResult] = await Promise.all([
          supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
          supabase
            .from('support_ticket_responses')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true }),
        ]);

        if (ticketResult.error) throw ticketResult.error;

        const t = ticketResult.data;
        const ticket: SupportTicket = {
          id: t.id,
          ticketNumber: t.ticket_number,
          requestType: t.request_type as RequestType,
          affectedModule: t.affected_module,
          subject: t.subject,
          description: t.description,
          urgency: t.urgency as Urgency,
          status: t.status as TicketStatus,
          slaDeadline: t.sla_deadline,
          resolvedAt: t.resolved_at,
          attachmentUrls: t.attachment_urls || [],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        };

        const responses: TicketResponse[] = (responsesResult.data || []).map((r) => ({
          id: r.id,
          ticketId: r.ticket_id,
          userId: r.user_id,
          isSupportTeam: r.is_support_team || false,
          message: r.message,
          attachmentUrls: r.attachment_urls || [],
          createdAt: r.created_at,
        }));

        return { ticket, responses };
      } catch (error) {
        console.error('[useSupportTickets] Error fetching ticket:', error);
        toast.error('Erro ao carregar chamado');
        return null;
      }
    },
    []
  );

  const addResponse = useCallback(
    async (ticketId: string, message: string): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { error } = await supabase.from('support_ticket_responses').insert({
          ticket_id: ticketId,
          user_id: user.id,
          is_support_team: false,
          message,
        });

        if (error) throw error;

        toast.success('Resposta enviada');
        return true;
      } catch (error) {
        console.error('[useSupportTickets] Error adding response:', error);
        toast.error('Erro ao enviar resposta');
        return false;
      }
    },
    [user?.id]
  );

  const closeTicket = useCallback(
    async (ticketId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('support_tickets')
          .update({ status: 'closed', resolved_at: new Date().toISOString() })
          .eq('id', ticketId);

        if (error) throw error;

        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, status: 'closed' as TicketStatus, resolvedAt: new Date().toISOString() } : t
          )
        );
        toast.success('Chamado fechado');
        return true;
      } catch (error) {
        console.error('[useSupportTickets] Error closing ticket:', error);
        toast.error('Erro ao fechar chamado');
        return false;
      }
    },
    []
  );

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_response');
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');

  return {
    tickets,
    openTickets,
    resolvedTickets,
    loading,
    creating,
    fetchTickets,
    createTicket,
    getTicketById,
    addResponse,
    closeTicket,
  };
}
