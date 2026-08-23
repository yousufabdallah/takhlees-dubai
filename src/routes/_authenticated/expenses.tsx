import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
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
  accounts: { name: string } | null;
  suppliers: { name: string } | null;
  employees: { name: string } | null;
};

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  balance: number;
};

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
  const [supplier, setSupplier] = useState({ name: "", phone: "", category: "" });
  const [filter, setFilter] = useState("all");

  const expenses = useSb<Expense[]>(["expenses"], () =>
    supabase
      .from("expenses")
      .select(
        "id, category, description, amount, expense_date, payment_method, accounts(name), suppliers(name), employees(name)",
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

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const { error } = await supabase.from("expenses").insert({
      category: form.category,
      description: form.description || null,
      amount,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      account_id: form.account_id || null,
      supplier_id: form.supplier_id || null,
      employee_id: form.employee_id || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل المصروف");
    setOpen(false);
    setForm(EMPTY);
    invalidate("expenses", "accounts", "dash-exp");
  }

  async function saveSupplier() {
    if (!supplier.name.trim()) {
      toast.error("اسم المورد مطلوب");
      return;
    }
    const { error } = await supabase.from("suppliers").insert({
      name: supplier.name.trim(),
      phone: supplier.phone || null,
      category: supplier.category || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تمت إضافة المورد");
    setSupplierOpen(false);
    setSupplier({ name: "", phone: "", category: "" });
    invalidate("suppliers");
  }

  async function remove(e: Expense) {
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("expenses", "accounts", "dash-exp");
  }

  return (
    <>
      <PageHeader
        title="المصروفات والمشتريات"
        subtitle="إيجار، رواتب، اتصالات، بنزين، رسوم حكومية للمكتب، مشتريات، تسويق ونثريات"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSupplierOpen(true)}>
              <Plus className="size-4" /> مورد
            </Button>
            <Button onClick={() => setOpen(true)}>
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
            <Th>{" "}</Th>
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
                <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => void remove(e)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد مصروفات." />
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
          </tr>
        </thead>
        <tbody>
          {(suppliers.data ?? []).map((s) => (
            <tr key={s.id} className="hover:bg-muted/40">
              <Td className="font-medium">{s.name}</Td>
              <Td>{s.category ?? "—"}</Td>
              <Td className="num">{s.phone ?? "—"}</Td>
              <Td className="num">{money(s.balance)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {(suppliers.data ?? []).length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا يوجد موردون." />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسجيل مصروف</DialogTitle>
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
            <Button onClick={save}>حفظ المصروف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>مورد جديد</DialogTitle>
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
            <Button onClick={saveSupplier}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
