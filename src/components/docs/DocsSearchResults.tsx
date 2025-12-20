import { Search } from 'lucide-react';
import { DocsArticle } from '@/hooks/useDocsArticles';
import { DocsArticleList } from './DocsArticleList';

interface DocsSearchResultsProps {
  query: string;
  results: DocsArticle[];
  onArticleClick: (slug: string) => void;
}

export function DocsSearchResults({ query, results, onArticleClick }: DocsSearchResultsProps) {
  return (
    <section className="py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'} para "{query}"
          </h2>
        </div>

        <DocsArticleList articles={results} onArticleClick={onArticleClick} />
      </div>
    </section>
  );
}
