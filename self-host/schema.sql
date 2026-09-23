-- ============================================================
-- GovFlow Pro — Full database schema (self-hosted Supabase)
-- Generated from project migrations, in order.
-- Run once against a fresh self-hosted Supabase database.
-- ============================================================

-- ---------- 20260817012326_d99fb484-69d7-4276-a774-27449dad3df7.sql ----------
CREATE TYPE public.app_role AS ENUM ('admin','accountant','staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  id_number text,
  nationality text,
  client_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients all" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  job_title text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees all" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.transaction_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gov_entity text,
  default_gov_fee numeric(12,2) NOT NULL DEFAULT 0,
  default_office_fee numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_types TO authenticated;
GRANT ALL ON public.transaction_types TO service_role;
ALTER TABLE public.transaction_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ttypes all" ON public.transaction_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash',
  bank_name text,
  account_number text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts all" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  category text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers all" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE SEQUENCE public.transaction_ref_seq START 1000;
CREATE SEQUENCE public.invoice_no_seq START 1000;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no text NOT NULL UNIQUE DEFAULT ('TRX-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.transaction_ref_seq')::text, 5, '0')),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  type_id uuid REFERENCES public.transaction_types(id),
  type_name text NOT NULL,
  gov_entity text,
  employee_id uuid REFERENCES public.employees(id),
  opened_at date NOT NULL DEFAULT current_date,
  completed_at date,
  status text NOT NULL DEFAULT 'new',
  gov_fee numeric(12,2) NOT NULL DEFAULT 0,
  office_fee numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions all" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_no_seq')::text, 5, '0')),
  transaction_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  gov_fees numeric(12,2) NOT NULL DEFAULT 0,
  office_fees numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices all" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  account_id uuid REFERENCES public.accounts(id),
  paid_at date NOT NULL DEFAULT current_date,
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments all" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.calc_invoice_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.vat_amount := round((NEW.office_fees - NEW.discount) * NEW.vat_rate / 100, 2);
  NEW.total := NEW.gov_fees + NEW.office_fees - NEW.discount + NEW.vat_amount;
  NEW.status := CASE
    WHEN NEW.status = 'refunded' THEN 'refunded'
    WHEN NEW.paid <= 0 THEN 'unpaid'
    WHEN NEW.paid >= NEW.total THEN 'paid'
    ELSE 'partial' END;
  RETURN NEW;
END; $$;
CREATE TRIGGER invoices_calc BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.calc_invoice_totals();

CREATE OR REPLACE FUNCTION public.sync_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv uuid;
BEGIN
  inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices i
  SET paid = COALESCE((SELECT sum(amount) FROM public.payments p WHERE p.invoice_id = inv), 0)
  WHERE i.id = inv;
  RETURN NULL;
END; $$;
CREATE TRIGGER payments_sync AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_paid();

CREATE OR REPLACE FUNCTION public.create_invoice_for_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.invoices (transaction_id, client_id, gov_fees, office_fees, discount, vat_rate)
  VALUES (NEW.id, NEW.client_id, NEW.gov_fee, NEW.office_fee, NEW.discount, NEW.vat_rate);
  RETURN NEW;
END; $$;
CREATE TRIGGER transactions_create_invoice AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.create_invoice_for_transaction();

CREATE OR REPLACE FUNCTION public.sync_invoice_from_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.invoices
  SET gov_fees = NEW.gov_fee, office_fees = NEW.office_fee, discount = NEW.discount,
      vat_rate = NEW.vat_rate, client_id = NEW.client_id
  WHERE transaction_id = NEW.id;
  RETURN NEW;
