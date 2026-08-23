REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_invoice_totals() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_paid() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_for_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_from_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;