import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/Layout';
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

function SearchResultsCard({ 
  results, 
  onArticleClick 
}: { 
  results: Array<{ slug: string; title: string; category: string }>; 
  onArticleClick: (slug: string) => void;
}) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Nenhum artigo encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          {results.length} artigo(s) encontrado(s)
        </p>
        <div className="space-y-2">
          {results.slice(0, 5).map((article) => (
            <button
              key={article.slug}
              onClick={() => onArticleClick(article.slug)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{article.title}</p>
                  <p className="text-xs text-muted-foreground">{article.category}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      <Layout pageTitle="Chamado">
        <Helmet>
          <title>Chamado | Suporte NOID</title>
        </Helmet>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <TicketDetail ticketId={ticketId} onBack={handleBack} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="Suporte">
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
            <SearchResultsCard
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
    </Layout>
  );
}
