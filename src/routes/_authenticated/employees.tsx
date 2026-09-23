import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Power, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { dateAr, money, PAYROLL_TYPES } from "@/lib/domain";
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

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون والعمولات — نظام مكتب التخليص" },
      {
        name: "description",
        content: "إنتاجية الموظفين وعدد المعاملات والعمولات والرواتب والسلف والخصومات والحوافز.",
      },
      { property: "og:title", content: "الموظفون والعمولات — نظام مكتب التخليص" },
      { property: "og:description", content: "إنتاجية الموظفين والعمولات والرواتب." },
    ],
  }),
  component: EmployeesPage,
});

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  job_title: string | null;
  salary: number;
  commission_rate: number;
  active: boolean;
};

const EMPTY_EMP = {
  name: "",
  phone: "",
  job_title: "",
  salary: "0",
  commission_rate: "0",
};

type Payroll = {
  id: string;
  employee_id: string;
  entry_type: string;
  amount: number;
  entry_date: string;
  notes: string | null;
  employees: { name: string } | null;
};

function EmployeesPage() {
  const invalidate = useInvalidate();
  const [empOpen, setEmpOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [emp, setEmp] = useState(EMPTY_EMP);
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const { role } = useRole();
  const canDelete = canDeleteStaffOrSupplier(role);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [savingEmp, setSavingEmp] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);
  const [pay, setPay] = useState({
    employee_id: "",
    entry_type: "salary",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const employees = useSb<Employee[]>(["employees"], () =>
    supabase
      .from("employees")
      .select("id, name, phone, job_title, salary, commission_rate, active")
      .order("name"),
  );
  const trx = useSb<{ employee_id: string | null; office_fee: number; status: string }[]>(
    ["trx-by-emp"],
    () => supabase.from("transactions").select("employee_id, office_fee, status"),
  );
  const payroll = useSb<Payroll[]>(["payroll"], () =>
    supabase
      .from("payroll_entries")
      .select("id, employee_id, entry_type, amount, entry_date, notes, employees(name)")
      .order("entry_date", { ascending: false }),
  );

  const list = employees.data ?? [];

  function statsOf(e: Employee) {
    const mine = (trx.data ?? []).filter((t) => t.employee_id === e.id);
    const value = mine.reduce((s, t) => s + Number(t.office_fee), 0);
    const commission = (value * Number(e.commission_rate)) / 100;
    const entries = (payroll.data ?? []).filter((p) => p.employee_id === e.id);
    const paid = entries
      .filter((p) => ["salary", "commission", "advance", "bonus"].includes(p.entry_type))
      .reduce((s, p) => s + Number(p.amount), 0);
    const deductions = entries
      .filter((p) => p.entry_type === "deduction")
      .reduce((s, p) => s + Number(p.amount), 0);
    return { count: mine.length, value, commission, paid, deductions };
  }

  function openEditEmployee(e: Employee) {
    setEditingEmp(e);
    setEmp({
      name: e.name,
      phone: e.phone ?? "",
      job_title: e.job_title ?? "",
      salary: String(e.salary),
      commission_rate: String(e.commission_rate),
    });
    setEmpOpen(true);
  }

  function handleEmpOpenChange(next: boolean) {
    if (savingEmp) return;
    setEmpOpen(next);
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بموظف جديد
    if (!next && editingEmp) {
      setEditingEmp(null);
      setEmp(EMPTY_EMP);
    }
  }

  // أسماء الموظفين تظهر في المعاملات والمصروفات وحركات الرواتب
  function invalidateEmployees() {
    invalidate("employees", "employees-min", "payroll", "transactions", "expenses");
  }

  async function saveEmployee() {
    if (!emp.name.trim()) {
      toast.error("اسم الموظف مطلوب");
      return;
    }
    const payload = {
      name: emp.name.trim(),
      phone: emp.phone || null,
      job_title: emp.job_title || null,
      salary: Number(emp.salary),
      commission_rate: Number(emp.commission_rate),
    };
    setSavingEmp(true);
    try {
      if (editingEmp) {
        const { data, error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmp.id)
          .select("id");
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data || data.length === 0) {
          toast.error(tr("لا تملك صلاحية تعديل الموظفين", "You are not allowed to edit employees"));
          return;
        }
        toast.success(tr("تم تحديث بيانات الموظف", "Employee updated"));
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("تمت إضافة الموظف");
      }
      setEmpOpen(false);
      setEditingEmp(null);
      setEmp(EMPTY_EMP);
      invalidateEmployees();
    } finally {
      setSavingEmp(false);
    }
  }

  async function toggleActive(e: Employee) {
    setTogglingId(e.id);
    try {
      const { data, error } = await supabase
        .from("employees")
        .update({ active: !e.active })
        .eq("id", e.id)
        .select("id");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error(tr("لا تملك صلاحية تعديل الموظفين", "You are not allowed to edit employees"));
        return;
      }
      toast.success(
        e.active
          ? tr(
              `تم إيقاف ${e.name} — لن يظهر في اختيار المعاملات والمصروفات الجديدة`,
              `${e.name} deactivated — hidden from new transactions and expenses`,
            )
          : tr(`تمت إعادة تفعيل ${e.name}`, `${e.name} reactivated`),
      );
      invalidateEmployees();
    } finally {
      setTogglingId(null);
    }
  }

  async function checkEmployeeDelete(e: Employee): Promise<DeleteCheck> {
    const count = (table: "transactions" | "expenses" | "payroll_entries") =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq("employee_id", e.id);
    const [t, x, p] = await Promise.all([
      count("transactions"),
      count("expenses"),
      count("payroll_entries"),
    ]);
    const err = t.error ?? x.error ?? p.error;
    if (err) throw new Error(err.message);
    const trxN = t.count ?? 0;
    const expN = x.count ?? 0;
    const payN = p.count ?? 0;
    if (trxN + expN + payN > 0)
      return {
        blockedReason: tr(
          `لا يمكن حذف ${e.name}: مرتبط بـ ${trxN} معاملة و${expN} مصروف و${payN} حركة رواتب. أوقف الموظف بدلاً من الحذف للحفاظ على السجل.`,
          `Cannot delete ${e.name}: linked to ${trxN} transaction(s), ${expN} expense(s) and ${payN} payroll entries. Deactivate the employee instead to keep the history.`,
        ),
        willDelete: [],
      };
    return {
      blockedReason: null,
      willDelete: [tr(`بيانات الموظف ${e.name}`, `Employee ${e.name}`)],
    };
  }

  async function confirmEmployeeDelete(e: Employee) {
    const { data, error } = await supabase.from("employees").delete().eq("id", e.id).select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error(tr("لا تملك صلاحية حذف الموظفين", "You are not allowed to delete employees"));
      return;
    }
    toast.success(tr(`تم حذف ${e.name}`, `${e.name} deleted`));
    setDeleteEmp(null);
    invalidateEmployees();
  }

  async function savePayroll() {
    const amount = Number(pay.amount);
    if (!pay.employee_id || !amount) {
      toast.error("اختر الموظف وأدخل المبلغ");
      return;
    }
    const { error } = await supabase.from("payroll_entries").insert({
      employee_id: pay.employee_id,
      entry_type: pay.entry_type,
      amount,
      entry_date: pay.entry_date,
      notes: pay.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل الحركة");
    setPayOpen(false);
    setPay({ ...pay, amount: "", notes: "" });
    invalidate("payroll");
  }

  const totalCommission = list.reduce((s, e) => s + statsOf(e).commission, 0);
  const totalSalaries = list.filter((e) => e.active).reduce((s, e) => s + Number(e.salary), 0);

  return (
    <>
      <PageHeader
        title="الموظفون والعمولات"
        subtitle="إنتاجية كل موظف وعمولته ورواتبه وسلفه وخصوماته وحوافزه"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPayOpen(true)}>
              <Plus className="size-4" /> حركة راتب/عمولة
            </Button>
            <Button onClick={() => handleEmpOpenChange(true)}>
              <Plus className="size-4" /> موظف جديد
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="عدد الموظفين"
          value={String(list.length)}
          icon={<UserCog className="size-4" />}
        />
        <StatCard label="إجمالي الرواتب الشهرية" value={money(totalSalaries)} tone="warning" />
        <StatCard label="عمولات مستحقة (تقديري)" value={money(totalCommission)} tone="success" />
      </div>

      <h2 className="mb-3 font-bold">تقرير الإنتاجية</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>الموظف</Th>
            <Th>المسمى</Th>
            <Th>عدد المعاملات</Th>
            <Th>قيمة أتعاب المكتب</Th>
            <Th>نسبة العمولة</Th>
            <Th>العمولة</Th>
            <Th>الراتب</Th>
            <Th>المصروف له</Th>
            <Th>الخصومات</Th>
            <Th>الحالة</Th>
            <Th>{tr("إجراءات", "Actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => {
            const s = statsOf(e);
            return (
              <tr key={e.id} className="hover:bg-muted/40">
                <Td className="font-medium">{e.name}</Td>
                <Td>{e.job_title ?? "—"}</Td>
                <Td className="num">{s.count}</Td>
                <Td className="num">{money(s.value)}</Td>
                <Td className="num">{Number(e.commission_rate)}%</Td>
                <Td className="num">{money(s.commission)}</Td>
                <Td className="num">{money(e.salary)}</Td>
                <Td className="num">{money(s.paid)}</Td>
                <Td className="num">{money(s.deductions)}</Td>
                <Td>
                  <Badge
                    label={e.active ? "على رأس العمل" : "موقوف"}
                    tone={
                      e.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }
                  />
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEditEmployee(e)}
                      aria-label={tr("تعديل الموظف", "Edit employee")}
                      title={tr("تعديل", "Edit")}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={togglingId === e.id}
                      onClick={() => void toggleActive(e)}
                      aria-label={
                        e.active ? tr("إيقاف", "Deactivate") : tr("إعادة تفعيل", "Reactivate")
                      }
                      title={e.active ? tr("إيقاف", "Deactivate") : tr("إعادة تفعيل", "Reactivate")}
                    >
                      {togglingId === e.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Power
                          className={
                            e.active ? "size-4 text-warning-foreground" : "size-4 text-success"
                          }
                        />
                      )}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteEmp(e)}
                        aria-label={tr("حذف الموظف", "Delete employee")}
                        title={tr("حذف", "Delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {list.length === 0 && (
        <div className="surface mt-3">
          {employees.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr("جارٍ تحميل الموظفين…", "Loading employees…")}
            </div>
          ) : employees.error ? (
            <EmptyState
              text={tr(
                `تعذّر تحميل الموظفين: ${employees.error.message}`,
                `Could not load employees: ${employees.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا يوجد موظفون." />
          )}
        </div>
      )}

      <h2 className="mt-8 mb-3 font-bold">حركات الرواتب والعمولات</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>التاريخ</Th>
            <Th>الموظف</Th>
            <Th>النوع</Th>
            <Th>المبلغ</Th>
            <Th>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {(payroll.data ?? []).map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td className="num">{dateAr(p.entry_date)}</Td>
              <Td>{p.employees?.name ?? "—"}</Td>
              <Td>{PAYROLL_TYPES[p.entry_type] ?? p.entry_type}</Td>
              <Td className="num font-medium">{money(p.amount)}</Td>
              <Td>{p.notes ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {(payroll.data ?? []).length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد حركات." />
        </div>
      )}

      <Dialog open={empOpen} onOpenChange={handleEmpOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmp
                ? tr(`تعديل بيانات ${editingEmp.name}`, `Edit ${editingEmp.name}`)
                : "موظف جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الاسم *</Label>
              <Input value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input
                dir="ltr"
                value={emp.phone}
                onChange={(e) => setEmp({ ...emp, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>المسمى الوظيفي</Label>
              <Input
                value={emp.job_title}
                onChange={(e) => setEmp({ ...emp, job_title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الراتب</Label>
              <Input
                type="number"
                dir="ltr"
                value={emp.salary}
                onChange={(e) => setEmp({ ...emp, salary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>نسبة العمولة %</Label>
              <Input
                type="number"
                dir="ltr"
                value={emp.commission_rate}
                onChange={(e) => setEmp({ ...emp, commission_rate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            {editingEmp && (
              <Button
                variant="outline"
                onClick={() => handleEmpOpenChange(false)}
                disabled={savingEmp}
              >
                {tr("إلغاء", "Cancel")}
              </Button>
            )}
            <Button onClick={saveEmployee} disabled={savingEmp}>
              {savingEmp && <Loader2 className="size-4 animate-spin" />}
              {editingEmp ? tr("حفظ التعديلات", "Save changes") : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حركة راتب / عمولة</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الموظف *</Label>
              <Select
                value={pay.employee_id}
                onValueChange={(v) => setPay({ ...pay, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={pay.entry_type}
                onValueChange={(v) => setPay({ ...pay, entry_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYROLL_TYPES).map(([k, v]) => (
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
                value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={pay.entry_date}
                onChange={(e) => setPay({ ...pay, entry_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={pay.notes}
                onChange={(e) => setPay({ ...pay, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePayroll}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        targetKey={deleteEmp?.id ?? null}
        title={tr(
          `حذف الموظف ${deleteEmp?.name ?? ""}؟`,
          `Delete employee ${deleteEmp?.name ?? ""}?`,
        )}
        check={() => checkEmployeeDelete(deleteEmp!)}
        onConfirm={() => confirmEmployeeDelete(deleteEmp!)}
        onClose={() => setDeleteEmp(null)}
      />
    </>
  );
}
