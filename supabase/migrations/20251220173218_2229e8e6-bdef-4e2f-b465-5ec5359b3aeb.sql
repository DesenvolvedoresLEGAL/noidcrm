-- Add new columns to help_articles for documentation features
ALTER TABLE public.help_articles 
ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS helpful_yes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS helpful_no INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS related_slugs TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS parent_category VARCHAR(50);

-- Create article_feedback table to track user votes (prevent duplicates)
CREATE TABLE public.article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID NOT NULL,
  UNIQUE(article_id, user_id)
);

-- Enable RLS
ALTER TABLE public.article_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for article_feedback
CREATE POLICY "Users can view their own feedback"
ON public.article_feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
ON public.article_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.article_feedback
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_article_feedback_article_id ON public.article_feedback(article_id);
CREATE INDEX idx_article_feedback_user_id ON public.article_feedback(user_id);
CREATE INDEX idx_help_articles_category ON public.help_articles(category);
CREATE INDEX idx_help_articles_parent_category ON public.help_articles(parent_category);