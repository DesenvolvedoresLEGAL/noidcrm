-- Fix security definer view warning
DROP VIEW IF EXISTS public.forecast_accuracy_metrics;

CREATE VIEW public.forecast_accuracy_metrics 
WITH (security_invoker = true) AS
SELECT 
  organization_id,
  prediction_type,
  prediction_source,
  COUNT(*) as total_predictions,
  COUNT(actual_value) as predictions_with_outcome,
  AVG(ABS(error_value)) as mean_absolute_error,
  AVG(ABS(error_percentage)) as mean_percentage_error,
  STDDEV(error_value) as error_std_dev,
  AVG(CASE WHEN confidence_level >= 0.8 THEN ABS(error_value) END) as mae_high_confidence,
  AVG(CASE WHEN confidence_level < 0.5 THEN ABS(error_value) END) as mae_low_confidence,
  COUNT(CASE WHEN prediction_source = 'ai_model' AND was_accurate THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(CASE WHEN prediction_source = 'ai_model' AND actual_value IS NOT NULL THEN 1 END), 0) * 100 as ai_accuracy_rate,
  COUNT(CASE WHEN prediction_source = 'human' AND was_accurate THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(CASE WHEN prediction_source = 'human' AND actual_value IS NOT NULL THEN 1 END), 0) * 100 as human_accuracy_rate,
  AVG(CASE WHEN predicted_at >= NOW() - INTERVAL '30 days' THEN ABS(error_value) END) as recent_mae
FROM public.forecast_predictions
GROUP BY organization_id, prediction_type, prediction_source;