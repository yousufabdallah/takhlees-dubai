import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserCog } from "lucide-react";
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
  const [emp, setEmp] = useState({
    name: "",
    phone: "",
    job_title: "",
    salary: "0",
    commission_rate: "0",
  });
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

  async function saveEmployee() {
    if (!emp.name.trim()) {
      toast.error("اسم الموظف مطلوب");
      return;
    }
    const { error } = await supabase.from("employees").insert({
      name: emp.name.trim(),
      phone: emp.phone || null,
      job_title: emp.job_title || null,
      salary: Number(emp.salary),
      commission_rate: Number(emp.commission_rate),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تمت إضافة الموظف");
    setEmpOpen(false);
    setEmp({ name: "", phone: "", job_title: "", salary: "0", commission_rate: "0" });
    invalidate("employees", "employees-min");
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
            <Button onClick={() => setEmpOpen(true)}>
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
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {list.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا يوجد موظفون." />
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

      <Dialog open={empOpen} onOpenChange={setEmpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>موظف جديد</DialogTitle>
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
            <Button onClick={saveEmployee}>حفظ</Button>
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
    </>
  );
}
