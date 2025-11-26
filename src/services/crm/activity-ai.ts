import { supabase } from '@/integrations/supabase/client';

export interface ActivitySuggestions {
  suggestedTime: string;
  suggestedDuration: number;
  titleSuggestion?: string;
  descriptionTemplate: string;
  tips: string[];
  historicalAvgDuration: number;
  historicalBestHour: number;
}

export async function getActivitySuggestions(
  activityType: string,
  context?: any
): Promise<ActivitySuggestions> {
  const { data, error } = await supabase.functions.invoke('ai-activity-suggestions', {
    body: { activityType, context: context || {} },
  });

  if (error) throw error;
  return data.suggestions;
}
