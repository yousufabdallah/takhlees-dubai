import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { dateAr, EXPENSE_CATEGORIES, money, PAYMENT_METHODS } from "@/lib/domain";
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
import { ConfirmDeleteDialog, type DeleteCheck } from "@/components/ConfirmDeleteDialog";
import { useI18n } from "@/lib/i18n";
import { useRole } from "@/hooks/useRole";
import { canDeleteStaffOrSupplier } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "المصروفات والموردين — نظام مكتب التخليص" },
      {
        name: "description",
        content: "تسجيل مصروفات المكتب حسب البند مع الموردين وطرق الدفع وحساب الصرف.",
      },
      { property: "og:title", content: "المصروفات والموردين — نظام مكتب التخليص" },
      { property: "og:description", content: "مصروفات المكتب والموردين." },
    ],
  }),
  component: ExpensesPage,
});

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_method: string;
  account_id: string | null;
  supplier_id: string | null;
  employee_id: string | null;
  accounts: { name: string } | null;
  suppliers: { name: string } | null;
  employees: { name: string } | null;
};

/** المصروف يدخل مباشرة في أرصدة الخزينة ولوحة التحكم والتقارير */
const EXPENSE_RELATED_KEYS = ["expenses", "expenses-all", "accounts", "dash-exp", "rep-exp"];

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  balance: number;
};

const EMPTY_SUPPLIER = { name: "", phone: "", category: "" };

const EMPTY = {
  category: "other",
  description: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  payment_method: "cash",
  account_id: "",
  supplier_id: "",
  employee_id: "",
};