END; $$;
CREATE TRIGGER transactions_sync_invoice AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_transaction();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  description text,
  amount numeric(12,2) NOT NULL,
  expense_date date NOT NULL DEFAULT current_date,
  payment_method text NOT NULL DEFAULT 'cash',
  account_id uuid REFERENCES public.accounts(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  employee_id uuid REFERENCES public.employees(id),
  receipt_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses all" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES public.accounts(id),
  to_account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount numeric(14,2) NOT NULL,
  transfer_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers all" ON public.transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_class text NOT NULL,
  parent_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coa all" ON public.chart_of_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT current_date,
  description text,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal all" ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal lines all" ON public.journal_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'salary',
  amount numeric(12,2) NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll all" ON public.payroll_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents all" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "docs read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "docs insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "docs delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

INSERT INTO public.chart_of_accounts (code, name, account_class) VALUES
 ('1000','الأصول','asset'),
 ('1100','الصندوق','asset'),
 ('1200','البنك','asset'),
 ('1300','ذمم العملاء','asset'),
 ('2000','الالتزامات','liability'),
 ('2100','رسوم حكومية محصلة (أمانات)','liability'),
 ('2200','ذمم الموردين','liability'),
 ('2300','ضريبة القيمة المضافة','liability'),
 ('3000','حقوق الملكية','equity'),
 ('4000','الإيرادات','revenue'),
 ('4100','أتعاب المكتب','revenue'),
 ('5000','المصروفات','expense'),
 ('5100','الإيجار','expense'),
 ('5200','الرواتب','expense'),
 ('5300','الاتصالات','expense'),
 ('5400','بنزين ومواصلات','expense'),
 ('5500','تسويق','expense'),
 ('5600','مصروفات نثرية','expense'),
 ('5700','مشتريات','expense');

INSERT INTO public.accounts (name, account_type, opening_balance) VALUES
 ('الصندوق الرئيسي','cash', 0),
 ('الحساب البنكي','bank', 0);

INSERT INTO public.transaction_types (name, gov_entity, default_gov_fee, default_office_fee) VALUES
 ('تجديد إقامة','الإقامة وشؤون الأجانب', 700, 300),
 ('تأشيرة زيارة','الإقامة وشؤون الأجانب', 500, 200),
 ('رخصة تجارية جديدة','دائرة التنمية الاقتصادية', 12000, 1500),
 ('تجديد رخصة تجارية','دائرة التنمية الاقتصادية', 9000, 1000),
 ('بطاقة هوية إماراتية','الهوية والجنسية', 370, 150),
 ('تصديق مستندات','وزارة الخارجية', 150, 100);
-- ---------- 20260817012338_04f3e859-3ecd-48b3-afeb-959562ab65c9.sql ----------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_invoice_totals() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_paid() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_for_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_from_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
-- ---------- 20260819131718_b221c39c-3ddf-4ac5-80ae-34ee9a19b4ef.sql ----------
CREATE TABLE public.gov_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  contact_person text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gov_entities TO authenticated;
GRANT ALL ON public.gov_entities TO service_role;

ALTER TABLE public.gov_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gov entities all" ON public.gov_entities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER gov_entities_updated_at BEFORE UPDATE ON public.gov_entities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transaction_types ADD COLUMN entity_id uuid REFERENCES public.gov_entities(id) ON DELETE SET NULL;

INSERT INTO public.gov_entities (name, code)
SELECT DISTINCT gov_entity, NULL FROM public.transaction_types
WHERE gov_entity IS NOT NULL AND btrim(gov_entity) <> '';

UPDATE public.transaction_types t
SET entity_id = e.id
FROM public.gov_entities e
WHERE t.gov_entity = e.name;
-- ---------- 20260819133616_d3c2a902-6b2b-45da-b48c-1eef47b43385.sql ----------
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "admins manage roles insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles update" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles delete" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());
-- ---------- 20260819140109_e2575743-a1e1-4704-a153-5dca69643917.sql ----------
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;

DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles read self or admin" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "roles read" ON public.user_roles;
CREATE POLICY "roles read self or admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "accounts all" ON public.accounts;
CREATE POLICY "accounts finance access" ON public.accounts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "coa all" ON public.chart_of_accounts;
CREATE POLICY "coa finance access" ON public.chart_of_accounts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "clients all" ON public.clients;
CREATE POLICY "clients operations access" ON public.clients FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "documents all" ON public.documents;
CREATE POLICY "documents operations access" ON public.documents FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "employees all" ON public.employees;
CREATE POLICY "employees finance access" ON public.employees FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "expenses all" ON public.expenses;
CREATE POLICY "expenses finance access" ON public.expenses FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "gov entities all" ON public.gov_entities;
CREATE POLICY "gov entities operations access" ON public.gov_entities FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "invoices all" ON public.invoices;
CREATE POLICY "invoices operations access" ON public.invoices FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "journal all" ON public.journal_entries;
CREATE POLICY "journal entries finance access" ON public.journal_entries FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "journal lines all" ON public.journal_lines;
CREATE POLICY "journal lines finance access" ON public.journal_lines FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "payments all" ON public.payments;
CREATE POLICY "payments operations access" ON public.payments FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "payroll all" ON public.payroll_entries;
CREATE POLICY "payroll finance access" ON public.payroll_entries FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "suppliers all" ON public.suppliers;
CREATE POLICY "suppliers finance access" ON public.suppliers FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "ttypes all" ON public.transaction_types;
CREATE POLICY "transaction types read" ON public.transaction_types FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));
CREATE POLICY "transaction types finance manage" ON public.transaction_types FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
CREATE POLICY "transaction types finance update" ON public.transaction_types FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
CREATE POLICY "transaction types finance delete" ON public.transaction_types FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "transactions all" ON public.transactions;
CREATE POLICY "transactions operations access" ON public.transactions FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "transfers all" ON public.transfers;
CREATE POLICY "transfers finance access" ON public.transfers FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
-- ---------- 20260819140148_a1397c9f-e994-4f93-be08-c7baad5c3f8a.sql ----------
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
-- ---------- 20260819140432_4b62e225-eda4-4d88-bf18-60330ddc8bb8.sql ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = ANY(_roles)
    );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;
