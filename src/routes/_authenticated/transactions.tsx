import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyClient, logWhatsapp } from "@/lib/notifications.functions";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { dateAr, localName, money, PAYMENT_METHODS, TRX_STATUS } from "@/lib/domain";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { canDeleteTransaction, canEditTransaction } from "@/lib/permissions";
import {
  isFinalStatus,
  statusLabel,
  statusOptions,
  type ServiceStatus,
} from "@/lib/service-statuses";

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
  client_id: string;
  employee_id: string | null;
  type_name: string;
  type_name_en: string | null;
  gov_entity: string | null;
  gov_entity_en: string | null;
  type_id: string | null;
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
  clients: { name: string; email: string | null; phone: string | null } | null;
  employees: { name: string } | null;
  notes: string | null;
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
  qty: string;
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

/** ما سيتأثر بحذف المعاملة — يُحمَّل عند فتح نافذة التأكيد */
type DeleteInfo = {
  invoiceNo: string | null;
  paymentsCount: number;
  itemsCount: number;
  docPaths: string[];
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * التعديل الذري للمعاملة وخدماتها (migration 20260923120000).
 * types.ts المولَّد لا يتضمن الدالة بعد؛ سيعيد Lovable توليده بعد تطبيق الـ migration.
 */
type EditTransactionRpc = {
  rpc: (
    fn: "update_transaction_with_items",
    args: { p_id: string; p_patch: Record<string, unknown>; p_items: Record<string, unknown>[] },
  ) => PromiseLike<{ error: { message: string } | null }>;
};

/** كل ما يعرض بيانات المعاملات أو فواتيرها في الصفحات الأخرى */
const TRX_RELATED_KEYS = [
  "transactions",
  "invoices",
  "invoice",
  "trx-items",
  "client-trx",
  "client-inv",
  "trx-by-emp",
  "dash-trx",
  "dash-inv",
  "rep-trx",
  "rep-inv",
  "gov-fees",
  "invoices-gov",
];

function TransactionsPage() {
  const invalidate = useInvalidate();
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const { role } = useRole();
  const canEdit = canEditTransaction(role);
  const canDelete = canDeleteTransaction(role);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [items, setItems] = useState<Item[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Trx | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editPaid, setEditPaid] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Trx | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);
  const [deleteInfoError, setDeleteInfoError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // يمنع وصول ردّ طلب قديم (معاملة أخرى أو نافذة أُغلقت) إلى النافذة الحالية
  const editRequest = useRef(0);
  const deleteRequest = useRef(0);
  const notify = useServerFn(notifyClient);
  const logWa = useServerFn(logWhatsapp);

  const trx = useSb<Trx[]>(["transactions"], () =>
    supabase
      .from("transactions")
      .select(
        "id, ref_no, client_id, employee_id, type_id, type_name, type_name_en, gov_entity, gov_entity_en, status, opened_at, completed_at, gov_fee, office_fee, discount, vat_rate, payment_method, gov_fee_paid, gov_fee_paid_at, notes, clients(name, email, phone), employees(name)",
      )
      .order("created_at", { ascending: false }),
  );
  const clients = useSb<{ id: string; name: string; phone: string | null }[]>(["clients-min"], () =>
    supabase.from("clients").select("id, name, phone").order("name"),
  );
  const entities = useSb<{ id: string; name: string; name_en: string | null }[]>(
    ["gov-entities-min"],
    () =>
      supabase.from("gov_entities").select("id, name, name_en").eq("active", true).order("name"),
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
  const serviceStatuses = useSb<ServiceStatus[]>(["service-statuses"], () =>
    supabase
      .from("service_statuses")
      .select("id, type_id, name, name_en, color, sort_order, is_final")
      .order("sort_order"),
  );
  const statusList = serviceStatuses.data ?? [];

  function resetForm() {
    setForm(EMPTY);
    setDraft(EMPTY_DRAFT);
    setItems([]);
    setEditing(null);
    setEditPaid(0);
  }

  function handleOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بمعاملة جديدة
    if (!next && editing) {
      editRequest.current++;
      setLoadingEdit(false);
      resetForm();
    }
  }

  async function openEdit(t: Trx) {
    const request = ++editRequest.current;
    resetForm();
    setEditing(t);
    setLoadingEdit(true);
    setOpen(true);
    const [itemsRes, invRes] = await Promise.all([
      supabase
        .from("transaction_items")
        .select(
          "id, entity_id, gov_entity, gov_entity_en, type_id, type_name, type_name_en, gov_fee, office_fee, qty",
        )
        .eq("transaction_id", t.id)
        .order("sort_order"),
      supabase.from("invoices").select("paid").eq("transaction_id", t.id).maybeSingle(),
    ]);
    if (request !== editRequest.current) return;
    if (itemsRes.error || invRes.error) {
      toast.error(itemsRes.error?.message ?? invRes.error?.message ?? "");
      setLoadingEdit(false);
      setOpen(false);
      resetForm();
      return;
    }
    const loaded: Item[] = (itemsRes.data ?? []).map((it) => ({
      key: it.id,
      entity_id: it.entity_id ?? "",
      gov_entity: it.gov_entity ?? "",
      gov_entity_en: it.gov_entity_en ?? "",
      type_id: it.type_id ?? "",
      type_name: it.type_name,
      type_name_en: it.type_name_en ?? "",
      gov_fee: String(it.gov_fee),
      office_fee: String(it.office_fee),
      qty: String(it.qty ?? 1),
    }));
    // معاملات قديمة سُجّلت قبل جدول الخدمات: تُعرض كخدمة واحدة من بيانات المعاملة نفسها
    if (loaded.length === 0) {
      loaded.push({
        key: `legacy-${t.id}`,
        entity_id: "",
        gov_entity: t.gov_entity ?? "",
        gov_entity_en: t.gov_entity_en ?? "",
        type_id: t.type_id ?? "",
        type_name: t.type_name,
        type_name_en: t.type_name_en ?? "",
        gov_fee: String(t.gov_fee),
        office_fee: String(t.office_fee),
        qty: "1",
      });
    }
    setEditPaid(Number(invRes.data?.paid ?? 0));
    setItems(loaded);
    setForm({
      client_id: t.client_id,
      employee_id: t.employee_id ?? "",
      status: t.status,
      opened_at: t.opened_at,
      discount: String(t.discount),
      vat_rate: String(t.vat_rate),
      payment_method: t.payment_method,
      gov_fee_paid: t.gov_fee_paid,
      notes: t.notes ?? "",
    });
    setLoadingEdit(false);
  }

  function itemRows(transactionId: string) {
    return items.map((it, idx) => ({
      transaction_id: transactionId,
      entity_id: it.entity_id || null,
      gov_entity: it.gov_entity || null,
      gov_entity_en: it.gov_entity_en || null,
      type_id: it.type_id || null,
      type_name: it.type_name,
      type_name_en: it.type_name_en || null,
      gov_fee: Number(it.gov_fee) || 0,
      office_fee: Number(it.office_fee) || 0,
      qty: Math.max(1, Number(it.qty) || 1),
      sort_order: idx,
    }));
  }

  async function save() {
    if (!form.client_id || items.length === 0) {
      toast.error(
        tr("العميل وخدمة واحدة على الأقل مطلوبان", "Client and at least one service are required"),
      );
      return;
    }
    const amounts = [
      form.discount,
      form.vat_rate,
      ...items.flatMap((i) => [i.gov_fee, i.office_fee]),
    ].map(Number);
    if (amounts.some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error(
        tr(
          "الرسوم والخصم ونسبة الضريبة يجب أن تكون أرقاماً غير سالبة",
          "Fees, discount and VAT rate must be non-negative numbers",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      if (editing) await saveEdit(editing);
      else await saveNew();
    } finally {
      setSaving(false);
    }
  }

  function buildPayload() {
    const first = items[0]!;
    const extra = items.length - 1;
    const entityNames = Array.from(new Set(items.map((i) => i.gov_entity).filter(Boolean)));
    const entityNamesEn = Array.from(new Set(items.map((i) => i.gov_entity_en).filter(Boolean)));
    return {
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
  }

  async function saveNew() {
    const payload = buildPayload();
    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: itemsError } = await supabase
      .from("transaction_items")
      .insert(itemRows(data.id));
    if (itemsError) {
      toast.error(itemsError.message);
      return;
    }
    toast.success("تم تسجيل المعاملة وإنشاء فاتورتها تلقائياً");
    void sendNotice(data.id, "created", "");
    setOpen(false);
    resetForm();
    invalidate("transactions", "invoices", "dash-trx", "dash-inv");
  }

  async function saveEdit(t: Trx) {
    // الفاتورة تتبع المعاملة تلقائياً (trigger)، فلا نسمح بإجمالي أقل من المبالغ المحصّلة فعلاً
    if (editPaid > 0 && totals.total + 0.005 < editPaid) {
      toast.error(
        tr(
          `لا يمكن أن يقل إجمالي المعاملة عن المبلغ المحصّل (${money(editPaid)}). عدّل الدفعات من الفاتورة أولاً.`,
          `Total cannot be less than the amount already collected (${money(editPaid)}). Adjust the invoice payments first.`,
        ),
      );
      return;
    }
    const base = buildPayload();
    const statusChanged = form.status !== t.status;
    const payload = {
      ...base,
      // الإبقاء على تاريخ دفع الرسوم الأصلي إن لم تتغير الحالة
      gov_fee_paid_at: form.gov_fee_paid ? (t.gov_fee_paid ? t.gov_fee_paid_at : today()) : null,
      ...(isFinalStatus(form.status, statusList) && !t.completed_at
        ? { completed_at: today() }
        : {}),
    };
    // تحديث المعاملة واستبدال خدماتها في عملية واحدة: إما أن ينجح كل شيء أو لا يتغير شيء.
    // قاعدة البيانات تتحقق أيضاً من الصلاحية ومن عدم خفض الإجمالي عن المبلغ المحصّل.
    const { error } = await (supabase as unknown as EditTransactionRpc).rpc(
      "update_transaction_with_items",
      { p_id: t.id, p_patch: payload, p_items: itemRows(t.id) },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("تم تحديث المعاملة وفاتورتها", "Transaction and its invoice were updated"));
    if (statusChanged)
      void sendNotice(t.id, "status", statusLabel(form.status, statusList, lang).label);
    setOpen(false);
    resetForm();
    invalidate(...TRX_RELATED_KEYS);
  }

  async function askDelete(t: Trx) {
    const request = ++deleteRequest.current;
    setDeleteTarget(t);
    setDeleteInfo(null);
    setDeleteInfoError(null);
    const [invRes, itemsRes, docsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_no, payments(id)")
        .eq("transaction_id", t.id)
        .maybeSingle(),
      supabase
        .from("transaction_items")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", t.id),
      supabase.from("documents").select("file_path").eq("transaction_id", t.id),
    ]);
    if (request !== deleteRequest.current) return;
    const err = invRes.error ?? itemsRes.error ?? docsRes.error;
    if (err) {
      setDeleteInfoError(err.message);
      return;
    }
    setDeleteInfo({
      invoiceNo: invRes.data?.invoice_no ?? null,
      paymentsCount: invRes.data?.payments?.length ?? 0,
      itemsCount: itemsRes.count ?? 0,
      docPaths: (docsRes.data ?? []).map((d) => d.file_path),
    });
  }

  async function confirmDelete() {
    if (!deleteTarget || !deleteInfo || deleteInfo.paymentsCount > 0) return;
    setDeleting(true);
    try {
      // الحذف يشمل تلقائياً (cascade): الفاتورة، الخدمات، سجلات المستندات.
      // سجل الإشعارات يبقى للمراجعة (transaction_id يصبح فارغاً).
      const { data, error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", deleteTarget.id)
        .select("id");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error(
          tr("لا تملك صلاحية حذف المعاملات", "You are not allowed to delete transactions"),
        );
        return;
      }
      if (deleteInfo.docPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove(deleteInfo.docPaths);
        if (storageError)
          toast.warning(
            tr(
              "حُذفت المعاملة لكن تعذّر حذف بعض ملفات المستندات من التخزين",
              "Transaction deleted, but some document files could not be removed from storage",
            ),
          );
      }
      toast.success(
        tr(`تم حذف المعاملة ${deleteTarget.ref_no}`, `Transaction ${deleteTarget.ref_no} deleted`),
      );
      setDeleteTarget(null);
      setDeleteInfo(null);
      invalidate(...TRX_RELATED_KEYS, "notification-log");
    } finally {
      setDeleting(false);
    }
  }

  async function setStatus(t: Trx, status: string) {
    const patch: { status: string; completed_at?: string } = { status };
    if (isFinalStatus(status, statusList) && !t.completed_at)
      patch.completed_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("transactions").update(patch).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("transactions", "dash-trx");
    void sendNotice(t.id, "status", statusLabel(status, statusList, lang).label);
  }

  async function sendNotice(id: string, kind: "created" | "status", statusText: string) {
    try {
      const res = await notify({ data: { transactionId: id, kind, statusText } });
      if (res.sent) toast.success(`تم إرسال إشعار بريدي إلى ${res.to}`);
      else if (res.reason === "no_email")
        toast.info("لا يوجد بريد مسجّل لهذا العميل — لم يُرسل إشعار");
      else if (res.reason === "error") toast.error(`تعذّر إرسال الإشعار: ${res.error ?? ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إرسال الإشعار");
    }
    invalidate("notification-log");
  }

  function waLink(t: Trx, statusText: string) {
    const phone = (t.clients?.phone ?? "").replace(/[^0-9]/g, "");
    const text = statusText
      ? `عزيزنا ${t.clients?.name ?? ""}، تم تحديث حالة معاملتكم ${t.type_name} (رقم ${t.ref_no}) إلى: ${statusText}.`
      : `عزيزنا ${t.clients?.name ?? ""}، تم تسجيل معاملتكم ${t.type_name} برقم مرجعي ${t.ref_no}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  function openWhatsapp(t: Trx) {
    const phone = (t.clients?.phone ?? "").replace(/[^0-9]/g, "");
    if (!phone) {
      toast.error("لا يوجد رقم هاتف مسجّل لهذا العميل");
      return;
    }
    const label = statusLabel(t.status, statusList, lang).label;
    window.open(waLink(t, label), "_blank", "noopener");
    void logWa({ data: { transactionId: t.id, kind: "status", recipient: phone } })
      .then(() => invalidate("notification-log"))
      .catch(() => {});
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
  const govUnpaid = rows.filter((t) => !t.gov_fee_paid).reduce((s, t) => s + Number(t.gov_fee), 0);

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
        qty: "1",
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
    () => (types.data ?? []).filter((t) => !draft.entity_id || t.entity_id === draft.entity_id),
    [types.data, draft.entity_id],
  );
  const totals = useMemo(() => {
    const q = (i: Item) => Math.max(1, Number(i.qty) || 1);
    const gov = items.reduce((s, i) => s + (Number(i.gov_fee) || 0) * q(i), 0);
    const office = items.reduce((s, i) => s + (Number(i.office_fee) || 0) * q(i), 0);
    const discount = Number(form.discount) || 0;
    const vat = ((office - discount) * (Number(form.vat_rate) || 0)) / 100;
    return { gov, office, total: gov + office - discount + vat };
  }, [items, form.discount, form.vat_rate]);
  const selectedClient = (clients.data ?? []).find((c) => c.id === form.client_id);
  const formTypeId = items.length === 1 ? items[0]!.type_id || null : null;
  const formStatusOptions = useMemo(
    () => statusOptions(formTypeId, statusList, lang),
    [formTypeId, statusList, lang],
  );
  useEffect(() => {
    // لا نعيد ضبط الحالة قبل تحميل حالات الخدمات، وإلا ضاعت الحالة الخاصة للمعاملة عند التعديل
    if (loadingEdit || serviceStatuses.isLoading || formStatusOptions.length === 0) return;
    if (!formStatusOptions.some((o) => o.value === form.status))
      setForm((f) => ({ ...f, status: formStatusOptions[0]!.value }));
  }, [formStatusOptions, form.status, loadingEdit, serviceStatuses.isLoading]);

  return (
    <>
      <PageHeader
        title="المعاملات الحكومية"
        subtitle="رقم مرجعي لكل معاملة مع فصل الرسوم الحكومية عن أتعاب المكتب"
        action={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> معاملة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? tr(`تعديل المعاملة ${editing.ref_no}`, `Edit transaction ${editing.ref_no}`)
                    : "تسجيل معاملة"}
                </DialogTitle>
              </DialogHeader>
              {loadingEdit ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {tr("جارٍ تحميل بيانات المعاملة…", "Loading transaction…")}
                </div>
              ) : (
                <>
                  {editing && editPaid > 0 && (
                    <p className="surface bg-warning/10 p-3 text-xs text-warning-foreground">
                      {tr(
                        `على فاتورة هذه المعاملة دفعات بقيمة ${money(editPaid)}؛ لا يمكن تغيير العميل ولا خفض الإجمالي عن هذا المبلغ.`,
                        `This transaction's invoice has payments of ${money(editPaid)}; the client can't be changed and the total can't go below this amount.`,
                      )}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>العميل * (بحث بالاسم أو رقم الهاتف)</Label>
                      <Popover open={clientOpen} onOpenChange={setClientOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientOpen}
                            disabled={!!editing && editPaid > 0}
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
                        <div
                          key={it.key}
                          className="surface grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {localName(lang, it.type_name, it.type_name_en)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {localName(lang, it.gov_entity, it.gov_entity_en)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{lang === "en" ? "QTY" : "العدد"}</Label>
                            <Input
                              type="number"
                              min={1}
                              dir="ltr"
                              className="h-8 w-20"
                              value={it.qty}
                              onChange={(e) => updateItem(it.key, { qty: e.target.value })}
                            />
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
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formStatusOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
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
                    {editing && (
                      <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={saving}
                      >
                        {tr("إلغاء", "Cancel")}
                      </Button>
                    )}
                    <Button onClick={save} disabled={saving}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {editing ? tr("حفظ التعديلات", "Save changes") : "حفظ المعاملة"}
                    </Button>
                  </DialogFooter>
                </>
              )}
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
            {statusList.map((s) => (
              <SelectItem key={s.id} value={`cs:${s.id}`}>
                {(lang === "en" && s.name_en) || s.name}
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
            <Th>إشعار</Th>
            {(canEdit || canDelete) && <Th>{tr("إجراءات", "Actions")}</Th>}
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
                  <Switch checked={t.gov_fee_paid} onCheckedChange={(v) => toggleGovPaid(t, v)} />
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
                    <SelectValue>{statusLabel(t.status, statusList, lang).label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions(t.type_id, statusList, lang).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="sr-only">
                  <Badge {...statusLabel(t.status, statusList, lang)} />
                </span>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() => openWhatsapp(t)}
                  >
                    <MessageCircle className="size-4" /> واتساب
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() =>
                      sendNotice(t.id, "status", statusLabel(t.status, statusList, lang).label)
                    }
                  >
                    <Mail className="size-4" />
                  </Button>
                </div>
              </Td>
              {(canEdit || canDelete) && (
                <Td>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => void openEdit(t)}
                        aria-label={tr("تعديل المعاملة", "Edit transaction")}
                        title={tr("تعديل", "Edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => void askDelete(t)}
                        aria-label={tr("حذف المعاملة", "Delete transaction")}
                        title={tr("حذف", "Delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          {trx.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr("جارٍ تحميل المعاملات…", "Loading transactions…")}
            </div>
          ) : trx.error ? (
            <EmptyState
              text={tr(
                `تعذّر تحميل المعاملات: ${trx.error.message}`,
                `Could not load transactions: ${trx.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا توجد معاملات." />
          )}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v && !deleting) {
            deleteRequest.current++;
            setDeleteTarget(null);
            setDeleteInfo(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr(
                `حذف المعاملة ${deleteTarget?.ref_no ?? ""}؟`,
                `Delete transaction ${deleteTarget?.ref_no ?? ""}?`,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {tr("العميل:", "Client:")} {deleteTarget?.clients?.name ?? "—"} —{" "}
                  {deleteTarget
                    ? localName(lang, deleteTarget.type_name, deleteTarget.type_name_en)
                    : ""}
                </p>
                {deleteInfoError ? (
                  <p className="text-destructive">{deleteInfoError}</p>
                ) : !deleteInfo ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {tr("جارٍ فحص البيانات المرتبطة…", "Checking related records…")}
                  </p>
                ) : deleteInfo.paymentsCount > 0 ? (
                  <p className="surface bg-destructive/10 p-3 text-destructive">
                    {tr(
                      `لا يمكن الحذف: على الفاتورة ${deleteInfo.invoiceNo ?? ""} عدد ${deleteInfo.paymentsCount} دفعة مسجلة في الخزينة. احذف الدفعات أو عالجها من صفحة الفاتورة أولاً، أو غيّر حالة المعاملة إلى "ملغاة".`,
                      `Cannot delete: invoice ${deleteInfo.invoiceNo ?? ""} has ${deleteInfo.paymentsCount} recorded payment(s) in the treasury. Remove or handle them from the invoice page first, or set the transaction status to "Cancelled".`,
                    )}
                  </p>
                ) : (
                  <>
                    <p>
                      {tr("سيتم حذف ما يلي نهائياً:", "The following will be permanently deleted:")}
                    </p>
                    <ul className="list-disc space-y-1 ps-5">
                      {deleteInfo.invoiceNo && (
                        <li>
                          {tr("الفاتورة", "Invoice")}{" "}
                          <span className="num">{deleteInfo.invoiceNo}</span>
                        </li>
                      )}
                      <li>
                        {tr(
                          `الخدمات المسجلة (${deleteInfo.itemsCount})`,
                          `Service lines (${deleteInfo.itemsCount})`,
                        )}
                      </li>
                      {deleteInfo.docPaths.length > 0 && (
                        <li>
                          {tr(
                            `المستندات المرفقة (${deleteInfo.docPaths.length})`,
                            `Attached documents (${deleteInfo.docPaths.length})`,
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
              disabled={deleting || !deleteInfo || deleteInfo.paymentsCount > 0}
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
    </>
  );
}
