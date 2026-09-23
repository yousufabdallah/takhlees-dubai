import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CLIENT_STATUS, CLIENT_TYPE } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ClientRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  nationality: string | null;
  client_type: string;
  status: string;
  notes: string | null;
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  id_number: "",
  nationality: "",
  client_type: "individual",
  status: "new",
  notes: "",
};

function toForm(c: ClientRecord) {
  return {
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    id_number: c.id_number ?? "",
    nationality: c.nationality ?? "",
    client_type: c.client_type,
    status: c.status,
    notes: c.notes ?? "",
  };
}

/** نموذج إضافة عميل أو تعديل بياناته — `client` يحدد وضع التعديل */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRecord | null;
  onSaved: () => void;
}) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // تُعبأ الحقول مرة واحدة عند فتح نموذج التعديل، فلا يمحو تحديثُ البيانات في الخلفية ما يكتبه المستخدم
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      filledFor.current = null;
      return;
    }
    if (client && filledFor.current !== client.id) {
      filledFor.current = client.id;
      setForm(toForm(client));
    }
  }, [open, client]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم العميل مطلوب");
      return;
    }
    setSaving(true);
    try {
      if (client) {
        const { data, error } = await supabase
          .from("clients")
          .update({ ...form, name: form.name.trim() })
          .eq("id", client.id)
          .select("id");
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data || data.length === 0) {
          toast.error(
            tr("لا تملك صلاحية تعديل هذا العميل", "You are not allowed to edit this client"),
          );
          return;
        }
        toast.success(tr("تم تحديث بيانات العميل", "Client updated"));
      } else {
        const { error } = await supabase.from("clients").insert(form);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("تم حفظ العميل");
      }
      setForm(EMPTY_FORM);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (saving) return;
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بعميل جديد
    if (!next && client) setForm(EMPTY_FORM);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? tr(`تعديل بيانات ${client.name}`, `Edit ${client.name}`) : "إضافة عميل"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الاسم *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الهاتف</Label>
            <Input
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهوية / الجواز</Label>
            <Input
              dir="ltr"
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجنسية</Label>
            <Input
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <Select
              value={form.client_type}
              onValueChange={(v) => setForm({ ...form, client_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_TYPE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>حالة العميل</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          {client && (
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              {tr("إلغاء", "Cancel")}
            </Button>
          )}
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {client ? tr("حفظ التعديلات", "Save changes") : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteInfo = { trxCount: number; invCount: number; docPaths: string[] };

/** تأكيد حذف العميل بعد فحص المعاملات والفواتير والمستندات المرتبطة */
export function DeleteClientDialog({
  client,
  onClose,
  onDeleted,
}: {
  client: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const [info, setInfo] = useState<DeleteInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clientId = client?.id ?? null;
  useEffect(() => {
    setInfo(null);
    setInfoError(null);
    if (!clientId) return;
    let alive = true;
    void (async () => {
      const [trxRes, invRes, docsRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
        supabase.from("documents").select("file_path").eq("client_id", clientId),
      ]);
      if (!alive) return;
      const err = trxRes.error ?? invRes.error ?? docsRes.error;
      if (err) {
        setInfoError(err.message);
        return;
      }
      setInfo({
        trxCount: trxRes.count ?? 0,
        invCount: invRes.count ?? 0,
        docPaths: (docsRes.data ?? []).map((d) => d.file_path),
      });
    })();
    return () => {
      alive = false;
    };
  }, [clientId]);

  const blocked = !!info && (info.trxCount > 0 || info.invCount > 0);

  async function confirmDelete() {
    if (!client || !info || blocked) return;
    setDeleting(true);
    try {
      // سجلات المستندات تُحذف تلقائياً (cascade)، وسجل الإشعارات يبقى (client_id يصبح فارغاً)
      const { data, error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)
        .select("id");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error(tr("لا تملك صلاحية حذف العملاء", "You are not allowed to delete clients"));
        return;
      }
      if (info.docPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove(info.docPaths);
        if (storageError)
          toast.warning(
            tr(
              "حُذف العميل لكن تعذّر حذف بعض ملفات المستندات من التخزين",
              "Client deleted, but some document files could not be removed from storage",
            ),
          );
      }
      toast.success(tr(`تم حذف العميل ${client.name}`, `Client ${client.name} deleted`));
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={!!client}
      onOpenChange={(v) => {
        if (!v && !deleting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tr(`حذف العميل ${client?.name ?? ""}؟`, `Delete client ${client?.name ?? ""}?`)}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {infoError ? (
                <p className="text-destructive">{infoError}</p>
              ) : !info ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {tr("جارٍ فحص البيانات المرتبطة…", "Checking related records…")}
                </p>
              ) : blocked ? (
                <p className="surface bg-destructive/10 p-3 text-destructive">
                  {tr(
                    `لا يمكن الحذف: لهذا العميل ${info.trxCount} معاملة و${info.invCount} فاتورة مسجلة. سجلّه جزء من الحسابات؛ يمكنك تغيير حالته إلى "مكتمل" بدلاً من الحذف.`,
                    `Cannot delete: this client has ${info.trxCount} transaction(s) and ${info.invCount} invoice(s). Their record is part of the accounts; set the status to "Completed" instead.`,
                  )}
                </p>
              ) : (
                <>
                  <p>
                    {tr(
                      "لا توجد معاملات أو فواتير لهذا العميل. سيتم حذف ما يلي نهائياً:",
                      "This client has no transactions or invoices. The following will be permanently deleted:",
                    )}
                  </p>
                  <ul className="list-disc space-y-1 ps-5">
                    <li>{tr("بيانات العميل", "Client details")}</li>
                    {info.docPaths.length > 0 && (
                      <li>
                        {tr(
                          `المستندات المرفقة (${info.docPaths.length})`,
                          `Attached documents (${info.docPaths.length})`,
                        )}
                      </li>
                    )}
                  </ul>
                  <p className="text-xs">
                    {tr(
                      "سجل الإشعارات المرسلة يبقى محفوظاً. لا يمكن التراجع عن هذا الإجراء.",
                      "The notification log is kept. This action cannot be undone.",
                    )}
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{tr("إلغاء", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting || !info || blocked}
            onClick={(e) => {
              e.preventDefault();
              void confirmDelete();
            }}
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            {tr("حذف نهائي", "Delete permanently")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
