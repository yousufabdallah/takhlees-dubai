import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { dateAr, localName, money, PAYMENT_METHODS, TRX_STATUS, TRX_STATUS_TONE } from "@/lib/domain";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "المعاملات الحكومية — نظام مكتب التخليص" },
      {
        name: "description",
        content: "تسجيل ومتابعة المعاملات الحكومية مع رقم مرجعي وحالة ورسوم وموظف مسؤول.",
      },
      { property: "og:title", content: "المعاملات الحكومية — نظام مكتب التخليص" },
      { property: "og:description", content: "تسجيل ومتابعة المعاملات الحكومية والرسوم." },
    ],
  }),
  component: TransactionsPage,
});

type Trx = {
  id: string;
  ref_no: string;
  type_name: string;
  type_name_en: string | null;
  gov_entity: string | null;
  gov_entity_en: string | null;
  status: string;
  opened_at: string;
  completed_at: string | null;
  gov_fee: number;
  office_fee: number;
  discount: number;
  vat_rate: number;
  payment_method: string;
  gov_fee_paid: boolean;
  gov_fee_paid_at: string | null;
  clients: { name: string } | null;
  employees: { name: string } | null;
};

type Item = {
  key: string;
  entity_id: string;
  gov_entity: string;
  gov_entity_en: string;
  type_id: string;
  type_name: string;
  type_name_en: string;
  gov_fee: string;
  office_fee: string;
};

const EMPTY = {
  client_id: "",
  employee_id: "",
  status: "new",
  opened_at: new Date().toISOString().slice(0, 10),
  discount: "0",
  vat_rate: "0",
  payment_method: "cash",
  gov_fee_paid: false,
  notes: "",
};

const EMPTY_DRAFT = { entity_id: "", type_id: "" };

