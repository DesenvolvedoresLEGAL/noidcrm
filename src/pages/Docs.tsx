import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/Layout';
import { useDocsArticles } from '@/hooks/useDocsArticles';
import {
  DocsHero,
  DocsCategoryGrid,
  DocsSearchResults,
  DocsPopularArticles,
  DocsSupportCTA,
  DocsArticleList,
  DocsArticleView,
  DocsBreadcrumb,
} from '@/components/docs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Docs() {
  const { category, slug } = useParams<{ category?: string; slug?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const {
    articles,
    loading,
    searchArticles,
    getByCategory,
    getBySlug,
    getRelatedArticles,
    submitFeedback,
    getUserFeedback,
    categories,
  } = useDocsArticles();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchArticles(debouncedQuery);
  }, [debouncedQuery, searchArticles]);

  const categoryArticles = useMemo(() => {
    if (!category) return [];
    return getByCategory(category);
  }, [category, getByCategory]);

  const currentArticle = useMemo(() => {
    if (!slug) return null;
    return getBySlug(slug);
  }, [slug, getBySlug]);

  const relatedArticles = useMemo(() => {
    if (!currentArticle) return [];
    return getRelatedArticles(currentArticle);
  }, [currentArticle, getRelatedArticles]);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      setSearchQuery('');
      navigate(`/app/docs/${categoryId}`);
    },
    [navigate]
  );

  const handleArticleClick = useCallback(
    (articleSlug: string) => {
      const article = getBySlug(articleSlug);
      if (article) {
        navigate(`/app/docs/${article.category}/${articleSlug}`);
      }
    },
    [navigate, getBySlug]
  );

  const handleBack = useCallback(() => {
    if (slug && category) {
      navigate(`/app/docs/${category}`);
    } else {
      navigate('/app/docs');
    }
  }, [navigate, slug, category]);

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Carregando documentação...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Article view
  if (currentArticle) {
    return (
      <Layout>
        <Helmet>
          <title>{currentArticle.title} | Documentação NOID</title>
          <meta name="description" content={currentArticle.content.substring(0, 160)} />
        </Helmet>
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <DocsArticleView
            article={currentArticle}
            relatedArticles={relatedArticles}
            onBack={handleBack}
            onArticleClick={handleArticleClick}
            onSubmitFeedback={submitFeedback}
            getUserFeedback={getUserFeedback}
          />
        </div>
      </Layout>
    );
  }

  // Category view
  if (category) {
    const categoryLabels: Record<string, string> = {
      'getting-started': 'Começando com o NOID',
      'configuration': 'Configuração Inicial',
      'sales-revenue': 'Vendas e Revenue',
      'artificial-intelligence': 'Inteligência Artificial',
      'operations': 'Operações e CS',
      'security': 'Segurança e LGPD',
      'integrations': 'Integrações',
      'faq': 'FAQ',
    };

    return (
      <Layout>
        <Helmet>
          <title>{categoryLabels[category] || category} | Documentação NOID</title>
          <meta
            name="description"
            content={`Artigos sobre ${categoryLabels[category] || category} no NOID RevenueOS`}
          />
        </Helmet>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/docs')}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <DocsBreadcrumb items={[{ label: category }]} />

          <h1 className="text-3xl font-bold text-foreground mb-8">
            {categoryLabels[category] || category}
          </h1>

          <DocsArticleList articles={categoryArticles} onArticleClick={handleArticleClick} />

          <div className="mt-12">
            <DocsSupportCTA />
          </div>
        </div>
      </Layout>
    );
  }

  // Main docs page
  return (
    <Layout>
      <Helmet>
        <title>Documentação Oficial | NOID RevenueOS</title>
        <meta
          name="description"
          content="Aprenda, configure e escale seu sistema de receita inteligente com a documentação oficial do NOID RevenueOS"
        />
      </Helmet>

      <DocsHero searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {debouncedQuery.trim() ? (
        <DocsSearchResults
          query={debouncedQuery}
          results={searchResults}
          onArticleClick={handleArticleClick}
        />
      ) : (
        <>
          <DocsCategoryGrid categories={categories} onCategoryClick={handleCategoryClick} />
          <DocsPopularArticles articles={articles} onArticleClick={handleArticleClick} />
        </>
      )}

      <DocsSupportCTA />
    </Layout>
  );
}