-- ---------- 20260819140447_291ddb84-4486-41c7-a34a-3fcd6a5d5a7e.sql ----------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.has_any_role(uuid, public.app_role[]) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, public.app_role[]) TO authenticated;
-- ---------- 20260819201857_7805a90c-f0f9-454a-ab15-2b0f98fd27e9.sql ----------
DROP POLICY IF EXISTS "gov entities operations access" ON public.gov_entities;

CREATE POLICY "gov entities read" ON public.gov_entities
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "gov entities insert" ON public.gov_entities
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "gov entities update" ON public.gov_entities
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "gov entities delete" ON public.gov_entities
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));
-- ---------- 20260820024313_7ade4eb7-9f6a-4c9c-be79-b331624e7db0.sql ----------
CREATE TABLE public.office_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT '',
  legal_name_en text,
  license_no text,
  trn text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  invoice_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.office_settings TO authenticated;
GRANT ALL ON public.office_settings TO service_role;

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_settings_select" ON public.office_settings
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "office_settings_insert" ON public.office_settings
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "office_settings_update" ON public.office_settings
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE TRIGGER office_settings_set_updated_at
BEFORE UPDATE ON public.office_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.office_settings (legal_name) VALUES ('');
-- ---------- 20260820040602_8f28cd4a-51b7-4723-b65e-44c1c071ac1f.sql ----------
CREATE TABLE public.withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'withdrawal' CHECK (kind IN ('withdrawal','gov_payment')),
  amount numeric NOT NULL CHECK (amount > 0),
  withdraw_date date NOT NULL DEFAULT CURRENT_DATE,
  gov_entity text,
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select" ON public.withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "withdrawals_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "withdrawals_update" ON public.withdrawals FOR UPDATE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
CREATE POLICY "withdrawals_delete" ON public.withdrawals FOR DELETE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE TRIGGER withdrawals_set_updated_at BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ---------- 20260820041209_71290f2a-d361-4034-af7a-6410765ead00.sql ----------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS gov_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gov_fee_paid_at date;
-- ---------- 20260823184004_01085e17-d762-4962-bfa5-dff9650cf389.sql ----------
ALTER TABLE public.gov_entities ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.transaction_types ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type_name_en text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gov_entity_en text;
-- ---------- 20260824115709_7f8eee92-1767-4fa0-a877-dca750bb30a3.sql ----------
CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.gov_entities(id),
  gov_entity text,
  gov_entity_en text,
  type_id uuid REFERENCES public.transaction_types(id),
  type_name text NOT NULL,
  type_name_en text,
  gov_fee numeric NOT NULL DEFAULT 0,
  office_fee numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_items TO authenticated;
