import { supabase } from '@/integrations/supabase/client';

export interface Video {
  id: string;
  title: string;
  url: string;
  duration_sec: number;
  level: 'Básico' | 'Intermediário' | 'Avançado';
  source?: 'YouTube' | 'Vimeo' | 'Internal';
  tags?: string[];
  language?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export async function listVideos(organizationId: string): Promise<Video[]> {
  const { data, error } = await supabase
    .from('video_library')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any as Video[];
}

export async function getVideo(id: string): Promise<Video> {
  const { data, error } = await supabase
    .from('video_library')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as any as Video;
}

export async function createVideo(video: Omit<Video, 'id' | 'created_at' | 'updated_at'>): Promise<Video> {
  const { data, error } = await supabase
    .from('video_library')
    .insert(video as any)
    .select()
    .single();

  if (error) throw error;
  return data as any as Video;
}

export async function updateVideo(id: string, video: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase
    .from('video_library')
    .update(video as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as any as Video;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase
    .from('video_library')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
