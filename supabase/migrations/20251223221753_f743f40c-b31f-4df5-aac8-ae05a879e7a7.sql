-- Corrigir funções para definir search_path
CREATE OR REPLACE FUNCTION calculate_evaluation_fit_score()
RETURNS TRIGGER AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Buscar configuração de pesos da organização
  SELECT cultural_weight, performance_weight 
  INTO config_record
  FROM public.fit_score_config 
  WHERE organization_id = NEW.organization_id;
  
  -- Se não houver config, usar 50/50
  IF NOT FOUND THEN
    config_record.cultural_weight := 0.50;
    config_record.performance_weight := 0.50;
  END IF;
  
  -- Calcular FitScore ponderado
  NEW.fit_score := ROUND(
    (NEW.cultural_fit_score * config_record.cultural_weight) + 
    (NEW.performance_score * config_record.performance_weight),
    2
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION update_seller_current_fit_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma avaliação é aprovada, atualizar o vendedor
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.sellers
    SET 
      current_fit_score = NEW.fit_score,
      last_evaluation_id = NEW.id,
      last_evaluation_date = NEW.period_end
    WHERE id = NEW.seller_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;