import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import {
  loadEmailSettings,
  saveEmailSettings,
  sendTestEmail,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Provider = "resend" | "brevo" | "sendgrid";

const PROVIDER_HINT: Record<Provider, string> = {
  resend: "resend.com — أنشئ حساباً مجانياً ثم انسخ مفتاح API (يبدأ بـ re_).",
  brevo: "brevo.com — من Settings → SMTP & API انسخ مفتاح API v3 (300 رسالة يومياً مجاناً).",
  sendgrid: "sendgrid.com — من Settings → API Keys أنشئ مفتاحاً بصلاحية Mail Send.",
};

export function EmailSettingsCard() {
  const load = useServerFn(loadEmailSettings);
  const save = useServerFn(saveEmailSettings);
  const test = useServerFn(sendTestEmail);

  const settings = useQuery({ queryKey: ["email-settings"], queryFn: () => load({}) });

  const [provider, setProvider] = useState<Provider>("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [onCreate, setOnCreate] = useState(true);
  const [onStatus, setOnStatus] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = settings.data;
    if (!d) return;
    setProvider((d.provider as Provider) ?? "resend");
    setFromEmail(d.from_email ?? "");
    setFromName(d.from_name ?? "");
    setOnCreate(d.notify_on_create);
    setOnStatus(d.notify_on_status);
    setEnabled(d.enabled);
  }, [settings.data]);

  async function onSave() {
    setBusy(true);
    try {
      await save({
        data: {
          provider,
          api_key: apiKey,
          from_email: fromEmail.trim(),
          from_name: fromName.trim(),
          notify_on_create: onCreate,
          notify_on_status: onStatus,
          enabled,
        },
      });
      setApiKey("");
      await settings.refetch();
      toast.success("تم حفظ إعدادات البريد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    if (!testTo.trim()) {
      toast.error("أدخل بريداً لاختبار الإرسال");
      return;
    }
    setBusy(true);
    try {
      await test({ data: { to: testTo.trim() } });
      toast.success("تم إرسال رسالة الاختبار بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إرسال الاختبار");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface mt-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <h2 className="font-bold">إعدادات بريد الإشعارات</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        اضبط مزوّد الإرسال يدوياً هنا بدل إعداد نطاق بريد. أدخل مفتاح المزوّد وبريد المُرسل ثم فعّل
        الإشعارات.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>المزوّد</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resend">Resend</SelectItem>
              <SelectItem value="brevo">Brevo (Sendinblue)</SelectItem>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{PROVIDER_HINT[provider]}</p>
        </div>

        <div className="space-y-1.5">
          <Label>مفتاح API</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings.data?.has_key ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "أدخل المفتاح"}
          />
        </div>

        <div className="space-y-1.5">
          <Label>بريد المُرسل</Label>
          <Input
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="no-reply@yourdomain.com"
            dir="ltr"
          />
        </div>

        <div className="space-y-1.5">
          <Label>اسم المُرسل</Label>
          <Input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="نخبة المستقبل"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>تفعيل الإرسال</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>عند معاملة جديدة</span>
          <Switch checked={onCreate} onCheckedChange={setOnCreate} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>عند تغيير الحالة</span>
          <Switch checked={onStatus} onCheckedChange={setOnStatus} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Button onClick={onSave} disabled={busy}>
          حفظ الإعدادات
        </Button>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">اختبار الإرسال إلى</Label>
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="test@example.com"
              dir="ltr"
              className="w-56"
            />
          </div>
          <Button variant="outline" onClick={onTest} disabled={busy}>
            إرسال اختبار
          </Button>
        </div>
      </div>
    </div>
  );
}
