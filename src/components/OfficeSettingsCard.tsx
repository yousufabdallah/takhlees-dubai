import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/queries";
import { OFFICE_KEY, useOffice, type OfficeSettings } from "@/lib/office";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = Omit<OfficeSettings, "id">;

const EMPTY: FormState = {
  legal_name: "",
  legal_name_en: "",
  license_no: "",
  trn: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  invoice_footer: "",
};

export function OfficeSettingsCard() {
  const office = useOffice();
  const invalidate = useInvalidate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = office.data;
    if (!d) return;
    setForm({
      legal_name: d.legal_name ?? "",
      legal_name_en: d.legal_name_en ?? "",
      license_no: d.license_no ?? "",
      trn: d.trn ?? "",
      address: d.address ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      website: d.website ?? "",
      logo_url: d.logo_url ?? "",
      invoice_footer: d.invoice_footer ?? "",
    });
  }, [office.data]);

  async function save() {
    if (!form.legal_name.trim()) {
      toast.error("أدخل اسم المكتب القانوني");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    const { error } = office.data?.id
      ? await supabase.from("office_settings").update(payload).eq("id", office.data.id)
      : await supabase.from("office_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ بيانات المكتب");
    invalidate(OFFICE_KEY);
  }

  const field = (key: keyof FormState, label: string, placeholder?: string, ltr?: boolean) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={form[key] ?? ""}
        dir={ltr ? "ltr" : undefined}
        placeholder={placeholder ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="surface mt-6 p-5">
      <h2 className="font-bold">بيانات المكتب (تظهر في الفواتير الرسمية)</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        اسم المكتب القانوني وبياناته تُطبع في ترويسة الفاتورة عند الطباعة أو التصدير.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("legal_name", "اسم المكتب القانوني *", "مثال: مكتب الإمارات لتخليص المعاملات ذ.م.م")}
        {field("legal_name_en", "الاسم بالإنجليزية", "Emirates Documents Clearing LLC", true)}
        {field("license_no", "رقم الرخصة التجارية", "", true)}
        {field("trn", "الرقم الضريبي TRN", "", true)}
        {field("phone", "الهاتف", "", true)}
        {field("email", "البريد الإلكتروني", "", true)}
        {field("website", "الموقع الإلكتروني", "", true)}
        {field("logo_url", "رابط الشعار (اختياري)", "https://...", true)}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>العنوان</Label>
          <Textarea
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>تذييل الفاتورة</Label>
          <Textarea
            value={form.invoice_footer ?? ""}
            placeholder="شروط الدفع أو أي ملاحظات رسمية تُطبع أسفل الفاتورة"
            onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ بيانات المكتب"}
        </Button>
      </div>
    </div>
  );
}
