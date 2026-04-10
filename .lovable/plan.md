

# Fix: Simulation Edge Function FK Violation on `executed_by`

## Root Cause

The `run-agent-simulation` edge function inserts into `ai_agent_simulation_runs` with `executed_by: user.id`, but this column has a FK to `profiles(id)`. The current user (`fd4bbf6a-...` / `wagner@operadora.legal`) exists in `auth.users` but has no row in `profiles`, causing the FK constraint violation.

## Fix (2 changes)

### 1. Database Migration — Create missing profile + ensure future resilience

- Insert the missing profile for `wagner@operadora.legal`
- Create a trigger on `auth.users` that auto-creates a profile row on new user signup (prevents this from recurring)

```sql
INSERT INTO profiles (id, email, full_name) 
VALUES ('fd4bbf6a-cf4e-490e-94ca-d47166277590', 'wagner@operadora.legal', 'Wagner')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Edge Function — Add defensive profile check

Update `run-agent-simulation/index.ts` to ensure the user's profile exists before inserting simulation runs. Add an upsert call right after authentication succeeds:

```typescript
// After user auth succeeds, ensure profile exists
await supabase.from('profiles').upsert({
  id: user.id,
  email: user.email,
  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
}, { onConflict: 'id', ignoreDuplicates: true });
```

This ensures the FK constraint is always satisfied, even if the trigger didn't fire.

## Files

| Action | File |
|--------|------|
| Migration | Insert missing profile + create auto-profile trigger |
| Edit | `supabase/functions/run-agent-simulation/index.ts` — add profile upsert |

