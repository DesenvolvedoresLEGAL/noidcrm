-- Add 'decision_maker' to the graph_edges edge_type enum
ALTER TYPE public.graph_edge_type ADD VALUE IF NOT EXISTS 'decision_maker';