GRANT ALL ON public.transaction_items TO service_role;

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_items operations access" ON public.transaction_items
FOR ALL TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE INDEX transaction_items_transaction_id_idx ON public.transaction_items(transaction_id);
-- ---------- 20260825214552_cdf12758-e075-408e-bc97-17a5dff24a97.sql ----------
CREATE TABLE public.service_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.transaction_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  color text NOT NULL DEFAULT 'muted',
  sort_order integer NOT NULL DEFAULT 0,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_statuses TO authenticated;
GRANT ALL ON public.service_statuses TO service_role;

ALTER TABLE public.service_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service statuses read" ON public.service_statuses
  FOR SELECT TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));
CREATE POLICY "service statuses insert" ON public.service_statuses
  FOR INSERT TO authenticated WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));
CREATE POLICY "service statuses update" ON public.service_statuses
  FOR UPDATE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));
CREATE POLICY "service statuses delete" ON public.service_statuses
  FOR DELETE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE INDEX service_statuses_type_idx ON public.service_statuses(type_id, sort_order);

CREATE TRIGGER service_statuses_updated BEFORE UPDATE ON public.service_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ---------- 20260826090407_7232c5be-6682-4771-9053-6068322616e1.sql ----------
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
-- ---------- 20260826130308_ac29a71a-c118-4884-8a0b-9752789778b1.sql ----------
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS qty numeric NOT NULL DEFAULT 1;
-- ---------- 20260923120000_transactions_delete_guard.sql ----------
-- Transactions CRUD hardening. Everything here is enforced in the database, so it also
-- applies to direct Supabase API calls that bypass the UI.
--  1) Only admins may delete transactions. Reading and creating keep the previous access
--     (admin, accountant, staff).
--  2) Staff may still update a transaction, but only its status / completion date and the
--     government-fee-paid flag (the inline controls in the transactions table). Changing
--     client, services, fees, discount, VAT, etc. requires admin or accountant.
--  3) A transaction whose invoice has recorded payments can never be deleted, and an invoice
--     with recorded payments can never be deleted directly: invoices -> payments is
--     ON DELETE CASCADE, so either delete would silently erase cash/bank receipts.
--  4) Service lines (transaction_items) can be inserted by anyone who can create a
--     transaction, but only admin/accountant may change or remove them.
--  5) update_transaction_with_items(): edits a transaction and replaces its service lines
--     in a single database transaction (all-or-nothing), enforcing the payment rules.

-- 1) Split the transactions policy so DELETE is admin-only -------------------------------
DROP POLICY IF EXISTS "transactions operations access" ON public.transactions;
DROP POLICY IF EXISTS "transactions read" ON public.transactions;
DROP POLICY IF EXISTS "transactions insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions update" ON public.transactions;
DROP POLICY IF EXISTS "transactions delete" ON public.transactions;

