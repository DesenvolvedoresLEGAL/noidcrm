DROP FUNCTION IF EXISTS public.report_products_sold(date, date, uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.report_products_monthly(date, date, uuid[], uuid[], int);
DROP FUNCTION IF EXISTS public.report_products_cross(date, date, uuid[], uuid[]);

REVOKE ALL ON FUNCTION public.report_products_sold(date, date, text[], uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_products_monthly(date, date, text[], uuid[], int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_products_cross(date, date, text[], uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.report_products_sold(date, date, text[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_products_monthly(date, date, text[], uuid[], int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_products_cross(date, date, text[], uuid[]) TO authenticated;