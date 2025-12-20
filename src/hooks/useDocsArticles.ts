import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface DocsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  parentCategory: string | null;
  videoUrl: string | null;
  orderIndex: number;
  readingTimeMinutes: number;
  helpfulYes: number;
  helpfulNo: number;
  relatedSlugs: string[];
  iconName: string | null;
}

export interface DocsCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  articleCount: number;
  parentCategory: string | null;
}

const CATEGORY_META: Record<string, { description: string; icon: string }> = {
  'getting-started': {
    description: 'Primeiros passos com o NOID RevenueOS',
    icon: 'Rocket',
  },
  'configuration': {
    description: 'Configure seu sistema de vendas',
    icon: 'Settings',
  },
  'sales-revenue': {
    description: 'Pipeline, Forecast, Scoring e Propostas',
    icon: 'TrendingUp',
  },
  'artificial-intelligence': {
    description: 'Knowledge Graph, Memórias e Insights',
    icon: 'Brain',
  },
  'operations': {
    description: 'Atividades, Relatórios e Alertas',
    icon: 'ClipboardList',
  },
  'security': {
    description: 'Permissões, Auditoria e LGPD',
    icon: 'Shield',
  },
  'integrations': {
    description: 'Conecte com outras ferramentas',
    icon: 'Plug',
  },
  'faq': {
    description: 'Perguntas frequentes',
    icon: 'HelpCircle',
  },
};

export function useDocsArticles() {
  const [articles, setArticles] = useState<DocsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, organization } = useCurrentUser();

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
          (data || []).map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            content: a.content,
            category: a.category,
            parentCategory: a.parent_category,
            videoUrl: a.video_url,
            orderIndex: a.order_index || 0,
            readingTimeMinutes: a.reading_time_minutes || 2,
            helpfulYes: a.helpful_yes || 0,
            helpfulNo: a.helpful_no || 0,
            relatedSlugs: a.related_slugs || [],
            iconName: a.icon_name,
          }))
        );
      } catch (error) {
        console.error('[useDocsArticles] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const searchArticles = useCallback(
    (query: string) => {
      if (!query.trim()) return articles;

      const lowerQuery = query.toLowerCase();
      return articles.filter(
        (a) =>
          a.title.toLowerCase().includes(lowerQuery) ||
          a.content.toLowerCase().includes(lowerQuery) ||
          a.category.toLowerCase().includes(lowerQuery)
      );
    },
    [articles]
  );

  const getByCategory = useCallback(
    (category: string) => {
      return articles.filter((a) => a.category === category);
    },
    [articles]
  );

  const getBySlug = useCallback(
    (slug: string) => {
      return articles.find((a) => a.slug === slug);
    },
    [articles]
  );

  const getRelatedArticles = useCallback(
    (article: DocsArticle) => {
      if (!article.relatedSlugs || article.relatedSlugs.length === 0) {
        // Return articles from same category
        return articles
          .filter((a) => a.category === article.category && a.id !== article.id)
          .slice(0, 3);
      }
      return articles.filter((a) => article.relatedSlugs.includes(a.slug));
    },
    [articles]
  );

  const submitFeedback = useCallback(
    async (articleId: string, isHelpful: boolean) => {
      if (!user?.id || !organization?.id) return { success: false };

      try {
        // Check if user already submitted feedback
        const { data: existing } = await supabase
          .from('article_feedback')
          .select('id, is_helpful')
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          // Update existing feedback
          await supabase
            .from('article_feedback')
            .update({ is_helpful: isHelpful })
            .eq('id', existing.id);

          // Update counters
          if (existing.is_helpful !== isHelpful) {
            const updates: Record<string, number> = {};
            if (isHelpful) {
              updates.helpful_yes = 1;
              updates.helpful_no = -1;
            } else {
              updates.helpful_yes = -1;
              updates.helpful_no = 1;
            }

            // Use RPC or direct update
            const article = articles.find((a) => a.id === articleId);
            if (article) {
              await supabase
                .from('help_articles')
                .update({
                  helpful_yes: article.helpfulYes + (isHelpful ? 1 : -1),
                  helpful_no: article.helpfulNo + (isHelpful ? -1 : 1),
                })
                .eq('id', articleId);
            }
          }
        } else {
          // Insert new feedback
          await supabase.from('article_feedback').insert({
            article_id: articleId,
            user_id: user.id,
            is_helpful: isHelpful,
            organization_id: organization.id,
          });

          // Update article counter
          const article = articles.find((a) => a.id === articleId);
          if (article) {
            await supabase
              .from('help_articles')
              .update({
                helpful_yes: article.helpfulYes + (isHelpful ? 1 : 0),
                helpful_no: article.helpfulNo + (isHelpful ? 0 : 1),
              })
              .eq('id', articleId);
          }
        }

        return { success: true };
      } catch (error) {
        console.error('[useDocsArticles] Feedback error:', error);
        return { success: false };
      }
    },
    [user?.id, organization?.id, articles]
  );

  const getUserFeedback = useCallback(
    async (articleId: string) => {
      if (!user?.id) return null;

      try {
        const { data } = await supabase
          .from('article_feedback')
          .select('is_helpful')
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .single();

        return data?.is_helpful ?? null;
      } catch {
        return null;
      }
    },
    [user?.id]
  );

  // Get unique categories with metadata
  const categories: DocsCategory[] = [...new Set(articles.map((a) => a.category))].map(
    (cat) => ({
      id: cat,
      name: cat,
      description: CATEGORY_META[cat]?.description || '',
      icon: CATEGORY_META[cat]?.icon || 'FileText',
      articleCount: articles.filter((a) => a.category === cat).length,
      parentCategory: null,
    })
  );

  return {
    articles,
    loading,
    searchArticles,
    getByCategory,
    getBySlug,
    getRelatedArticles,
    submitFeedback,
    getUserFeedback,
    categories,
  };
}
