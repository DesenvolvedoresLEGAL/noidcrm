-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 11_tables_community.sql
-- Generated: 2026-01-07
-- Description: Community, Help, Release Notes, Videos tables
-- Tables: 12 tables
-- ============================================================

-- ============================================================
-- TABLE: community_cases
-- ============================================================
DROP TABLE IF EXISTS public.community_cases CASCADE;
CREATE TABLE public.community_cases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    assigned_to UUID,
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: community_discussions
-- ============================================================
DROP TABLE IF EXISTS public.community_discussions CASCADE;
CREATE TABLE public.community_discussions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    tags JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    last_reply_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: community_discussion_replies
-- ============================================================
DROP TABLE IF EXISTS public.community_discussion_replies CASCADE;
CREATE TABLE public.community_discussion_replies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    discussion_id UUID NOT NULL REFERENCES public.community_discussions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES public.community_discussion_replies(id),
    is_solution BOOLEAN DEFAULT false,
    upvote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: community_suggestions
-- ============================================================
DROP TABLE IF EXISTS public.community_suggestions CASCADE;
CREATE TABLE public.community_suggestions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'submitted',
    priority TEXT,
    vote_count INTEGER DEFAULT 0,
    is_implemented BOOLEAN DEFAULT false,
    implemented_at TIMESTAMPTZ,
    implemented_in_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: community_suggestion_votes
-- ============================================================
DROP TABLE IF EXISTS public.community_suggestion_votes CASCADE;
CREATE TABLE public.community_suggestion_votes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion_id UUID NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote_type TEXT DEFAULT 'up',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(suggestion_id, user_id)
);

-- ============================================================
-- TABLE: community_suggestion_comments
-- ============================================================
DROP TABLE IF EXISTS public.community_suggestion_comments CASCADE;
CREATE TABLE public.community_suggestion_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion_id UUID NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_official BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: help_articles
-- ============================================================
DROP TABLE IF EXISTS public.help_articles CASCADE;
CREATE TABLE public.help_articles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT,
    content_html TEXT,
    category TEXT,
    subcategory TEXT,
    tags JSONB DEFAULT '[]',
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    author_id UUID,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: article_feedback
-- ============================================================
DROP TABLE IF EXISTS public.article_feedback CASCADE;
CREATE TABLE public.article_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: release_notes
-- ============================================================
DROP TABLE IF EXISTS public.release_notes CASCADE;
CREATE TABLE public.release_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    content_html TEXT,
    release_type TEXT DEFAULT 'minor',
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    features JSONB DEFAULT '[]',
    fixes JSONB DEFAULT '[]',
    breaking_changes JSONB DEFAULT '[]',
    author_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: pending_release_changes
-- ============================================================
DROP TABLE IF EXISTS public.pending_release_changes CASCADE;
CREATE TABLE public.pending_release_changes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    change_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority INTEGER DEFAULT 0,
    is_breaking BOOLEAN DEFAULT false,
    is_included BOOLEAN DEFAULT false,
    included_in_release_id UUID REFERENCES public.release_notes(id),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: video_library
-- ============================================================
DROP TABLE IF EXISTS public.video_library CASCADE;
CREATE TABLE public.video_library (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    category TEXT,
    subcategory TEXT,
    tags JSONB DEFAULT '[]',
    level TEXT DEFAULT 'beginner',
    source TEXT DEFAULT 'internal',
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    author_id UUID,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: video_recommendations
-- ============================================================
DROP TABLE IF EXISTS public.video_recommendations CASCADE;
CREATE TABLE public.video_recommendations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    video_id UUID NOT NULL REFERENCES public.video_library(id),
    recommendation_type TEXT,
    reason TEXT,
    score NUMERIC,
    is_watched BOOLEAN DEFAULT false,
    watched_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
