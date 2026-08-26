CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend',
  api_key text,
  from_email text,
  from_name text,
  notify_on_create boolean NOT NULL DEFAULT true,
  notify_on_status boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_settings_admin_all" ON public.email_settings;
CREATE POLICY "email_settings_admin_all" ON public.email_settings
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  kind text NOT NULL,
  recipient text,
  subject text,
  status text NOT NULL,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log_read" ON public.notification_log;
CREATE POLICY "notification_log_read" ON public.notification_log
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notification_log_insert" ON public.notification_log;
CREATE POLICY "notification_log_insert" ON public.notification_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS email_settings_updated_at ON public.email_settings;
CREATE TRIGGER email_settings_updated_at BEFORE UPDATE ON public.email_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();