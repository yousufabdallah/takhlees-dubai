import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { useRole } from "@/hooks/useRole";
import { canManageCatalog } from "@/lib/permissions";

import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { localName, money } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import {
  STATUS_COLORS,
  colorTone,
  type ServiceStatus,
} from "@/lib/service-statuses";


export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "الخدمات والرسوم — نظام مكتب التخليص" },
      {
        name: "description",
        content: "إضافة خدمات كل جهة حكومية مع تحديد الرسوم الحكومية ورسوم المكتب لكل خدمة.",
      },
      { property: "og:title", content: "الخدمات والرسوم — نظام مكتب التخليص" },
      { property: "og:description", content: "خدمات الجهات الحكومية ورسومها." },
    ],
  }),
  component: ServicesPage,
});

type Service = {
  id: string;
  name: string;
  name_en: string | null;
  gov_entity: string | null;
  entity_id: string | null;
  default_gov_fee: number;
  default_office_fee: number;
  active: boolean;
};

type Entity = { id: string; name: string; name_en: string | null; active: boolean };

const EMPTY = {
  id: "",
  name: "",
  name_en: "",
  entity_id: "",
  default_gov_fee: "0",
  default_office_fee: "0",
  active: true,
};

function ServicesPage() {
  const invalidate = useInvalidate();
  const { lang } = useI18n();
  const { role } = useRole();
  const canManage = canManageCatalog(role);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("all");
  const [statusFor, setStatusFor] = useState<Service | null>(null);


  const entities = useSb<Entity[]>(["gov-entities"], () =>
    supabase.from("gov_entities").select("id, name, name_en, active").order("name"),
  );
  const services = useSb<Service[]>(["services"], () =>
    supabase
      .from("transaction_types")
      .select("id, name, name_en, gov_entity, entity_id, default_gov_fee, default_office_fee, active")
      .order("name"),
  );
  const statuses = useSb<ServiceStatus[]>(["service-statuses"], () =>
    supabase
      .from("service_statuses")
      .select("id, type_id, name, name_en, color, sort_order, is_final")
      .order("sort_order"),
  );
  const statusCounts = (statuses.data ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.type_id] = (acc[s.type_id] ?? 0) + 1;
    return acc;
  }, {});



  const entityList = entities.data ?? [];
  const all = services.data ?? [];
  const rows = all.filter((s) => filter === "all" || s.entity_id === filter);

  const groups = entityList
    .map((e) => ({ entity: e, items: rows.filter((s) => s.entity_id === e.id) }))
    .filter((g) => filter === "all" || g.entity.id === filter);
  const orphans = rows.filter((s) => !s.entity_id);

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم الخدمة مطلوب");
      return;
    }
    if (!form.entity_id) {
      toast.error("اختر الجهة الحكومية");
      return;
    }
    const entity = entityList.find((e) => e.id === form.entity_id);
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      entity_id: form.entity_id,
      gov_entity: entity?.name ?? null,
      default_gov_fee: Number(form.default_gov_fee),
      default_office_fee: Number(form.default_office_fee),
      active: form.active,
    };
    const { error } = form.id
      ? await supabase.from("transaction_types").update(payload).eq("id", form.id)
      : await supabase.from("transaction_types").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "تم تحديث الخدمة" : "تمت إضافة الخدمة");
    setOpen(false);
    setForm(EMPTY);
    invalidate("services", "services-count", "types");
  }

  async function remove(s: Service) {
    const { error } = await supabase.from("transaction_types").delete().eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الخدمة");
    invalidate("services", "services-count", "types");
  }

  function edit(s: Service) {
    setForm({
      id: s.id,
      name: s.name,
      name_en: s.name_en ?? "",
      entity_id: s.entity_id ?? "",
      default_gov_fee: String(s.default_gov_fee),
      default_office_fee: String(s.default_office_fee),
      active: s.active,
    });
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="الخدمات والرسوم"
        subtitle="تحت كل جهة حكومية مجموعة خدمات، لكل خدمة رسوم حكومية ورسوم مكتب"
        action={
          canManage ? (
            <Button
              onClick={() => {
                setForm(EMPTY);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> خدمة جديدة
            </Button>
          ) : null
        }

      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد الخدمات" value={String(rows.length)} />
        <StatCard
          label="متوسط الرسوم الحكومية"
          value={money(avg(rows.map((s) => Number(s.default_gov_fee))))}
          tone="gov"
        />
        <StatCard
          label="متوسط رسوم المكتب"
          value={money(avg(rows.map((s) => Number(s.default_office_fee))))}
          tone="success"
        />
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الجهات</SelectItem>
            {entityList.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {localName(lang, e.name, e.name_en)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entityList.length === 0 && (
        <div className="surface p-6 text-sm text-muted-foreground">
          سجّل الجهات الحكومية أولاً من{" "}
          <Link to="/gov-entities" className="font-medium text-primary hover:underline">
            صفحة الجهات الحكومية
          </Link>
          .
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.entity.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-bold" dir={lang === "en" ? "ltr" : "rtl"}>
                {localName(lang, g.entity.name, g.entity.name_en)}
              </h2>
              <span className="text-xs text-muted-foreground">{g.items.length} خدمة</span>
            </div>
            <ServiceTable
              lang={lang}
              items={g.items}
              canManage={canManage}
              statusCounts={statusCounts}
              onEdit={edit}
              onDelete={(s) => void remove(s)}
              onStatuses={setStatusFor}
            />
          </section>
        ))}

        {orphans.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">خدمات بدون جهة</h2>
            <ServiceTable
              lang={lang}
              items={orphans}
              canManage={canManage}
              statusCounts={statusCounts}
              onEdit={edit}
              onDelete={(s) => void remove(s)}
              onStatuses={setStatusFor}
            />

          </section>
        )}

      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل خدمة" : "خدمة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الجهة الحكومية *</Label>
              <Select
                value={form.entity_id}
                onValueChange={(v) => setForm({ ...form, entity_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الجهة" />
                </SelectTrigger>
                <SelectContent>
                  {entityList.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {localName(lang, e.name, e.name_en)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>اسم الخدمة *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: تجديد رخصة تجارية"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>اسم الخدمة بالإنجليزية</Label>
              <Input
                dir="ltr"
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                placeholder="e.g. Trade License Renewal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>الرسوم الحكومية</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.default_gov_fee}
                onChange={(e) => setForm({ ...form, default_gov_fee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>رسوم المكتب</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.default_office_fee}
                onChange={(e) => setForm({ ...form, default_office_fee: e.target.value })}
              />
            </div>
            <div className="surface bg-muted/40 p-3 text-sm sm:col-span-2">
              <div className="flex justify-between">
                <span>إجمالي ما يدفعه العميل للخدمة</span>
                <span className="num font-bold">
                  {money(Number(form.default_gov_fee) + Number(form.default_office_fee))}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="service-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label htmlFor="service-active">مفعّلة</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StatusesDialog
        service={statusFor}
        lang={lang}
        canManage={canManage}
        statuses={statuses.data ?? []}
        onClose={() => setStatusFor(null)}
        onChanged={() => invalidate("service-statuses")}
      />
    </>

  );
}

function ServiceTable({
  lang,
  items,
  canManage,
  statusCounts,
  onEdit,
  onDelete,
  onStatuses,
}: {
  lang: "ar" | "en";
  items: Service[];
  canManage: boolean;
  statusCounts: Record<string, number>;
  onEdit: (s: Service) => void;
  onDelete: (s: Service) => void;
  onStatuses: (s: Service) => void;
}) {

  if (items.length === 0)
    return (
      <div className="surface">
        <EmptyState text="لا توجد خدمات مسجلة لهذه الجهة." />
      </div>
    );
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>الخدمة</Th>
          <Th>الرسوم الحكومية</Th>
          <Th>رسوم المكتب</Th>
          <Th>الإجمالي</Th>
          <Th>حالات الخدمة</Th>
          <Th>الحالة</Th>
          {canManage && <Th>إجراءات</Th>}
        </tr>
      </thead>
      <tbody>
        {items.map((s) => (
          <tr key={s.id} className="hover:bg-muted/40">
            <Td className="font-medium">
              <div dir={lang === "en" ? "ltr" : "rtl"}>{localName(lang, s.name, s.name_en)}</div>
            </Td>
            <Td className="num">{money(s.default_gov_fee)}</Td>
            <Td className="num">{money(s.default_office_fee)}</Td>
            <Td className="num font-semibold">
              {money(Number(s.default_gov_fee) + Number(s.default_office_fee))}
            </Td>
            <Td>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => onStatuses(s)}
              >
                <ListChecks className="size-4" />
                {statusCounts[s.id] ? `${statusCounts[s.id]} حالة` : "الحالات الافتراضية"}
              </Button>
            </Td>
            <Td>
              <Badge
                label={s.active ? "مفعّلة" : "موقوفة"}
                tone={s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
              />
            </Td>
            {canManage && (
              <Td>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => onEdit(s)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => onDelete(s)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </Td>
            )}

          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function StatusesDialog({
  service,
  lang,
  canManage,
  statuses,
  onClose,
  onChanged,
}: {
  service: Service | null;
  lang: "ar" | "en";
  canManage: boolean;
  statuses: ServiceStatus[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [color, setColor] = useState("muted");
  const [isFinal, setIsFinal] = useState(false);
  const list = service ? statuses.filter((s) => s.type_id === service.id) : [];

  async function add() {
    if (!service) return;
    if (!name.trim()) {
      toast.error("اسم الحالة مطلوب");
      return;
    }
    const { error } = await supabase.from("service_statuses").insert({
      type_id: service.id,
      name: name.trim(),
      name_en: nameEn.trim() || null,
      color,
      is_final: isFinal,
      sort_order: list.length,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setNameEn("");
    setColor("muted");
    setIsFinal(false);
    toast.success("تمت إضافة الحالة");
    onChanged();
  }

  async function removeStatus(id: string) {
    const { error } = await supabase.from("service_statuses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الحالة");
    onChanged();
  }

  async function move(s: ServiceStatus, dir: -1 | 1) {
    const sorted = list.slice().sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const other = sorted[idx + dir];
    if (!other) return;
    await supabase.from("service_statuses").update({ sort_order: other.sort_order }).eq("id", s.id);
    await supabase
      .from("service_statuses")
      .update({ sort_order: s.sort_order })
      .eq("id", other.id);
    onChanged();
  }

  return (
    <Dialog open={!!service} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            حالات الخدمة: {service ? localName(lang, service.name, service.name_en) : ""}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          حدّد مراحل إجراءات هذه الخدمة بالترتيب. إذا لم تُضِف أي حالة، تُستخدم الحالات الافتراضية
          للنظام.
        </p>

        <div className="space-y-2">
          {list
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s, i) => (
              <div
                key={s.id}
                className="surface flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="num text-xs text-muted-foreground">{i + 1}</span>
                  <Badge label={(lang === "en" && s.name_en) || s.name} tone={colorTone(s.color)} />
                  {s.is_final && (
                    <span className="text-xs text-success">حالة نهائية (إنهاء المعاملة)</span>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => void move(s, -1)}>
                      ↑
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void move(s, 1)}>
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="حذف"
                      onClick={() => void removeStatus(s.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          {list.length === 0 && <EmptyState text="لا توجد حالات مخصصة لهذه الخدمة." />}
        </div>

        {canManage && (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>اسم الحالة *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: بانتظار التوقيع"
              />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم بالإنجليزية</Label>
              <Input
                dir="ltr"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Awaiting signature"
              />
            </div>
            <div className="space-y-1.5">
              <Label>اللون</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="status-final" checked={isFinal} onCheckedChange={setIsFinal} />
              <Label htmlFor="status-final">حالة نهائية (تُعتبر المعاملة مكتملة)</Label>
            </div>
          </div>
        )}

        <DialogFooter>
          {canManage && (
            <Button onClick={add}>
              <Plus className="size-4" /> إضافة حالة
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
