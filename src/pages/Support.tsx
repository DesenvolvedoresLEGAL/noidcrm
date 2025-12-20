import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MainLayout } from '@/components/MainLayout';
import {
  SupportHero,
  SupportOptionsGrid,
  CreateTicketDialog,
  TicketList,
  TicketDetail,
  SupportFAQ,
  SupportBestPractices,
  SupportSLA,
} from '@/components/support';
import { useHelpArticles } from '@/hooks/useHelpArticles';
import { useSupportTickets, RequestType, CreateTicketData } from '@/hooks/useSupportTickets';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ChevronRight } from 'lucide-react';

export default function Support() {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultTicketType, setDefaultTicketType] = useState<RequestType | undefined>();

  const { articles, searchArticles } = useHelpArticles();
  const { tickets, loading, creating, createTicket } = useSupportTickets();

  // Debounce search
  useState(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  });

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchArticles(debouncedQuery);
  }, [debouncedQuery, searchArticles]);

  const handleOpenTicketDialog = useCallback((type?: 'bug' | 'question') => {
    setDefaultTicketType(type);
    setDialogOpen(true);
  }, []);

  const handleCreateTicket = useCallback(async (data: CreateTicketData) => {
    const ticket = await createTicket(data);
    if (ticket) {
      setDialogOpen(false);
    }
  }, [createTicket]);

  const handleTicketClick = useCallback((id: string) => {
    navigate(`/app/support/tickets/${id}`);
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate('/app/support');
  }, [navigate]);

  const handleArticleClick = useCallback((slug: string) => {
    const article = articles.find((a) => a.slug === slug);
    if (article) {
      navigate(`/app/docs/${article.category}/${slug}`);
    }
  }, [articles, navigate]);

  // Ticket detail view
  if (ticketId) {
    return (
      <AppLayout>
        <Helmet>
          <title>Chamado | Suporte NOID</title>
        </Helmet>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <TicketDetail ticketId={ticketId} onBack={handleBack} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>Central de Suporte | NOID RevenueOS</title>
        <meta name="description" content="Central de suporte NOID. Encontre respostas, abra chamados e fale com nossa equipe." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero with Search */}
        <SupportHero searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        {/* Search Results */}
        {debouncedQuery.trim() && (
          <div className="container max-w-4xl mx-auto px-4 -mt-4 mb-8">
            <DocsSearchResults
              results={searchResults}
              onArticleClick={handleArticleClick}
            />
          </div>
        )}

        {/* Options Grid */}
        <SupportOptionsGrid onOpenTicketDialog={handleOpenTicketDialog} />

        {/* Main Content */}
        <section className="py-8">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Best Practices */}
              <div className="lg:col-span-1 space-y-6">
                <SupportBestPractices />
              </div>

              {/* Right Column - Tickets */}
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    📋 Meus Chamados
                  </h2>
                </div>
                <TicketList
                  tickets={tickets}
                  loading={loading}
                  onTicketClick={handleTicketClick}
                  showViewAll
                  maxItems={5}
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-8 bg-muted/30">
          <div className="container max-w-3xl mx-auto px-4">
            <SupportFAQ showViewAll />
          </div>
        </section>

        {/* SLA */}
        <section className="py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <SupportSLA />
          </div>
        </section>

        {/* Ticket Dialog */}
        <CreateTicketDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleCreateTicket}
          isSubmitting={creating}
          defaultType={defaultTicketType}
        />
      </div>
    </AppLayout>
  );
}
