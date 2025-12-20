import { Clock, Lightbulb, MessageCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DocsArticle } from '@/hooks/useDocsArticles';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocsArticleFeedback } from './DocsArticleFeedback';
import { DocsArticleList } from './DocsArticleList';
import { motion } from 'framer-motion';

interface DocsArticleViewProps {
  article: DocsArticle;
  relatedArticles: DocsArticle[];
  onBack: () => void;
  onArticleClick: (slug: string) => void;
  onSubmitFeedback: (articleId: string, isHelpful: boolean) => Promise<{ success: boolean }>;
  getUserFeedback: (articleId: string) => Promise<boolean | null>;
}

export function DocsArticleView({
  article,
  relatedArticles,
  onBack,
  onArticleClick,
  onSubmitFeedback,
  getUserFeedback,
}: DocsArticleViewProps) {
  // Parse content for tips (lines starting with 💡 or [TIP])
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

      <DocsBreadcrumb
        items={[
          { label: article.category, href: `/app/docs/${article.category}` },
          { label: article.title },
        ]}
      />

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

        <DocsArticleFeedback
          articleId={article.id}
          onSubmitFeedback={onSubmitFeedback}
          getUserFeedback={getUserFeedback}
        />
      </article>

      {relatedArticles.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border">
          <DocsArticleList
            articles={relatedArticles}
            onArticleClick={onArticleClick}
            title="Artigos relacionados"
          />
        </div>
      )}

      <Card className="mt-8 bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Precisa de ajuda?</h3>
              <p className="text-sm text-muted-foreground">
                Não encontrou o que procurava? Nossa equipe está pronta para ajudar.
              </p>
            </div>
            <Button variant="outline">Falar com Suporte</Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