CREATE POLICY "transactions read" ON public.transactions
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions insert" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions update" ON public.transactions
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions delete" ON public.transactions
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Staff may only change status / completion / gov-fee-paid ---------------------------
CREATE OR REPLACE FUNCTION public.guard_transaction_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is NULL for the service role / SQL editor: trusted server-side access.
  IF auth.uid() IS NULL
     OR private.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]) THEN
    RETURN NEW;
  END IF;
  IF (NEW.ref_no, NEW.client_id, NEW.type_id, NEW.type_name, NEW.type_name_en,
      NEW.gov_entity, NEW.gov_entity_en, NEW.employee_id, NEW.opened_at,
      NEW.gov_fee, NEW.office_fee, NEW.discount, NEW.vat_rate, NEW.payment_method,
      NEW.notes, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.ref_no, OLD.client_id, OLD.type_id, OLD.type_name, OLD.type_name_en,
      OLD.gov_entity, OLD.gov_entity_en, OLD.employee_id, OLD.opened_at,
      OLD.gov_fee, OLD.office_fee, OLD.discount, OLD.vat_rate, OLD.payment_method,
      OLD.notes, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'تعديل بيانات المعاملة متاح لمدير النظام والمحاسب فقط. يمكنك تغيير الحالة وحالة دفع الرسوم الحكومية.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_transaction_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_guard_update ON public.transactions;
CREATE TRIGGER transactions_guard_update BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_update();

-- 3) Never delete a transaction or invoice that has payments -----------------------------
CREATE OR REPLACE FUNCTION public.prevent_paid_transaction_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE i.transaction_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف معاملة على فاتورتها دفعات مسجلة. احذف الدفعات أو عالجها أولاً.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_paid_transaction_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_prevent_paid_delete ON public.transactions;
CREATE TRIGGER transactions_prevent_paid_delete BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_transaction_delete();

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payments WHERE invoice_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة عليها دفعات مسجلة.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_paid_invoice_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS invoices_prevent_paid_delete ON public.invoices;
CREATE TRIGGER invoices_prevent_paid_delete BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_delete();

-- 4) Service lines: insert for all operations roles, change/remove for admin/accountant --
DROP POLICY IF EXISTS "transaction_items operations access" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items read" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items insert" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items update" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items delete" ON public.transaction_items;

CREATE POLICY "transaction_items read" ON public.transaction_items
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transaction_items insert" ON public.transaction_items
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transaction_items update" ON public.transaction_items
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "transaction_items delete" ON public.transaction_items
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

