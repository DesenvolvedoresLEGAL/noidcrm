import { supabase } from '@/integrations/supabase/client';

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  opportunity_id: string;
  current_step_index: number;
  status: 'active' | 'paused' | 'completed' | 'exited';
  enrolled_at: string;
  next_step_scheduled_at: string | null;
  pause_reason: string | null;
  ab_variant: string | null;
  engagement_data: any;
}

export interface StageProgressionSuggestion {
  id: string;
  opportunity_id: string;
  current_stage_id: string;
  suggested_stage_id: string;
  confidence_score: number;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
}

// Generate AI variations for sequence
export async function generateAIVariations(sequenceId: string, stepContent: any): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke('ai-sequence-orchestrator', {
    body: { 
      action: 'generate-variations', 
      sequenceId, 
      stepContent 
    }
  });

  if (error) throw error;
  return data.variations;
}

// Check if opportunity should be enrolled
export async function checkSequenceEnrollment(sequenceId: string, opportunityId: string): Promise<{ shouldEnroll: boolean; reasons: string[] }> {
  const { data, error } = await supabase.functions.invoke('ai-sequence-orchestrator', {
    body: { 
      action: 'check-enrollment', 
      sequenceId, 
      opportunityId 
    }
  });

  if (error) throw error;
  return data;
}

// Enroll opportunity in sequence
export async function enrollInSequence(sequenceId: string, opportunityId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ai-sequence-orchestrator', {
    body: { 
      action: 'enroll', 
      sequenceId, 
      opportunityId 
    }
  });

  if (error) throw error;
}

// List enrollments
export async function listEnrollments(filters?: { sequenceId?: string; opportunityId?: string; status?: string }): Promise<SequenceEnrollment[]> {
  let query = supabase
    .from('sequence_enrollments')
    .select('*')
    .order('enrolled_at', { ascending: false });

  if (filters?.sequenceId) {
    query = query.eq('sequence_id', filters.sequenceId);
  }
  if (filters?.opportunityId) {
    query = query.eq('opportunity_id', filters.opportunityId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as SequenceEnrollment[];
}

// Update enrollment status
export async function updateEnrollmentStatus(enrollmentId: string, status: string, reason?: string): Promise<void> {
  const updateData: any = { status };
  
  if (status === 'paused') {
    updateData.paused_at = new Date().toISOString();
    updateData.pause_reason = reason;
  }
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('sequence_enrollments')
    .update(updateData)
    .eq('id', enrollmentId);

  if (error) throw error;
}

// Get stage progression suggestions
export async function getStageProgressionSuggestions(): Promise<StageProgressionSuggestion[]> {
  const { data, error } = await supabase
    .from('stage_progression_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as StageProgressionSuggestion[];
}

// Generate stage progression suggestion for opportunity
export async function generateStageProgressionSuggestion(opportunityId: string): Promise<StageProgressionSuggestion | null> {
  const { data, error } = await supabase.functions.invoke('stage-progression-detector', {
    body: { opportunityId }
  });

  if (error) throw error;
  return data.suggestion;
}

// Accept stage progression suggestion
export async function acceptStageProgression(suggestionId: string, newStageId: string): Promise<void> {
  // Get suggestion
  const { data: suggestion } = await supabase
    .from('stage_progression_suggestions')
    .select('opportunity_id')
    .eq('id', suggestionId)
    .single();

  if (!suggestion) throw new Error('Suggestion not found');

  // Update opportunity stage
  const { error: updateError } = await supabase
    .from('opportunities')
    .update({ stage_id: newStageId })
    .eq('id', suggestion.opportunity_id);

  if (updateError) throw updateError;

  // Mark suggestion as accepted
  const { error: suggestionError } = await supabase
    .from('stage_progression_suggestions')
    .update({
      status: 'accepted',
      action_taken_at: new Date().toISOString()
    })
    .eq('id', suggestionId);

  if (suggestionError) throw suggestionError;
}

// Reject stage progression suggestion
export async function rejectStageProgression(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('stage_progression_suggestions')
    .update({
      status: 'rejected',
      action_taken_at: new Date().toISOString()
    })
    .eq('id', suggestionId);

  if (error) throw error;
}