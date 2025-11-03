-- Add foreign key from opportunity_notes to profiles
ALTER TABLE public.opportunity_notes
ADD CONSTRAINT opportunity_notes_created_by_profiles_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;