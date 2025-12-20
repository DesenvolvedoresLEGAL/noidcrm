import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useDocsArticles } from '@/hooks/useDocsArticles';
import {
  DocsHero,
  DocsCategoryGrid,
  DocsSearchResults,
  DocsPopularArticles,
  DocsArticleList,
  DocsBreadcrumb,
} from '@/components/docs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, LogIn, Clock, Lightbulb, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

// Public article view without feedback (requires login)
function PublicArticleView({
  article,
  relatedArticles,
  onBack,
  onArticleClick,
}: {
  article: any;
  relatedArticles: any[];
  onBack: () => void;
  onArticleClick: (slug: string) => void;
}) {
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentParagraph: string[] = [];
    let tipContent: string[] = [];
    let inTip = false;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        elements.push(
          <p key={`p-${elements.length}`} className="text-muted-foreground leading-relaxed mb-4">
            {currentParagraph.join(' ')}
          </p>
        );
        currentParagraph = [];
      }
    };

    const flushTip = () => {
      if (tipContent.length > 0) {
        elements.push(
          <Card key={`tip-${elements.length}`} className="bg-accent/10 border-accent/30 mb-4">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Dica</p>
                  <p className="text-sm text-muted-foreground">{tipContent.join(' ')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        tipContent = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('💡') || trimmedLine.startsWith('[TIP]')) {
        flushParagraph();
        inTip = true;
        tipContent.push(trimmedLine.replace('💡', '').replace('[TIP]', '').trim());
      } else if (trimmedLine.startsWith('##')) {
        flushParagraph();
        flushTip();
        inTip = false;
        elements.push(
          <h3 key={`h3-${idx}`} className="text-lg font-semibold text-foreground mt-6 mb-3">
            {trimmedLine.replace(/^#+\s*/, '')}
          </h3>
        );
      } else if (trimmedLine.startsWith('#')) {
        flushParagraph();
        flushTip();
        inTip = false;
        elements.push(
          <h2 key={`h2-${idx}`} className="text-xl font-bold text-foreground mt-8 mb-4">
            {trimmedLine.replace(/^#+\s*/, '')}
          </h2>
        );
      } else if (trimmedLine.match(/^\d+\.\s/)) {
        flushParagraph();
        flushTip();
        inTip = false;
        elements.push(
          <div key={`step-${idx}`} className="flex items-start gap-3 mb-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
              {trimmedLine.match(/^(\d+)/)?.[1]}
            </span>
            <p className="text-muted-foreground">{trimmedLine.replace(/^\d+\.\s*/, '')}</p>
          </div>
        );
      } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        flushParagraph();
        flushTip();
        inTip = false;
        elements.push(
          <div key={`bullet-${idx}`} className="flex items-start gap-2 mb-2 ml-4">
            <span className="text-primary mt-1.5">•</span>
            <p className="text-muted-foreground">{trimmedLine.replace(/^[-•]\s*/, '')}</p>
          </div>
        );
      } else if (trimmedLine === '') {
        if (inTip) {
          flushTip();
          inTip = false;
        } else {
          flushParagraph();
        }
      } else {
        if (inTip) {
          tipContent.push(trimmedLine);
        } else {
          currentParagraph.push(trimmedLine);
        }
      }
    });

    flushParagraph();
    flushTip();

    return elements;
  };

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
        <Link to="/docs" className="hover:text-primary transition-colors">
          Documentação
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        <Link to={`/docs/${article.category}`} className="hover:text-primary transition-colors">
          {categoryLabels[article.category] || article.category}
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        <span className="text-foreground font-medium">{article.title}</span>
      </nav>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">{article.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {article.readingTimeMinutes} min de leitura
            </span>
          </div>
        </header>

        <div className="space-y-2">{renderContent(article.content)}</div>
      </article>

      {relatedArticles.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border">
          <h3 className="text-xl font-semibold mb-4">Artigos relacionados</h3>
          <div className="space-y-3">
            {relatedArticles.map((art) => (
              <Card
                key={art.id}
                className="group cursor-pointer transition-all duration-200 hover:border-primary/30"
                onClick={() => onArticleClick(art.slug)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {art.title}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="mt-8 bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <LogIn className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-semibold text-foreground mb-1">
                Pronto para começar?
              </h3>
              <p className="text-sm text-muted-foreground">
                Crie sua conta gratuita e experimente o NOID RevenueOS.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/signup">Criar conta grátis</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Fazer login</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Public CTA component
function PublicDocsCTA() {
  return (
    <section className="py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6">
              <MessageCircle className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-3">
              Experimente o NOID RevenueOS
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Transforme sua operação de vendas com inteligência artificial e automação.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" asChild>
                <Link to="/signup">Começar gratuitamente</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// Public header
function PublicDocsHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-6xl mx-auto px-4 flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gradient-primary">NOID</span>
          <span className="text-sm text-muted-foreground">RevenueOS</span>
        </Link>

        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function DocsPublic() {
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
    categories,
  } = useDocsArticles();

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
      navigate(`/docs/${categoryId}`);
    },
    [navigate]
  );

  const handleArticleClick = useCallback(
    (articleSlug: string) => {
      const article = getBySlug(articleSlug);
      if (article) {
        navigate(`/docs/${article.category}/${articleSlug}`);
      }
    },
    [navigate, getBySlug]
  );

  const handleBack = useCallback(() => {
    if (slug && category) {
      navigate(`/docs/${category}`);
    } else {
      navigate('/docs');
    }
  }, [navigate, slug, category]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicDocsHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Carregando documentação...</p>
          </div>
        </div>
      </div>
    );
  }

  // Article view
  if (currentArticle) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>{currentArticle.title} | Documentação NOID</title>
          <meta name="description" content={currentArticle.content.substring(0, 160)} />
        </Helmet>
        <PublicDocsHeader />
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <PublicArticleView
            article={currentArticle}
            relatedArticles={relatedArticles}
            onBack={handleBack}
            onArticleClick={handleArticleClick}
          />
        </div>
      </div>
    );
  }

  // Category view
  if (category) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>{categoryLabels[category] || category} | Documentação NOID</title>
          <meta
            name="description"
            content={`Artigos sobre ${categoryLabels[category] || category} no NOID RevenueOS`}
          />
        </Helmet>
        <PublicDocsHeader />
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/docs')}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to="/docs" className="hover:text-primary transition-colors">
              Documentação
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-foreground font-medium">
              {categoryLabels[category] || category}
            </span>
          </nav>

          <h1 className="text-3xl font-bold text-foreground mb-8">
            {categoryLabels[category] || category}
          </h1>

          <DocsArticleList articles={categoryArticles} onArticleClick={handleArticleClick} />

          <PublicDocsCTA />
        </div>
      </div>
    );
  }

  // Main docs page
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Documentação Oficial | NOID RevenueOS</title>
        <meta
          name="description"
          content="Aprenda, configure e escale seu sistema de receita inteligente com a documentação oficial do NOID RevenueOS"
        />
      </Helmet>

      <PublicDocsHeader />

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

      <PublicDocsCTA />

      <footer className="border-t border-border py-8 mt-12">
        <div className="container max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} NOID RevenueOS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
