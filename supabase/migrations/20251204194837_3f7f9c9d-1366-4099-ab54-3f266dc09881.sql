-- Create function to trigger opportunity score recalculation
CREATE OR REPLACE FUNCTION public.trigger_opportunity_score_recalc()
RETURNS TRIGGER AS $$
DECLARE
  opp_id uuid;
BEGIN
  -- Determine the opportunity ID based on trigger context
  IF TG_TABLE_NAME = 'activities' THEN
    opp_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    opp_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  ELSIF TG_TABLE_NAME = 'opportunities' THEN
    opp_id := COALESCE(NEW.id, OLD.id);
  END IF;
  
  -- Mark opportunity for recalculation by setting score_updated_at to null
  IF opp_id IS NOT NULL THEN
    UPDATE opportunities 
    SET score_updated_at = NULL 
    WHERE id = opp_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to trigger account score recalculation
CREATE OR REPLACE FUNCTION public.trigger_account_score_recalc()
RETURNS TRIGGER AS $$
DECLARE
  acc_id uuid;
BEGIN
  -- Determine the account ID based on trigger context
  IF TG_TABLE_NAME = 'activities' THEN
    acc_id := COALESCE(NEW.account_id, OLD.account_id);
  ELSIF TG_TABLE_NAME = 'opportunities' THEN
    acc_id := COALESCE(NEW.account_id, OLD.account_id);
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    -- Get account from opportunity
    SELECT account_id INTO acc_id 
    FROM opportunities 
    WHERE id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  END IF;
  
  -- Mark account for recalculation by setting score_updated_at to null
  IF acc_id IS NOT NULL THEN
    UPDATE accounts 
    SET score_updated_at = NULL 
    WHERE id = acc_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for activities affecting opportunity scores
DROP TRIGGER IF EXISTS trigger_activity_opp_score ON activities;
CREATE TRIGGER trigger_activity_opp_score
  AFTER INSERT OR UPDATE OF status, completed_at ON activities
  FOR EACH ROW
  WHEN (NEW.opportunity_id IS NOT NULL)
  EXECUTE FUNCTION trigger_opportunity_score_recalc();

-- Trigger for activities affecting account scores
DROP TRIGGER IF EXISTS trigger_activity_acc_score ON activities;
CREATE TRIGGER trigger_activity_acc_score
  AFTER INSERT OR UPDATE OF status, completed_at ON activities
  FOR EACH ROW
  WHEN (NEW.account_id IS NOT NULL)
  EXECUTE FUNCTION trigger_account_score_recalc();

-- Trigger for proposals affecting opportunity scores
DROP TRIGGER IF EXISTS trigger_proposal_opp_score ON proposals;
CREATE TRIGGER trigger_proposal_opp_score
  AFTER INSERT OR UPDATE OF status ON proposals
  FOR EACH ROW
  WHEN (NEW.opportunity_id IS NOT NULL)
  EXECUTE FUNCTION trigger_opportunity_score_recalc();

-- Trigger for proposals affecting account scores
DROP TRIGGER IF EXISTS trigger_proposal_acc_score ON proposals;
CREATE TRIGGER trigger_proposal_acc_score
  AFTER INSERT OR UPDATE OF status ON proposals
  FOR EACH ROW
  WHEN (NEW.opportunity_id IS NOT NULL)
  EXECUTE FUNCTION trigger_account_score_recalc();

-- Trigger for opportunity stage changes affecting velocity score
DROP TRIGGER IF EXISTS trigger_opp_stage_score ON opportunities;
CREATE TRIGGER trigger_opp_stage_score
  AFTER UPDATE OF stage_id ON opportunities
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION trigger_opportunity_score_recalc();

-- Trigger for opportunity changes affecting account scores (lifecycle)
DROP TRIGGER IF EXISTS trigger_opp_acc_score ON opportunities;
CREATE TRIGGER trigger_opp_acc_score
  AFTER INSERT OR UPDATE OF status ON opportunities
  FOR EACH ROW
  WHEN (NEW.account_id IS NOT NULL)
  EXECUTE FUNCTION trigger_account_score_recalc();