-- 5) Atomic edit ---------------------------------------------------------------------------
-- SECURITY INVOKER: runs with the caller's rights, so every RLS policy and trigger above
-- still applies. p_patch holds the editable transaction columns; p_items the new lines.
CREATE OR REPLACE FUNCTION public.update_transaction_with_items(
  p_id uuid,
  p_patch jsonb,
  p_items jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_old_client uuid;
  v_paid numeric;
  v_total numeric;
BEGIN
  IF NOT private.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]) THEN
    RAISE EXCEPTION 'تعديل المعاملات متاح لمدير النظام والمحاسب فقط.' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'يجب أن تحتوي المعاملة على خدمة واحدة على الأقل.';
  END IF;

  SELECT client_id INTO v_old_client FROM public.transactions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المعاملة غير موجودة.';
  END IF;

  UPDATE public.transactions AS t SET
    client_id       = r.client_id,
    type_id         = r.type_id,
    type_name       = r.type_name,
    type_name_en    = r.type_name_en,
    gov_entity      = r.gov_entity,
    gov_entity_en   = r.gov_entity_en,
    employee_id     = r.employee_id,
    status          = r.status,
    opened_at       = r.opened_at,
    completed_at    = r.completed_at,
    gov_fee         = r.gov_fee,
    office_fee      = r.office_fee,
    discount        = r.discount,
    vat_rate        = r.vat_rate,
    payment_method  = r.payment_method,
    gov_fee_paid    = r.gov_fee_paid,
    gov_fee_paid_at = r.gov_fee_paid_at,
    notes           = r.notes
  FROM (
    -- keys missing from p_patch keep their current value
    SELECT (jsonb_populate_record(cur, p_patch)).*
    FROM public.transactions AS cur
    WHERE cur.id = p_id
  ) AS r
  WHERE t.id = p_id;

  DELETE FROM public.transaction_items WHERE transaction_id = p_id;

  INSERT INTO public.transaction_items (
    transaction_id, entity_id, gov_entity, gov_entity_en, type_id, type_name, type_name_en,
    gov_fee, office_fee, qty, sort_order
  )
  SELECT p_id, x.entity_id, x.gov_entity, x.gov_entity_en, x.type_id, x.type_name, x.type_name_en,
         COALESCE(x.gov_fee, 0), COALESCE(x.office_fee, 0), GREATEST(COALESCE(x.qty, 1), 1),
         COALESCE(x.sort_order, 0)
  FROM jsonb_populate_recordset(NULL::public.transaction_items, p_items) AS x;

  -- The invoice is re-synced by the transactions trigger above; check it against payments.
  SELECT paid, total INTO v_paid, v_total FROM public.invoices WHERE transaction_id = p_id;
  IF COALESCE(v_paid, 0) > 0 THEN
    IF (SELECT client_id FROM public.transactions WHERE id = p_id) IS DISTINCT FROM v_old_client THEN
      RAISE EXCEPTION 'لا يمكن تغيير عميل معاملة على فاتورتها دفعات مسجلة.';
    END IF;
    IF v_total < v_paid THEN
      RAISE EXCEPTION 'لا يمكن أن يقل إجمالي الفاتورة (%) عن المبلغ المحصّل (%).', v_total, v_paid;
    END IF;
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.update_transaction_with_items(uuid, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_with_items(uuid, jsonb, jsonb) TO authenticated;
-- ---------- 20260923130000_clients_delete_admin_only.sql ----------
-- Clients CRUD hardening: only admins may delete clients.
-- Reading, creating and updating keep the previous access (admin, accountant, staff).
-- Clients with transactions or invoices are already protected by ON DELETE RESTRICT;
-- their documents rows cascade (the storage files are removed by the app).

DROP POLICY IF EXISTS "clients operations access" ON public.clients;
DROP POLICY IF EXISTS "clients read" ON public.clients;
DROP POLICY IF EXISTS "clients insert" ON public.clients;
DROP POLICY IF EXISTS "clients update" ON public.clients;
DROP POLICY IF EXISTS "clients delete" ON public.clients;

CREATE POLICY "clients read" ON public.clients
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients insert" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients update" ON public.clients
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients delete" ON public.clients
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
-- ---------- 20260923140000_employees_suppliers_delete_guard.sql ----------
-- Employees & suppliers CRUD hardening.
--  * Reading, creating and updating keep the previous access (admin, accountant).
--  * Only admins may delete.
--  * An employee with payroll entries can never be deleted: payroll_entries.employee_id is
--    ON DELETE CASCADE, so a delete would silently erase salary/advance history.
--    Employees referenced by transactions or expenses are already protected by their FKs.
--    Deactivate (active = false) instead.
--  * Suppliers referenced by expenses are already protected by their FK (no cascade).

DROP POLICY IF EXISTS "employees finance access" ON public.employees;
DROP POLICY IF EXISTS "employees read" ON public.employees;
DROP POLICY IF EXISTS "employees insert" ON public.employees;
DROP POLICY IF EXISTS "employees update" ON public.employees;
DROP POLICY IF EXISTS "employees delete" ON public.employees;

CREATE POLICY "employees read" ON public.employees
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees insert" ON public.employees
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees update" ON public.employees
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees delete" ON public.employees
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.prevent_employee_with_payroll_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payroll_entries WHERE employee_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف موظف له حركات رواتب مسجلة. أوقف الموظف بدلاً من الحذف.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_employee_with_payroll_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS employees_prevent_payroll_delete ON public.employees;
CREATE TRIGGER employees_prevent_payroll_delete BEFORE DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.prevent_employee_with_payroll_delete();

DROP POLICY IF EXISTS "suppliers finance access" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers read" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers delete" ON public.suppliers;

CREATE POLICY "suppliers read" ON public.suppliers
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers insert" ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers update" ON public.suppliers
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers delete" ON public.suppliers
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
-- ---------- 20260923150000_invoices_payments_guard.sql ----------
-- Invoices & payments hardening (enforced in the database, so it also applies to direct
-- Supabase API calls that bypass the UI).
--
-- Invoices are always derived data: created by create_invoice_for_transaction, kept in sync
-- by sync_invoice_from_transaction / sync_invoice_paid and recalculated by
-- calc_invoice_totals. Those triggers are SECURITY DEFINER (they run as the table owner), so
-- they are not affected by the user-facing policies below.
--
--  Invoices
--   * read: admin, accountant, staff (unchanged)
--   * insert: nobody directly - only the transaction trigger creates invoices
--   * update: admin, accountant - and only non-financial fields (issue/due date, notes,
--     status e.g. marking as refunded). Fees, discount, VAT rate, paid, client, transaction
--     and invoice number can only change through the sync triggers.
--   * delete: nobody directly - an invoice is removed only together with its transaction
--     (cascade, admin-only, and never when payments exist; see invoices_prevent_paid_delete
--     in migration 20260923120000).
--
--  Payments
--   * read / insert: admin, accountant, staff (unchanged - staff record payments on the
--     invoice page)
--   * update / delete: admin, accountant
--   * a payment can never be moved to another invoice (sync_invoice_paid would only
--     recalculate the new invoice and leave the old invoice's paid amount wrong)
--   * new payments must have a positive amount

-- Invoices ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoices operations access" ON public.invoices;
DROP POLICY IF EXISTS "invoices read" ON public.invoices;
DROP POLICY IF EXISTS "invoices update" ON public.invoices;

CREATE POLICY "invoices read" ON public.invoices
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "invoices update" ON public.invoices
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

-- No INSERT or DELETE policy: with RLS enabled, direct inserts/deletes are denied.

CREATE OR REPLACE FUNCTION public.guard_invoice_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() IS NULL: service role / SQL editor (trusted server-side access).
  -- pg_trigger_depth() > 1: the change comes from the sync triggers (transaction edit or
  -- payment change), which compute these values themselves.
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF (NEW.invoice_no, NEW.transaction_id, NEW.client_id, NEW.gov_fees, NEW.office_fees,
      NEW.discount, NEW.vat_rate, NEW.paid, NEW.created_at)
     IS DISTINCT FROM
     (OLD.invoice_no, OLD.transaction_id, OLD.client_id, OLD.gov_fees, OLD.office_fees,
      OLD.discount, OLD.vat_rate, OLD.paid, OLD.created_at) THEN
    RAISE EXCEPTION 'المبالغ والعميل في الفاتورة تُحسب تلقائياً من المعاملة والدفعات ولا يمكن تعديلها مباشرة. عدّل المعاملة أو الدفعات بدلاً من ذلك.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_invoice_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS invoices_guard_update ON public.invoices;
CREATE TRIGGER invoices_guard_update BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_update();

-- Payments ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "payments operations access" ON public.payments;
DROP POLICY IF EXISTS "payments read" ON public.payments;
DROP POLICY IF EXISTS "payments insert" ON public.payments;
DROP POLICY IF EXISTS "payments update" ON public.payments;
DROP POLICY IF EXISTS "payments delete" ON public.payments;

CREATE POLICY "payments read" ON public.payments
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "payments insert" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "payments update" ON public.payments
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "payments delete" ON public.payments
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE OR REPLACE FUNCTION public.guard_payment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'لا يمكن نقل دفعة إلى فاتورة أخرى. احذفها وسجّلها على الفاتورة الصحيحة.';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_payment_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS payments_guard_update ON public.payments;
CREATE TRIGGER payments_guard_update BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_update();

-- NOT VALID: applies to new and updated rows without failing on any historical data.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID;
-- ---------- 20260924120000_treasury_accounts_guard.sql ----------
-- Treasury accounts: edit, deactivate/reactivate and delete rules, enforced in the database
-- so they also apply to direct Supabase API calls that bypass the UI.
--
--  1) Admin and accountant may read, create and update accounts (unchanged); only admins may
--     delete. Accounts referenced by payments, expenses, transfers or withdrawals can never be
--     deleted anyway (existing foreign keys).
--  2) Once an account has financial records, its opening balance and type are locked: balances
--     are computed live from the opening balance, so changing it (or moving the account between
--     cash and bank) would rewrite every past balance. Name, bank name and account number stay
--     editable, and the account can always be deactivated/reactivated.
--  3) An inactive account cannot be used by a new payment, expense, withdrawal or transfer, nor
--     be set as the account of an existing one. Existing records that already use it are kept
--     and can still be edited as long as their account does not change.

