import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { useRole } from "@/hooks/useRole";
import { canManageCatalog } from "@/lib/permissions";

import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/gov-entities")({
  head: () => ({
    meta: [
      { title: "الجهات الحكومية — نظام مكتب التخليص" },
      {
        name: "description",
        content: "تسجيل أسماء الجهات الحكومية التي يتعامل معها المكتب وبيانات التواصل معها.",
      },
      { property: "og:title", content: "الجهات الحكومية — نظام مكتب التخليص" },
      { property: "og:description", content: "إدارة الجهات الحكومية وخدماتها." },
    ],
  }),
  component: GovEntitiesPage,
});

type Entity = {
  id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

const EMPTY = {
  id: "",
  name: "",
  code: "",
  contact_person: "",
  phone: "",
  notes: "",
  active: true,
};

function GovEntitiesPage() {
  const invalidate = useInvalidate();
  const { role } = useRole();
  const canManage = canManageCatalog(role);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);


  const entities = useSb<Entity[]>(["gov-entities"], () =>
    supabase
      .from("gov_entities")
      .select("id, name, code, contact_person, phone, notes, active")
      .order("name"),
  );
  const services = useSb<{ entity_id: string | null }[]>(["services-count"], () =>
    supabase.from("transaction_types").select("entity_id"),
  );

  const counts = (services.data ?? []).reduce<Record<string, number>>((acc, s) => {
    if (s.entity_id) acc[s.entity_id] = (acc[s.entity_id] ?? 0) + 1;
    return acc;
  }, {});

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم الجهة مطلوب");
      return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code || null,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      notes: form.notes || null,
      active: form.active,
    };
    const { error } = form.id
      ? await supabase.from("gov_entities").update(payload).eq("id", form.id)
      : await supabase.from("gov_entities").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "تم تحديث الجهة" : "تمت إضافة الجهة");
    setOpen(false);
    setForm(EMPTY);
    invalidate("gov-entities", "services", "types");
  }

  async function remove(e: Entity) {
    const { error } = await supabase.from("gov_entities").delete().eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الجهة");
    invalidate("gov-entities", "services", "types");
  }

  const rows = entities.data ?? [];

  return (
    <>
      <PageHeader
        title="الجهات الحكومية"
        subtitle="سجل الجهات الحكومية التي يتعامل معها المكتب، ثم أضف خدماتها من صفحة الخدمات"
        action={
          canManage ? (
            <Button
              onClick={() => {
                setForm(EMPTY);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> جهة جديدة
            </Button>
          ) : null
        }

      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="عدد الجهات"
          value={String(rows.length)}
          tone="gov"
          icon={<Landmark className="size-4" />}
        />
        <StatCard label="الجهات المفعّلة" value={String(rows.filter((r) => r.active).length)} />
        <StatCard label="إجمالي الخدمات" value={String((services.data ?? []).length)} />
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>اسم الجهة</Th>
            <Th>الرمز</Th>
            <Th>مسؤول التواصل</Th>
            <Th>الهاتف</Th>
            <Th>عدد الخدمات</Th>
            <Th>الحالة</Th>
            {canManage && <Th>إجراءات</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-muted/40">
              <Td className="font-medium">{e.name}</Td>
              <Td className="num">{e.code ?? "—"}</Td>
              <Td>{e.contact_person ?? "—"}</Td>
              <Td className="num">{e.phone ?? "—"}</Td>
              <Td className="num">{counts[e.id] ?? 0}</Td>
              <Td>
                <Badge
                  label={e.active ? "مفعّلة" : "موقوفة"}
                  tone={e.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
                />
              </Td>
              {canManage && (
                <Td>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="تعديل"
                      onClick={() => {
                        setForm({
                          id: e.id,
                          name: e.name,
                          code: e.code ?? "",
                          contact_person: e.contact_person ?? "",
                          phone: e.phone ?? "",
                          notes: e.notes ?? "",
                          active: e.active,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="حذف"
                      onClick={() => void remove(e)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </Td>
              )}

            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لم تُسجَّل أي جهة حكومية بعد." />
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        لإضافة الخدمات ورسومها تحت كل جهة، انتقل إلى{" "}
        <Link to="/services" className="font-medium text-primary hover:underline">
          صفحة الخدمات
        </Link>
        .
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل جهة حكومية" : "جهة حكومية جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>اسم الجهة *</Label>
              <Input
                value={form.name}
                onChange={(ev) => setForm({ ...form, name: ev.target.value })}
                placeholder="مثال: دائرة التنمية الاقتصادية"
              />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input
                dir="ltr"
                value={form.code}
                onChange={(ev) => setForm({ ...form, code: ev.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>مسؤول التواصل</Label>
              <Input
                value={form.contact_person}
                onChange={(ev) => setForm({ ...form, contact_person: ev.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                id="entity-active"
              />
              <Label htmlFor="entity-active">مفعّلة</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
