import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";

export type OfficeSettings = {
  id: string;
  legal_name: string;
  legal_name_en: string | null;
  license_no: string | null;
  trn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  invoice_footer: string | null;
};

export const OFFICE_KEY = "office-settings";

export function useOffice() {
  return useSb<OfficeSettings>([OFFICE_KEY], () =>
    supabase
      .from("office_settings")
      .select(
        "id, legal_name, legal_name_en, license_no, trn, address, phone, email, website, logo_url, invoice_footer",
      )
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  );
}
