import { motion } from 'framer-motion';
import { TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DocsArticle } from '@/hooks/useDocsArticles';

interface DocsPopularArticlesProps {
  articles: DocsArticle[];
  onArticleClick: (slug: string) => void;
}

export function DocsPopularArticles({ articles, onArticleClick }: DocsPopularArticlesProps) {
  // Get top 6 articles with most helpful votes
  const popularArticles = [...articles]
    .sort((a, b) => b.helpfulYes - a.helpfulYes)
    .slice(0, 6);

  if (popularArticles.length === 0) return null;

  return (
    <section className="py-12 bg-muted/30">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Artigos populares</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularArticles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Card
                className="group cursor-pointer h-full transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                onClick={() => onArticleClick(article.slug)}
              >
                <CardContent className="p-5">
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {article.readingTimeMinutes} min
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
