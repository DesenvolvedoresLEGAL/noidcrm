
-- =====================================================
-- COMMUNITY TABLES FOR NOID RevenueOS
-- =====================================================

-- 1. COMMUNITY SUGGESTIONS (Feature Requests)
CREATE TABLE public.community_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Suggestion data
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  impact_area VARCHAR(50) NOT NULL CHECK (impact_area IN ('sales', 'ai', 'cs', 'ux', 'other')),
  perceived_impact VARCHAR(20) NOT NULL CHECK (perceived_impact IN ('low', 'medium', 'high', 'critical')),
  
  -- Status and voting
  status VARCHAR(30) NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'planned', 'in_development', 'launched', 'declined')),
  votes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  -- Metadata
  is_featured BOOLEAN DEFAULT false,
  admin_notes TEXT,
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SUGGESTION VOTES
CREATE TABLE public.community_suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- 3. SUGGESTION COMMENTS
CREATE TABLE public.community_suggestion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_team_response BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. COMMUNITY DISCUSSIONS
CREATE TABLE public.community_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Discussion data
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('question', 'best_practice', 'tip', 'discussion')),
  tags TEXT[] DEFAULT '{}',
  
  -- Metrics
  views_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_answered BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DISCUSSION REPLIES
CREATE TABLE public.community_discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.community_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_accepted_answer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. COMMUNITY CASES
CREATE TABLE public.community_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('win_story', 'learning', 'tip', 'process')),
  
  -- Metrics
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.community_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_cases ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - SUGGESTIONS
-- =====================================================

-- Anyone authenticated can read suggestions
CREATE POLICY "Authenticated users can read suggestions"
ON public.community_suggestions FOR SELECT
TO authenticated
USING (true);

-- Users can create their own suggestions
CREATE POLICY "Users can create suggestions"
ON public.community_suggestions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own suggestions
CREATE POLICY "Users can update own suggestions"
ON public.community_suggestions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - VOTES
-- =====================================================

CREATE POLICY "Authenticated users can read votes"
ON public.community_suggestion_votes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can vote"
ON public.community_suggestion_votes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own votes"
ON public.community_suggestion_votes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - COMMENTS
-- =====================================================

CREATE POLICY "Authenticated users can read comments"
ON public.community_suggestion_comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create comments"
ON public.community_suggestion_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.community_suggestion_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - DISCUSSIONS
-- =====================================================

CREATE POLICY "Authenticated users can read discussions"
ON public.community_discussions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create discussions"
ON public.community_discussions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discussions"
ON public.community_discussions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - REPLIES
-- =====================================================

CREATE POLICY "Authenticated users can read replies"
ON public.community_discussion_replies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create replies"
ON public.community_discussion_replies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
ON public.community_discussion_replies FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - CASES
-- =====================================================

-- Only approved cases are visible to all
CREATE POLICY "Authenticated users can read approved cases"
ON public.community_cases FOR SELECT
TO authenticated
USING (is_approved = true OR auth.uid() = user_id);

CREATE POLICY "Users can create cases"
ON public.community_cases FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cases"
ON public.community_cases FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR VOTE COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_suggestion_votes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_suggestions 
    SET votes_count = votes_count + 1, updated_at = now()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_suggestions 
    SET votes_count = GREATEST(votes_count - 1, 0), updated_at = now()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_suggestion_votes
AFTER INSERT OR DELETE ON public.community_suggestion_votes
FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_votes_count();

-- =====================================================
-- TRIGGERS FOR COMMENT COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_suggestion_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_suggestions 
    SET comments_count = comments_count + 1, updated_at = now()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_suggestions 
    SET comments_count = GREATEST(comments_count - 1, 0), updated_at = now()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_suggestion_comments
AFTER INSERT OR DELETE ON public.community_suggestion_comments
FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_comments_count();

-- =====================================================
-- TRIGGERS FOR REPLIES COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_discussion_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_discussions 
    SET replies_count = replies_count + 1, updated_at = now()
    WHERE id = NEW.discussion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_discussions 
    SET replies_count = GREATEST(replies_count - 1, 0), updated_at = now()
    WHERE id = OLD.discussion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_discussion_replies
AFTER INSERT OR DELETE ON public.community_discussion_replies
FOR EACH ROW EXECUTE FUNCTION public.update_discussion_replies_count();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_community_suggestions_status ON public.community_suggestions(status);
CREATE INDEX idx_community_suggestions_votes ON public.community_suggestions(votes_count DESC);
CREATE INDEX idx_community_suggestions_user ON public.community_suggestions(user_id);
CREATE INDEX idx_community_discussions_category ON public.community_discussions(category);
CREATE INDEX idx_community_discussions_pinned ON public.community_discussions(is_pinned DESC, created_at DESC);
CREATE INDEX idx_community_cases_approved ON public.community_cases(is_approved, is_featured);
CREATE INDEX idx_community_votes_user ON public.community_suggestion_votes(user_id);
CREATE INDEX idx_community_votes_suggestion ON public.community_suggestion_votes(suggestion_id);
