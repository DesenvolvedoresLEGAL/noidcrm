import { supabase } from '@/integrations/supabase/client';

export interface ProposalLayout {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  pages?: ProposalLayoutPage[];
}

export interface ProposalLayoutPage {
  id: string;
  layout_id: string;
  page_number: number;
  file_url: string;
  file_name: string;
  page_type: 'cover' | 'content' | 'terms' | 'custom';
  created_at: string;
}

export async function listLayouts(): Promise<ProposalLayout[]> {
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('proposal_layouts')
    .select(`
      *,
      pages:proposal_layout_pages(*)
    `)
    .eq('organization_id', orgId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  
  // Sort pages by page_number
  return (data || []).map(layout => ({
    ...layout,
    pages: (layout.pages || []).sort((a: any, b: any) => a.page_number - b.page_number)
  })) as ProposalLayout[];
}

export async function getLayout(layoutId: string): Promise<ProposalLayout | null> {
  const { data, error } = await supabase
    .from('proposal_layouts')
    .select(`
      *,
      pages:proposal_layout_pages(*)
    `)
    .eq('id', layoutId)
    .maybeSingle();

  if (error) throw error;
  
  if (data && data.pages) {
    data.pages = data.pages.sort((a: any, b: any) => a.page_number - b.page_number);
  }
  
  return data as ProposalLayout | null;
}

export async function createLayout(layout: {
  name: string;
  description?: string;
  is_default?: boolean;
}): Promise<ProposalLayout> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // If setting as default, unset other defaults first
  if (layout.is_default) {
    await supabase
      .from('proposal_layouts')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('proposal_layouts')
    .insert({
      ...layout,
      organization_id: orgId,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProposalLayout;
}

export async function updateLayout(
  layoutId: string,
  updates: Partial<Pick<ProposalLayout, 'name' | 'description' | 'is_default'>>
): Promise<ProposalLayout> {
  // If setting as default, unset other defaults first
  if (updates.is_default) {
    const { data: layout } = await supabase
      .from('proposal_layouts')
      .select('organization_id')
      .eq('id', layoutId)
      .single();

    if (layout) {
      await supabase
        .from('proposal_layouts')
        .update({ is_default: false })
        .eq('organization_id', layout.organization_id)
        .eq('is_default', true)
        .neq('id', layoutId);
    }
  }

  const { data, error } = await supabase
    .from('proposal_layouts')
    .update(updates)
    .eq('id', layoutId)
    .select()
    .single();

  if (error) throw error;
  return data as ProposalLayout;
}

export async function deleteLayout(layoutId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_layouts')
    .delete()
    .eq('id', layoutId);

  if (error) throw error;
}

export async function getDefaultLayout(): Promise<ProposalLayout | null> {
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) return null;

  const { data, error } = await supabase
    .from('proposal_layouts')
    .select(`
      *,
      pages:proposal_layout_pages(*)
    `)
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) return null;
  
  if (data && data.pages) {
    data.pages = data.pages.sort((a: any, b: any) => a.page_number - b.page_number);
  }
  
  return data as ProposalLayout | null;
}

export async function uploadLayoutPage(
  layoutId: string,
  file: File,
  pageNumber: number,
  pageType: 'cover' | 'content' | 'terms' | 'custom' = 'custom'
): Promise<ProposalLayoutPage> {
  // Validate file
  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are allowed');
  }
  
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size must be less than 10MB');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // Create bucket if it doesn't exist
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === 'proposal-layouts');
  
  if (!bucketExists) {
    await supabase.storage.createBucket('proposal-layouts', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['application/pdf']
    });
  }

  // Upload file
  const fileName = `${orgId}/${layoutId}/${Date.now()}-${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('proposal-layouts')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('proposal-layouts')
    .getPublicUrl(fileName);

  // Create page record
  const { data, error } = await supabase
    .from('proposal_layout_pages')
    .insert({
      layout_id: layoutId,
      page_number: pageNumber,
      file_url: publicUrl,
      file_name: file.name,
      page_type: pageType,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProposalLayoutPage;
}

export async function deleteLayoutPage(pageId: string): Promise<void> {
  // Get page data to delete file from storage
  const { data: page } = await supabase
    .from('proposal_layout_pages')
    .select('file_url')
    .eq('id', pageId)
    .single();

  if (page?.file_url) {
    // Extract file path from URL
    const urlParts = page.file_url.split('/proposal-layouts/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage
        .from('proposal-layouts')
        .remove([filePath]);
    }
  }

  // Delete page record
  const { error } = await supabase
    .from('proposal_layout_pages')
    .delete()
    .eq('id', pageId);

  if (error) throw error;
}

export async function reorderPages(
  layoutId: string,
  pageIds: string[]
): Promise<void> {
  // Update page numbers based on new order
  for (let i = 0; i < pageIds.length; i++) {
    await supabase
      .from('proposal_layout_pages')
      .update({ page_number: i + 1 })
      .eq('id', pageIds[i])
      .eq('layout_id', layoutId);
  }
}