-- 1) Policies ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "accounts finance access" ON public.accounts;
DROP POLICY IF EXISTS "accounts read" ON public.accounts;
DROP POLICY IF EXISTS "accounts insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts update" ON public.accounts;
DROP POLICY IF EXISTS "accounts delete" ON public.accounts;

CREATE POLICY "accounts read" ON public.accounts
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts insert" ON public.accounts
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts update" ON public.accounts
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts delete" ON public.accounts
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Lock opening balance and type once the account has financial records ---------------
CREATE OR REPLACE FUNCTION public.guard_account_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.opening_balance, NEW.account_type) IS DISTINCT FROM (OLD.opening_balance, OLD.account_type)
     AND (
       EXISTS (SELECT 1 FROM public.payments WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.expenses WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.withdrawals WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.transfers WHERE from_account_id = OLD.id OR to_account_id = OLD.id)
     ) THEN
    RAISE EXCEPTION 'لا يمكن تعديل الرصيد الافتتاحي أو نوع حساب عليه حركات مالية مسجلة. يمكنك تعديل الاسم وبيانات البنك فقط.';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_account_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS accounts_guard_update ON public.accounts;
CREATE TRIGGER accounts_guard_update BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.guard_account_update();

-- 3) Inactive accounts cannot receive new financial records -------------------------------
-- SECURITY DEFINER so the check can read accounts even for staff, who record payments on the
-- invoice page but have no read access to accounts.
CREATE OR REPLACE FUNCTION public.require_active_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
  v_name text;
