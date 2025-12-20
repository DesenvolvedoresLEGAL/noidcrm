import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocsArticleFeedbackProps {
  articleId: string;
  onSubmitFeedback: (articleId: string, isHelpful: boolean) => Promise<{ success: boolean }>;
  getUserFeedback: (articleId: string) => Promise<boolean | null>;
}

export function DocsArticleFeedback({
  articleId,
  onSubmitFeedback,
  getUserFeedback,
}: DocsArticleFeedbackProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFeedback = async () => {
      const existingFeedback = await getUserFeedback(articleId);
      if (existingFeedback !== null) {
        setFeedback(existingFeedback);
        setSubmitted(true);
      }
    };
    loadFeedback();
  }, [articleId, getUserFeedback]);

  const handleFeedback = async (isHelpful: boolean) => {
    if (loading) return;
    
    setLoading(true);
    const result = await onSubmitFeedback(articleId, isHelpful);
    
    if (result.success) {
      setFeedback(isHelpful);
      setSubmitted(true);
    }
    setLoading(false);
  };

  return (
    <div className="border-t border-border pt-6 mt-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-muted-foreground">
          Este artigo foi útil?
        </p>
        
        <div className="flex items-center gap-2">
          {submitted ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              <span>Obrigado pelo feedback!</span>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(true)}
                disabled={loading}
                className={cn(
                  'gap-2',
                  feedback === true && 'bg-green-500/10 border-green-500/30 text-green-600'
                )}
              >
                <ThumbsUp className="h-4 w-4" />
                Sim
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(false)}
                disabled={loading}
                className={cn(
                  'gap-2',
                  feedback === false && 'bg-red-500/10 border-red-500/30 text-red-600'
                )}
              >
                <ThumbsDown className="h-4 w-4" />
                Não
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