function TransactionsPage() {
  const invalidate = useInvalidate();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [items, setItems] = useState<Item[]>([]);
  const [clientOpen, setClientOpen] = useState(false);



  const trx = useSb<Trx[]>(["transactions"], () =>
    supabase
      .from("transactions")
      .select(
        "id, ref_no, type_name, type_name_en, gov_entity, gov_entity_en, status, opened_at, completed_at, gov_fee, office_fee, discount, vat_rate, payment_method, gov_fee_paid, gov_fee_paid_at, clients(name), employees(name)",
      )
      .order("created_at", { ascending: false }),
  );
  const clients = useSb<{ id: string; name: string; phone: string | null }[]>(["clients-min"], () =>
    supabase.from("clients").select("id, name, phone").order("name"),
  );
  const entities = useSb<{ id: string; name: string; name_en: string | null }[]>(["gov-entities-min"], () =>
    supabase
      .from("gov_entities")
      .select("id, name, name_en")
      .eq("active", true)
      .order("name"),
  );
  const types = useSb<
    {
      id: string;
      name: string;
      name_en: string | null;
      gov_entity: string | null;
      entity_id: string | null;
      default_gov_fee: number;
      default_office_fee: number;
    }[]
  >(["types"], () =>
    supabase
      .from("transaction_types")
      .select("id, name, name_en, gov_entity, entity_id, default_gov_fee, default_office_fee")
      .eq("active", true),
  );
  const employees = useSb<{ id: string; name: string }[]>(["employees-min"], () =>
    supabase.from("employees").select("id, name").eq("active", true),
  );

  async function save() {
    if (!form.client_id || items.length === 0) {
      toast.error("العميل وخدمة واحدة على الأقل مطلوبان");
      return;
    }
    const first = items[0]!;
    const extra = items.length - 1;
    const entityNames = Array.from(new Set(items.map((i) => i.gov_entity).filter(Boolean)));
    const entityNamesEn = Array.from(new Set(items.map((i) => i.gov_entity_en).filter(Boolean)));
    const payload = {
      client_id: form.client_id,
      type_id: items.length === 1 ? first.type_id || null : null,
      type_name: extra > 0 ? `${first.type_name} +${extra}` : first.type_name,
      type_name_en: first.type_name_en
        ? extra > 0
          ? `${first.type_name_en} +${extra}`
          : first.type_name_en
        : null,
      gov_entity: entityNames.join(" / ") || null,
      gov_entity_en: entityNamesEn.join(" / ") || null,
      employee_id: form.employee_id || null,
      status: form.status,
      opened_at: form.opened_at,
      gov_fee: totals.gov,
      office_fee: totals.office,
      discount: Number(form.discount),
      vat_rate: Number(form.vat_rate),
      payment_method: form.payment_method,
      gov_fee_paid: form.gov_fee_paid,
      gov_fee_paid_at: form.gov_fee_paid ? form.opened_at : null,
      notes: form.notes || null,
    };
    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: itemsError } = await supabase.from("transaction_items").insert(
      items.map((it, idx) => ({
        transaction_id: data.id,
        entity_id: it.entity_id || null,
        gov_entity: it.gov_entity || null,
        gov_entity_en: it.gov_entity_en || null,
        type_id: it.type_id || null,
        type_name: it.type_name,
        type_name_en: it.type_name_en || null,
        gov_fee: Number(it.gov_fee) || 0,
        office_fee: Number(it.office_fee) || 0,
        sort_order: idx,
      })),
    );
    if (itemsError) {
      toast.error(itemsError.message);
      return;
    }
    toast.success("تم تسجيل المعاملة وإنشاء فاتورتها تلقائياً");
    setOpen(false);
    setForm(EMPTY);
    setDraft(EMPTY_DRAFT);
    setItems([]);
    invalidate("transactions", "invoices", "dash-trx", "dash-inv");
  }


  async function setStatus(t: Trx, status: string) {
    const patch: { status: string; completed_at?: string } = { status };
    if (status === "completed" && !t.completed_at)
      patch.completed_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("transactions").update(patch).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("transactions", "dash-trx");
  }

  async function toggleGovPaid(t: Trx, paid: boolean) {
    const { error } = await supabase
      .from("transactions")
      .update({
        gov_fee_paid: paid,
        gov_fee_paid_at: paid ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("transactions", "gov-fees");
  }

  const rows = (trx.data ?? []).filter((t) => filter === "all" || t.status === filter);
  const govTotal = rows.reduce((s, t) => s + Number(t.gov_fee), 0);
  const officeTotal = rows.reduce((s, t) => s + Number(t.office_fee), 0);
  const govUnpaid = rows
    .filter((t) => !t.gov_fee_paid)
    .reduce((s, t) => s + Number(t.gov_fee), 0);

  function addItem(typeId: string, entityIdOverride?: string) {
    const t = (types.data ?? []).find((x) => x.id === typeId);
    if (!t) return;
    const entityId = t.entity_id ?? entityIdOverride ?? "";
    const entity = (entities.data ?? []).find((e) => e.id === entityId);
    setItems((list) => [
      ...list,
      {
        key: `${typeId}-${Date.now()}-${list.length}`,
        entity_id: entityId,
        gov_entity: entity?.name ?? t.gov_entity ?? "",
        gov_entity_en: entity?.name_en ?? "",
        type_id: t.id,
        type_name: t.name,
        type_name_en: t.name_en ?? "",
        gov_fee: String(t.default_gov_fee),
        office_fee: String(t.default_office_fee),
      },
    ]);
    setDraft({ entity_id: entityId, type_id: "" });
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((list) => list.filter((it) => it.key !== key));
  }


  const availableTypes = useMemo(
    () =>
      (types.data ?? []).filter((t) => !draft.entity_id || t.entity_id === draft.entity_id),
    [types.data, draft.entity_id],
  );
  const totals = useMemo(() => {
    const gov = items.reduce((s, i) => s + (Number(i.gov_fee) || 0), 0);
    const office = items.reduce((s, i) => s + (Number(i.office_fee) || 0), 0);
    const discount = Number(form.discount) || 0;
    const vat = ((office - discount) * (Number(form.vat_rate) || 0)) / 100;
    return { gov, office, total: gov + office - discount + vat };
  }, [items, form.discount, form.vat_rate]);
  const selectedClient = (clients.data ?? []).find((c) => c.id === form.client_id);


  return (
    <>
      <PageHeader
        title="المعاملات الحكومية"
        subtitle="رقم مرجعي لكل معاملة مع فصل الرسوم الحكومية عن أتعاب المكتب"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> معاملة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>تسجيل معاملة</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>العميل * (بحث بالاسم أو رقم الهاتف)</Label>
                  <Popover open={clientOpen} onOpenChange={setClientOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Search className="size-4 shrink-0 opacity-60" />
                          {selectedClient
                            ? `${selectedClient.name}${selectedClient.phone ? ` — ${selectedClient.phone}` : ""}`
                            : "ابحث عن العميل بالاسم أو رقم الهاتف"}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[--radix-popover-trigger-width] p-0"
                    >
                      <Command
                        filter={(value, search) =>
                          value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                        }
                      >
                        <CommandInput placeholder="اكتب الاسم أو رقم الهاتف..." />
                        <CommandList>
                          <CommandEmpty>لا يوجد عميل مطابق.</CommandEmpty>
                          <CommandGroup>
                            {(clients.data ?? []).map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.phone ?? ""}`}
                                onSelect={() => {
                                  setForm((f) => ({ ...f, client_id: c.id }));
                                  setClientOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "size-4",
                                    form.client_id === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="flex-1">{c.name}</span>
                                <span className="num text-xs text-muted-foreground" dir="ltr">
                                  {c.phone ?? "—"}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>الجهة الحكومية</Label>
                  <Select
                    value={draft.entity_id}
                    onValueChange={(v) => setDraft({ entity_id: v, type_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الجهة أولاً" />
                    </SelectTrigger>
                    <SelectContent>
                      {(entities.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {localName(lang, e.name, e.name_en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الخدمة / نوع المعاملة (أضف أكثر من خدمة)</Label>
                  <Select
                    value={draft.type_id}
                    onValueChange={(v) => addItem(v, draft.entity_id)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={draft.entity_id ? "اختر الخدمة" : "كل الخدمات المتاحة"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {localName(lang, t.name, t.name_en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      لا توجد خدمات مسجلة لهذه الجهة.
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>الخدمات المضافة ({items.length})</Label>
                  {items.length === 0 && (
                    <p className="surface p-3 text-xs text-muted-foreground">
                      لم تتم إضافة أي خدمة بعد. اختر الجهة ثم الخدمة لإضافتها.
                    </p>
                  )}
                  {items.map((it) => (
                    <div key={it.key} className="surface grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
                      <div>
                        <div className="text-sm font-medium">
                          {localName(lang, it.type_name, it.type_name_en)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {localName(lang, it.gov_entity, it.gov_entity_en)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">رسوم حكومية</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          className="h-8 w-28"
                          value={it.gov_fee}
                          onChange={(e) => updateItem(it.key, { gov_fee: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">أتعاب المكتب</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          className="h-8 w-28"
                          value={it.office_fee}
                          onChange={(e) => updateItem(it.key, { office_fee: e.target.value })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="self-end"
                        onClick={() => removeItem(it.key)}
                        aria-label="حذف الخدمة"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>الموظف المسؤول</Label>
                  <Select
                    value={form.employee_id}
                    onValueChange={(v) => setForm({ ...form, employee_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الفتح</Label>
                  <Input
                    type="date"
                    value={form.opened_at}
                    onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الحالة</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRX_STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>إجمالي الرسوم الحكومية</Label>
                  <Input readOnly dir="ltr" value={String(totals.gov)} />
                </div>
                <div className="space-y-1.5">
                  <Label>إجمالي أتعاب المكتب</Label>
                  <Input readOnly dir="ltr" value={String(totals.office)} />
                </div>

                <div className="space-y-1.5">
                  <Label>الخصم</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>نسبة الضريبة %</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={form.vat_rate}
                    onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>طريقة الدفع</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="surface flex cursor-pointer items-center justify-between gap-3 p-3 sm:col-span-2">
                  <span className="text-sm">
                    تم دفع الرسوم الحكومية للجهة؟
                    <span className="block text-xs text-muted-foreground">
                      الرسوم الحكومية معزولة عن أتعاب المكتب ولا تدخل في الصندوق أو البنوك.
                    </span>
                  </span>
                  <Switch
                    checked={form.gov_fee_paid}
                    onCheckedChange={(v) => setForm({ ...form, gov_fee_paid: v })}
                  />
                </label>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div className="surface bg-muted/40 p-3 text-sm sm:col-span-2">
                  <div className="flex justify-between">
                    <span>إجمالي المطلوب من العميل</span>
                    <span className="num font-bold">{money(totals.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    منها {money(totals.gov)} رسوم حكومية (أمانات وليست دخلاً للمكتب) و{" "}
                    {money(totals.office)} أتعاب مكتب.
                  </p>
                </div>

              </div>
              <DialogFooter>
                <Button onClick={save}>حفظ المعاملة</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="عدد المعاملات المعروضة" value={String(rows.length)} />
        <StatCard label="رسوم حكومية" value={money(govTotal)} tone="gov" />
        <StatCard
          label="رسوم حكومية غير مدفوعة"
          value={money(govUnpaid)}
          tone={govUnpaid > 0 ? "destructive" : "success"}
        />
        <StatCard label="أتعاب المكتب" value={money(officeTotal)} tone="success" />
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(TRX_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>الرقم المرجعي</Th>
            <Th>العميل</Th>
            <Th>النوع / الجهة</Th>
            <Th>الموظف</Th>
            <Th>الفتح / الإنجاز</Th>
            <Th>حكومية</Th>
            <Th>دفع الرسوم</Th>
            <Th>المكتب</Th>
            <Th>الحالة</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-muted/40">
              <Td className="num font-medium">{t.ref_no}</Td>
              <Td>{t.clients?.name ?? "—"}</Td>
              <Td>
                <div>{localName(lang, t.type_name, t.type_name_en)}</div>
                <div className="text-xs text-muted-foreground">
                  {localName(lang, t.gov_entity, t.gov_entity_en)}
                </div>
              </Td>
              <Td>{t.employees?.name ?? "—"}</Td>
              <Td className="num text-xs">
                {dateAr(t.opened_at)} / {t.completed_at ? dateAr(t.completed_at) : "—"}
              </Td>
              <Td className="num">{money(t.gov_fee)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={t.gov_fee_paid}
                    onCheckedChange={(v) => toggleGovPaid(t, v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t.gov_fee_paid
                      ? t.gov_fee_paid_at
                        ? dateAr(t.gov_fee_paid_at)
                        : "مدفوعة"
                      : "غير مدفوعة"}
                  </span>
                </div>
              </Td>
              <Td className="num">{money(t.office_fee)}</Td>
              <Td>
                <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRX_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="sr-only">
                  <Badge label={TRX_STATUS[t.status] ?? ""} tone={TRX_STATUS_TONE[t.status]} />
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد معاملات." />
        </div>
      )}
    </>
  );
}