function ExpensesPage() {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [supplier, setSupplier] = useState(EMPTY_SUPPLIER);
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const { role } = useRole();
  const canDeleteSupplier = canDeleteStaffOrSupplier(role);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [filter, setFilter] = useState("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

  const expenses = useSb<Expense[]>(["expenses"], () =>
    supabase
      .from("expenses")
      .select(
        "id, category, description, amount, expense_date, payment_method, account_id, supplier_id, employee_id, accounts(name), suppliers(name), employees(name)",
      )
      .order("expense_date", { ascending: false }),
  );
  const suppliers = useSb<Supplier[]>(["suppliers"], () =>
    supabase.from("suppliers").select("id, name, phone, category, balance").order("name"),
  );
  const accounts = useSb<{ id: string; name: string }[]>(["accounts-min"], () =>
    supabase.from("accounts").select("id, name").eq("active", true).order("name"),
  );
  const employees = useSb<{ id: string; name: string }[]>(["employees-min"], () =>
    supabase.from("employees").select("id, name").eq("active", true),
  );

  const rows = (expenses.data ?? []).filter((e) => filter === "all" || e.category === filter);
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = (expenses.data ?? [])
    .filter((e) => e.expense_date.startsWith(month))
    .reduce((s, e) => s + Number(e.amount), 0);

  function openEditExpense(e: Expense) {
    setEditingExpense(e);
    setForm({
      category: e.category,
      description: e.description ?? "",
      amount: String(e.amount),
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      account_id: e.account_id ?? "",
      supplier_id: e.supplier_id ?? "",
      employee_id: e.employee_id ?? "",
    });
    setOpen(true);
  }

  function handleExpenseOpenChange(next: boolean) {
    if (savingExpense) return;
    setOpen(next);
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بمصروف جديد
    if (!next && editingExpense) {
      setEditingExpense(null);
      setForm(EMPTY);
    }
  }

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const payload = {
      category: form.category,
      description: form.description || null,
      amount,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      account_id: form.account_id || null,
      supplier_id: form.supplier_id || null,
      employee_id: form.employee_id || null,
    };
    setSavingExpense(true);
    try {
      if (editingExpense) {
        const { data, error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpense.id)
          .select("id");
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data || data.length === 0) {
          toast.error(
            tr(
              "تعذّر التعديل: المصروف غير موجود أو لا تملك الصلاحية",
              "Could not update: the expense no longer exists or you are not allowed",
            ),
          );
          return;
        }
        toast.success(tr("تم تحديث المصروف", "Expense updated"));
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("تم تسجيل المصروف");
      }
      setOpen(false);
      setEditingExpense(null);
      setForm(EMPTY);
      invalidate(...EXPENSE_RELATED_KEYS);
    } finally {
      setSavingExpense(false);
    }
  }

  async function checkExpenseDelete(e: Expense): Promise<DeleteCheck> {
    // لا توجد سجلات تعتمد على المصروف؛ نتأكد فقط أنه ما زال موجوداً ويمكن الوصول إليه
    const { data, error } = await supabase
      .from("expenses")
      .select("id")
      .eq("id", e.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)
      return {
        blockedReason: tr(
          "هذا المصروف لم يعد موجوداً (ربما حذفه مستخدم آخر). حدّث الصفحة.",
          "This expense no longer exists (another user may have deleted it). Refresh the page.",
        ),
        willDelete: [],
      };
    const label = `${EXPENSE_CATEGORIES[e.category] ?? e.category}${e.description ? ` — ${e.description}` : ""}`;
    return {
      blockedReason: null,
      willDelete: [
        tr(`مصروف ${label} بمبلغ ${money(e.amount)}`, `Expense ${label}, ${money(e.amount)}`),
      ],
      note: e.accounts
        ? tr(
            `سيُعاد ${money(e.amount)} إلى رصيد "${e.accounts.name}" في الخزينة، وسيُستبعد المصروف من لوحة التحكم والتقارير.`,
            `${money(e.amount)} will be returned to the "${e.accounts.name}" balance in the treasury, and the expense removed from the dashboard and reports.`,
          )
        : tr(
            "المصروف غير مرتبط بحساب، فلن يتغير أي رصيد في الخزينة؛ سيُستبعد من لوحة التحكم والتقارير.",
            "The expense is not linked to an account, so no treasury balance changes; it will be removed from the dashboard and reports.",
          ),
    };
  }

  async function confirmExpenseDelete(e: Expense) {
    const { data, error } = await supabase.from("expenses").delete().eq("id", e.id).select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error(
        tr(
          "تعذّر الحذف: المصروف غير موجود أو لا تملك الصلاحية",
          "Could not delete: the expense no longer exists or you are not allowed",
        ),
      );
      return;
    }
    toast.success(tr("تم حذف المصروف", "Expense deleted"));
    setDeleteExpense(null);
    invalidate(...EXPENSE_RELATED_KEYS);
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s);
    setSupplier({ name: s.name, phone: s.phone ?? "", category: s.category ?? "" });
    setSupplierOpen(true);
  }

  function handleSupplierOpenChange(next: boolean) {
    if (savingSupplier) return;
    setSupplierOpen(next);
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بمورد جديد
    if (!next && editingSupplier) {
      setEditingSupplier(null);
      setSupplier(EMPTY_SUPPLIER);
    }
  }

  async function saveSupplier() {
    if (!supplier.name.trim()) {
      toast.error("اسم المورد مطلوب");
      return;
    }
    const payload = {
      name: supplier.name.trim(),
      phone: supplier.phone || null,
      category: supplier.category || null,
    };
    setSavingSupplier(true);
    try {
      if (editingSupplier) {
        const { data, error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", editingSupplier.id)
          .select("id");
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data || data.length === 0) {
          toast.error(tr("لا تملك صلاحية تعديل الموردين", "You are not allowed to edit suppliers"));
          return;
        }
        toast.success(tr("تم تحديث بيانات المورد", "Supplier updated"));
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("تمت إضافة المورد");
      }
      setSupplierOpen(false);
      setEditingSupplier(null);
      setSupplier(EMPTY_SUPPLIER);
      // اسم المورد يظهر في جدول المصروفات
      invalidate("suppliers", "expenses");
    } finally {
      setSavingSupplier(false);
    }
  }

  async function checkSupplierDelete(s: Supplier): Promise<DeleteCheck> {
    const { count, error } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", s.id);
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0)
      return {
        blockedReason: tr(
          `لا يمكن حذف ${s.name}: مرتبط بـ ${count} مصروف مسجل. المصروفات سجلات مالية ويجب أن تبقى مرتبطة بموردها.`,
          `Cannot delete ${s.name}: linked to ${count} recorded expense(s). Expenses are financial records and must keep their supplier.`,
        ),
        willDelete: [],
      };
    return {
      blockedReason: null,
      willDelete: [tr(`بيانات المورد ${s.name}`, `Supplier ${s.name}`)],
    };
  }

  async function confirmSupplierDelete(s: Supplier) {
    const { data, error } = await supabase.from("suppliers").delete().eq("id", s.id).select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error(tr("لا تملك صلاحية حذف الموردين", "You are not allowed to delete suppliers"));
      return;
    }
    toast.success(tr(`تم حذف المورد ${s.name}`, `Supplier ${s.name} deleted`));
    setDeleteSupplier(null);
    invalidate("suppliers");
  }

  return (
    <>
      <PageHeader
        title="المصروفات والمشتريات"
        subtitle="إيجار، رواتب، اتصالات، بنزين، رسوم حكومية للمكتب، مشتريات، تسويق ونثريات"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleSupplierOpenChange(true)}>
              <Plus className="size-4" /> مورد
            </Button>
            <Button onClick={() => handleExpenseOpenChange(true)}>
              <Plus className="size-4" /> مصروف جديد
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي المعروض" value={money(total)} tone="destructive" />
        <StatCard label="مصروفات الشهر الحالي" value={money(monthTotal)} tone="warning" />
        <StatCard label="عدد الموردين" value={String((suppliers.data ?? []).length)} />
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل البنود</SelectItem>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
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
            <Th>التاريخ</Th>
            <Th>البند</Th>
            <Th>البيان</Th>
            <Th>المورد / الموظف</Th>
            <Th>طريقة الدفع</Th>
            <Th>الحساب</Th>
            <Th>المبلغ</Th>
            <Th>{tr("إجراءات", "Actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-muted/40">
              <Td className="num">{dateAr(e.expense_date)}</Td>
              <Td>{EXPENSE_CATEGORIES[e.category] ?? e.category}</Td>
              <Td>{e.description ?? "—"}</Td>
              <Td>{e.suppliers?.name ?? e.employees?.name ?? "—"}</Td>
              <Td>{PAYMENT_METHODS[e.payment_method] ?? e.payment_method}</Td>
              <Td>{e.accounts?.name ?? "—"}</Td>
              <Td className="num font-medium">{money(e.amount)}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEditExpense(e)}
                    aria-label={tr("تعديل المصروف", "Edit expense")}
                    title={tr("تعديل", "Edit")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteExpense(e)}
                    aria-label={tr("حذف المصروف", "Delete expense")}
                    title={tr("حذف", "Delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          {expenses.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr("جارٍ تحميل المصروفات…", "Loading expenses…")}
            </div>
          ) : expenses.error ? (
            <EmptyState
              text={tr(
                `تعذّر تحميل المصروفات: ${expenses.error.message}`,
                `Could not load expenses: ${expenses.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا توجد مصروفات." />
          )}
        </div>
      )}

      <h2 className="mt-8 mb-3 font-bold">الموردون</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>الاسم</Th>
            <Th>التصنيف</Th>
            <Th>الهاتف</Th>
            <Th>الرصيد المستحق</Th>
            <Th>{tr("إجراءات", "Actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {(suppliers.data ?? []).map((s) => (
            <tr key={s.id} className="hover:bg-muted/40">
              <Td className="font-medium">{s.name}</Td>
              <Td>{s.category ?? "—"}</Td>
              <Td className="num">{s.phone ?? "—"}</Td>
              <Td className="num">{money(s.balance)}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEditSupplier(s)}
                    aria-label={tr("تعديل المورد", "Edit supplier")}
                    title={tr("تعديل", "Edit")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {canDeleteSupplier && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteSupplier(s)}
                      aria-label={tr("حذف المورد", "Delete supplier")}
                      title={tr("حذف", "Delete")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {(suppliers.data ?? []).length === 0 && (
        <div className="surface mt-3">
          {suppliers.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr("جارٍ تحميل الموردين…", "Loading suppliers…")}
            </div>
          ) : suppliers.error ? (
            <EmptyState
              text={tr(
                `تعذّر تحميل الموردين: ${suppliers.error.message}`,
                `Could not load suppliers: ${suppliers.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا يوجد موردون." />
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleExpenseOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? tr("تعديل مصروف", "Edit expense") : "تسجيل مصروف"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>البند</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
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
            <div className="space-y-1.5">
              <Label>الحساب / الصندوق</Label>
              <Select
                value={form.account_id}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحساب" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                  {editingExpense?.account_id &&
                    !(accounts.data ?? []).some((a) => a.id === editingExpense.account_id) && (
                      <SelectItem value={editingExpense.account_id}>
                        {editingExpense.accounts?.name ?? "—"} ({tr("غير نشط", "inactive")})
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المورد</Label>
              <Select
                value={form.supplier_id}
                onValueChange={(v) => setForm({ ...form, supplier_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المورد" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الموظف (للسلف والرواتب)</Label>
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
                  {editingExpense?.employee_id &&
                    !(employees.data ?? []).some((e) => e.id === editingExpense.employee_id) && (
                      <SelectItem value={editingExpense.employee_id}>
                        {editingExpense.employees?.name ?? "—"} ({tr("موقوف", "inactive")})
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>البيان</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            {editingExpense && (
              <Button
                variant="outline"
                onClick={() => handleExpenseOpenChange(false)}
                disabled={savingExpense}
              >
                {tr("إلغاء", "Cancel")}
              </Button>
            )}
            <Button onClick={save} disabled={savingExpense}>
              {savingExpense && <Loader2 className="size-4 animate-spin" />}
              {editingExpense ? tr("حفظ التعديلات", "Save changes") : "حفظ المصروف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supplierOpen} onOpenChange={handleSupplierOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier
                ? tr(`تعديل بيانات ${editingSupplier.name}`, `Edit ${editingSupplier.name}`)
                : "مورد جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input
                value={supplier.name}
                onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input
                dir="ltr"
                value={supplier.phone}
                onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <Input
                value={supplier.category}
                onChange={(e) => setSupplier({ ...supplier, category: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            {editingSupplier && (
              <Button
                variant="outline"
                onClick={() => handleSupplierOpenChange(false)}
                disabled={savingSupplier}
              >
                {tr("إلغاء", "Cancel")}
              </Button>
            )}
            <Button onClick={saveSupplier} disabled={savingSupplier}>
              {savingSupplier && <Loader2 className="size-4 animate-spin" />}
              {editingSupplier ? tr("حفظ التعديلات", "Save changes") : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        targetKey={deleteExpense?.id ?? null}
        title={tr("حذف المصروف؟", "Delete expense?")}
        check={() => checkExpenseDelete(deleteExpense!)}
        onConfirm={() => confirmExpenseDelete(deleteExpense!)}
        onClose={() => setDeleteExpense(null)}
      />

      <ConfirmDeleteDialog
        targetKey={deleteSupplier?.id ?? null}
        title={tr(
          `حذف المورد ${deleteSupplier?.name ?? ""}؟`,
          `Delete supplier ${deleteSupplier?.name ?? ""}?`,
        )}
        check={() => checkSupplierDelete(deleteSupplier!)}
        onConfirm={() => confirmSupplierDelete(deleteSupplier!)}
        onClose={() => setDeleteSupplier(null)}
      />
    </>
  );
}