BEGIN
  IF TG_TABLE_NAME = 'transfers' THEN
    v_ids := ARRAY[]::uuid[];
    IF TG_OP = 'INSERT' OR NEW.from_account_id IS DISTINCT FROM OLD.from_account_id THEN
      v_ids := v_ids || NEW.from_account_id;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.to_account_id IS DISTINCT FROM OLD.to_account_id THEN
      v_ids := v_ids || NEW.to_account_id;
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    v_ids := ARRAY[NEW.account_id];
  END IF;

  SELECT name INTO v_name
  FROM public.accounts
  WHERE id = ANY (v_ids) AND NOT active
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'الحساب "%" موقوف ولا يمكن استخدامه في حركات مالية جديدة. أعد تفعيله أو اختر حساباً آخر.', v_name;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.require_active_account() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS payments_require_active_account ON public.payments;
CREATE TRIGGER payments_require_active_account BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS expenses_require_active_account ON public.expenses;
CREATE TRIGGER expenses_require_active_account BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS withdrawals_require_active_account ON public.withdrawals;
CREATE TRIGGER withdrawals_require_active_account BEFORE INSERT OR UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS transfers_require_active_account ON public.transfers;
CREATE TRIGGER transfers_require_active_account BEFORE INSERT OR UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();
-- ---------- 20260925120000_withdrawals_insert_finance_only.sql ----------
-- Withdrawals: only admins and accountants may create them.
--
-- The original policy (migration 20260820040602) was WITH CHECK (true), so any signed-in
-- user - including staff - could record a withdrawal through the Supabase API, even though
-- the only UI that creates withdrawals is the Treasury page (admin/accountant only).
-- This aligns INSERT with the existing UPDATE/DELETE policies. SELECT, UPDATE and DELETE are
-- unchanged.

DROP POLICY IF EXISTS "withdrawals_insert" ON public.withdrawals;

CREATE POLICY "withdrawals_insert" ON public.withdrawals
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
-- ---------- 20260926120000_withdrawals_select_finance_only.sql ----------
-- Withdrawals: only admins and accountants may view them.
--
-- The original policy (migration 20260820040602) was USING (true), so any signed-in user -
-- including staff - could read every withdrawal (amounts, accounts, references, notes)
-- through the Supabase API, although the only screen that shows withdrawals is the Treasury
-- page (admin/accountant only). This aligns SELECT with the existing UPDATE/DELETE policies.
-- INSERT, UPDATE and DELETE policies are unchanged.

DROP POLICY IF EXISTS "withdrawals_select" ON public.withdrawals;

CREATE POLICY "withdrawals_select" ON public.withdrawals
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
