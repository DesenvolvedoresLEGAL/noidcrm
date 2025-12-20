import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  videoUrl: string | null;
  orderIndex: number;
}

export function useHelpArticles() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const { data, error } = await supabase
          .from('help_articles')
          .select('*')
          .eq('is_active', true)
          .order('order_index', { ascending: true });

        if (error) throw error;

        setArticles(
          data.map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            content: a.content,
            category: a.category,
            videoUrl: a.video_url,
            orderIndex: a.order_index || 0,
          }))
        );
      } catch (error) {
        console.error('[useHelpArticles] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const searchArticles = useCallback((query: string) => {
    if (!query.trim()) return articles;

    const lowerQuery = query.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.content.toLowerCase().includes(lowerQuery) ||
        a.category.toLowerCase().includes(lowerQuery)
    );
  }, [articles]);

  const getByCategory = useCallback((category: string) => {
    return articles.filter((a) => a.category === category);
  }, [articles]);

  const categories = [...new Set(articles.map((a) => a.category))];

  return { articles, loading, searchArticles, getByCategory, categories };
}
