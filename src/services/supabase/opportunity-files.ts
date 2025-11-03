import { supabase } from '@/integrations/supabase/client';

export interface OpportunityFile {
  id: string;
  opportunity_id: string;
  organization_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  uploader?: {
    full_name: string;
    avatar_url?: string;
  };
}

export async function listOpportunityFiles(opportunityId: string): Promise<OpportunityFile[]> {
  const { data, error } = await supabase
    .from('opportunity_files')
    .select(`
      *,
      uploader:profiles!opportunity_files_uploaded_by_profiles_fkey(full_name, avatar_url)
    `)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as OpportunityFile[];
}

export async function uploadOpportunityFile(
  opportunityId: string,
  file: File
): Promise<OpportunityFile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization to upload files');
  }

  // Create storage path: organizationId/opportunityId/fileName
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storagePath = `${memberData.organization_id}/${opportunityId}/${fileName}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('opportunity-files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Create metadata record
  const { data, error } = await supabase
    .from('opportunity_files')
    .insert([{
      opportunity_id: opportunityId,
      organization_id: memberData.organization_id,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: storagePath,
      uploaded_by: user.id,
    }])
    .select(`
      *,
      uploader:profiles!opportunity_files_uploaded_by_profiles_fkey(full_name, avatar_url)
    `)
    .single();

  if (error) {
    // Rollback storage upload if metadata creation fails
    await supabase.storage.from('opportunity-files').remove([storagePath]);
    throw error;
  }

  return data as OpportunityFile;
}

export async function downloadOpportunityFile(file: OpportunityFile): Promise<void> {
  const { data, error } = await supabase.storage
    .from('opportunity-files')
    .download(file.storage_path);

  if (error) throw error;

  // Create download link
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.file_name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteOpportunityFile(file: OpportunityFile): Promise<void> {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('opportunity-files')
    .remove([file.storage_path]);

  if (storageError) throw storageError;

  // Delete metadata
  const { error } = await supabase
    .from('opportunity_files')
    .delete()
    .eq('id', file.id);

  if (error) throw error;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
