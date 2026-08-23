import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, Banknote, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { ACCOUNT_TYPES, dateAr, money, splitPayments } from "@/lib/domain";
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

export const Route = createFileRoute("/_authenticated/treasury")({
  head: () => ({
    meta: [
      { title: "الصندوق والبنوك — نظام مكتب التخليص" },
      {
        name: "description",
        content: "أرصدة الصندوق والحسابات البنكية مع المقبوضات والمدفوعات والتحويلات بينها.",
      },
      { property: "og:title", content: "الصندوق والبنوك — نظام مكتب التخليص" },
      { property: "og:description", content: "أرصدة الصندوق والبنوك والتحويلات." },
    ],
  }),
  component: TreasuryPage,
});

type Account = {
  id: string;
  name: string;
  account_type: string;
  bank_name: string | null;
  account_number: string | null;
  opening_balance: number;
  active: boolean;
};

type Transfer = {
  id: string;
  amount: number;
  transfer_date: string;
  notes: string | null;
  from: { name: string } | null;
  to: { name: string } | null;
};

type Withdrawal = {
  id: string;
  account_id: string;
  kind: string;
  amount: number;
  withdraw_date: string;
  gov_entity: string | null;
  reference: string | null;
  notes: string | null;
  account: { name: string } | null;
};

function TreasuryPage() {
  const invalidate = useInvalidate();
  const [accOpen, setAccOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [acc, setAcc] = useState({
    name: "",
    account_type: "cash",
    bank_name: "",
    account_number: "",
    opening_balance: "0",
  });
  const [tr, setTr] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [wd, setWd] = useState({
    account_id: "",
    kind: "withdrawal",
    amount: "",
    withdraw_date: new Date().toISOString().slice(0, 10),
    gov_entity: "",
    reference: "",
    notes: "",
  });

  const accounts = useSb<Account[]>(["accounts"], () =>
    supabase
      .from("accounts")
      .select("id, name, account_type, bank_name, account_number, opening_balance, active")
      .order("name"),
  );
  const payments = useSb<
    { id: string; invoice_id: string; account_id: string | null; amount: number }[]
  >(["payments-all"], () =>
    supabase
      .from("payments")
      .select("id, invoice_id, account_id, amount")
      .order("created_at", { ascending: true }),
  );
  const invoicesGov = useSb<{ id: string; gov_fees: number }[]>(["invoices-gov"], () =>
    supabase.from("invoices").select("id, gov_fees"),
  );
  const expenses = useSb<{ account_id: string | null; amount: number }[]>(["expenses-all"], () =>
    supabase.from("expenses").select("account_id, amount"),
  );
  const govTrx = useSb<{ id: string; gov_fee: number; gov_fee_paid: boolean }[]>(["gov-fees"], () =>
    supabase.from("transactions").select("id, gov_fee, gov_fee_paid"),
  );
  const withdrawals = useSb<Withdrawal[]>(["withdrawals"], () =>
    supabase
      .from("withdrawals")
      .select(
        "id, account_id, kind, amount, withdraw_date, gov_entity, reference, notes, account:account_id(name)",
      )
      .order("withdraw_date", { ascending: false }),
  );

  const transfers = useSb<Transfer[]>(["transfers"], () =>
    supabase
      .from("transfers")
      .select(
        "id, amount, transfer_date, notes, from:from_account_id(name), to:to_account_id(name)",
      )
      .order("transfer_date", { ascending: false }),
  );
  const transferSums = useSb<{ from_account_id: string; to_account_id: string; amount: number }[]>(
    ["transfers-sum"],
    () => supabase.from("transfers").select("from_account_id, to_account_id, amount"),
  );

  const govByInvoice = Object.fromEntries(
    (invoicesGov.data ?? []).map((i) => [i.id, Number(i.gov_fees)]),
  );
  const split = splitPayments(payments.data ?? [], govByInvoice);
  const officeOf = (p: { id: string; amount: number }) =>
    split.get(p.id)?.office ?? Number(p.amount);

  const wdList = withdrawals.data ?? [];

  function balanceOf(a: Account): number {
    const inc = (payments.data ?? [])
      .filter((p) => p.account_id === a.id)
      .reduce((s, p) => s + officeOf(p), 0);
    const out = (expenses.data ?? [])
      .filter((e) => e.account_id === a.id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const wdOut = wdList
      .filter((w) => w.account_id === a.id && w.kind === "withdrawal")
      .reduce((s, w) => s + Number(w.amount), 0);
    const trIn = (transferSums.data ?? [])
      .filter((t) => t.to_account_id === a.id)
      .reduce((s, t) => s + Number(t.amount), 0);
    const trOut = (transferSums.data ?? [])
      .filter((t) => t.from_account_id === a.id)
      .reduce((s, t) => s + Number(t.amount), 0);
    return Number(a.opening_balance) + inc - out - wdOut + trIn - trOut;
  }

  const list = accounts.data ?? [];
  const totalCash = list
    .filter((a) => a.account_type === "cash")
    .reduce((s, a) => s + balanceOf(a), 0);
  const totalBank = list
    .filter((a) => a.account_type === "bank")
    .reduce((s, a) => s + balanceOf(a), 0);
  const totalIn = (payments.data ?? []).reduce((s, p) => s + officeOf(p), 0);
  const totalGov = (payments.data ?? []).reduce(
    (s, p) => s + (split.get(p.id)?.gov ?? 0),
    0,
  );
  const govPaid = (govTrx.data ?? [])
    .filter((t) => t.gov_fee_paid)
    .reduce((s, t) => s + Number(t.gov_fee), 0);
  const govRemaining = (govTrx.data ?? [])
    .filter((t) => !t.gov_fee_paid)
    .reduce((s, t) => s + Number(t.gov_fee), 0);
  const totalWithdrawn = wdList
    .filter((w) => w.kind === "withdrawal")
    .reduce((s, w) => s + Number(w.amount), 0);
  const totalOut = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  async function saveWithdrawal() {
    const amount = Number(wd.amount);
    if (!wd.account_id) {
      toast.error("اختر الحساب");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("withdrawals").insert({
      account_id: wd.account_id,
      kind: wd.kind,
      amount,
      withdraw_date: wd.withdraw_date,
      gov_entity: null,
      reference: wd.reference || null,
      notes: wd.notes || null,
      created_by: auth.user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل السحب");
    setWdOpen(false);
    setWd({ ...wd, amount: "", gov_entity: "", reference: "", notes: "" });
    invalidate("withdrawals", "accounts");
  }



  async function resetGovCounter() {
    const { error } = await supabase
      .from("transactions")
      .update({ gov_fee_paid: true, gov_fee_paid_at: new Date().toISOString().slice(0, 10) })
      .eq("gov_fee_paid", false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تصفير عداد الرسوم الحكومية");
    invalidate("gov-fees", "transactions");
  }

  async function saveAccount() {
    if (!acc.name.trim()) {
      toast.error("اسم الحساب مطلوب");
      return;
    }
    const { error } = await supabase.from("accounts").insert({
      name: acc.name.trim(),
      account_type: acc.account_type,
      bank_name: acc.bank_name || null,
      account_number: acc.account_number || null,
      opening_balance: Number(acc.opening_balance),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تمت إضافة الحساب");
    setAccOpen(false);
    setAcc({ name: "", account_type: "cash", bank_name: "", account_number: "", opening_balance: "0" });
    invalidate("accounts", "accounts-min");
  }

  async function saveTransfer() {
    const amount = Number(tr.amount);
    if (!tr.from_account_id || !tr.to_account_id || tr.from_account_id === tr.to_account_id) {
      toast.error("اختر حسابين مختلفين");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const { error } = await supabase.from("transfers").insert({
      from_account_id: tr.from_account_id,
      to_account_id: tr.to_account_id,
      amount,
      transfer_date: tr.transfer_date,
      notes: tr.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل التحويل");
    setTrOpen(false);
    setTr({ ...tr, amount: "", notes: "" });
    invalidate("transfers", "transfers-sum", "accounts");
  }

  return (
    <>
      <PageHeader
        title="الصندوق والبنوك"
        subtitle="الأرصدة الحالية والمقبوضات والمدفوعات والتحويلات بين الحسابات"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWdOpen(true)}>
              <ArrowDownToLine className="size-4" /> سحب
            </Button>
            <Button variant="secondary" onClick={() => setTrOpen(true)}>
              <ArrowLeftRight className="size-4" /> تحويل
            </Button>
            <Button onClick={() => setAccOpen(true)}>
              <Plus className="size-4" /> حساب جديد
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="رصيد الصندوق"
          value={money(totalCash)}
          hint="بدون الرسوم الحكومية"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="أرصدة البنوك"
          value={money(totalBank)}
          hint="بدون الرسوم الحكومية"
          tone="gov"
        />
        <StatCard
          label="مقبوضات أتعاب المكتب"
          value={money(totalIn)}
          hint="بعد استبعاد الرسوم الحكومية"
          tone="success"
        />
        <StatCard label="إجمالي المدفوعات" value={money(totalOut)} tone="destructive" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="رسوم حكومية محصّلة"
          value={money(totalGov)}
          hint="أمانات غير محسوبة ضمن الرصيد"
          tone="warning"
        />
        <StatCard
          label="رسوم مسددة للجهات"
          value={money(govPaid)}
          hint="ما تم دفعه فعلياً للجهات الحكومية"
          tone="gov"
        />
        <StatCard
          label="رسوم حكومية غير مسددة"
          value={money(govRemaining)}
          hint="المتبقي في الذمة للجهات"
          tone={govRemaining > 0 ? "destructive" : "success"}
        />
      </div>

      <div className="surface mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <div className="font-medium">عداد الرسوم الحكومية</div>
          <p className="text-xs text-muted-foreground">
            الرسوم الحكومية معزولة عن أرصدة الصندوق والبنوك. التصفير يعتبر كل الرسوم غير المسددة
            مدفوعة للجهات.
          </p>
        </div>
        <Button variant="outline" onClick={resetGovCounter} disabled={govRemaining <= 0}>
          <RotateCcw className="size-4" /> تصفير العداد
        </Button>
      </div>

      <div className="mb-6">
        <StatCard label="إجمالي السحوبات من الحسابات" value={money(totalWithdrawn)} />
      </div>



      <TableWrap>
        <thead>
          <tr>
            <Th>الحساب</Th>
            <Th>النوع</Th>
            <Th>البنك / الرقم</Th>
            <Th>الرصيد الافتتاحي</Th>
            <Th>الرصيد الحالي</Th>
            <Th>الحالة</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id} className="hover:bg-muted/40">
              <Td className="font-medium">{a.name}</Td>
              <Td>{ACCOUNT_TYPES[a.account_type] ?? a.account_type}</Td>
              <Td className="text-xs">
                <div>{a.bank_name ?? "—"}</div>
                <div className="num text-muted-foreground">{a.account_number ?? "—"}</div>
              </Td>
              <Td className="num">{money(a.opening_balance)}</Td>
              <Td className="num font-semibold">{money(balanceOf(a))}</Td>
              <Td>
                <Badge
                  label={a.active ? "مفعّل" : "موقوف"}
                  tone={a.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {list.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد حسابات." />
        </div>
      )}

      <h2 className="mt-8 mb-3 font-bold">التحويلات</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>التاريخ</Th>
            <Th>من</Th>
            <Th>إلى</Th>
            <Th>المبلغ</Th>
            <Th>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {(transfers.data ?? []).map((t) => (
            <tr key={t.id} className="hover:bg-muted/40">
              <Td className="num">{dateAr(t.transfer_date)}</Td>
              <Td>{t.from?.name ?? "—"}</Td>
              <Td>{t.to?.name ?? "—"}</Td>
              <Td className="num font-medium">{money(t.amount)}</Td>
              <Td>{t.notes ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {(transfers.data ?? []).length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد تحويلات." />
        </div>
      )}

      <h2 className="mt-8 mb-3 font-bold">السحوبات النقدية</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>التاريخ</Th>
            <Th>الحساب</Th>
            <Th>النوع</Th>
            <Th>الجهة</Th>
            <Th>المبلغ</Th>
            <Th>المرجع</Th>
            <Th>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {wdList.map((w) => (
            <tr key={w.id} className="hover:bg-muted/40">
              <Td className="num">{dateAr(w.withdraw_date)}</Td>
              <Td>{w.account?.name ?? "—"}</Td>
              <Td>
                <Badge
                  label={w.kind === "gov_payment" ? "سداد رسوم حكومية" : "سحب نقدي"}
                  tone={
                    w.kind === "gov_payment"
                      ? "bg-gov/15 text-gov"
                      : "bg-warning/20 text-warning-foreground"
                  }
                />
              </Td>
              <Td>{w.gov_entity ?? "—"}</Td>
              <Td className="num font-medium">{money(w.amount)}</Td>
              <Td className="num text-xs">{w.reference ?? "—"}</Td>
              <Td>{w.notes ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {wdList.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد سحوبات." />
        </div>
      )}

      <Dialog open={wdOpen} onOpenChange={setWdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>سحب مبلغ من حساب</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الحساب *</Label>
              <Select
                value={wd.account_id}
                onValueChange={(v) => setWd({ ...wd, account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
                value={wd.amount}
                onChange={(e) => setWd({ ...wd, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={wd.withdraw_date}
                onChange={(e) => setWd({ ...wd, withdraw_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>المرجع / رقم الإيصال</Label>
              <Input
                dir="ltr"
                value={wd.reference}
                onChange={(e) => setWd({ ...wd, reference: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={wd.notes}
                onChange={(e) => setWd({ ...wd, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveWithdrawal}>حفظ السحب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={accOpen} onOpenChange={setAccOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حساب جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>اسم الحساب *</Label>
              <Input value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={acc.account_type}
                onValueChange={(v) => setAcc({ ...acc, account_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الرصيد الافتتاحي</Label>
              <Input
                type="number"
                dir="ltr"
                value={acc.opening_balance}
                onChange={(e) => setAcc({ ...acc, opening_balance: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>اسم البنك</Label>
              <Input
                value={acc.bank_name}
                onChange={(e) => setAcc({ ...acc, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الحساب</Label>
              <Input
                dir="ltr"
                value={acc.account_number}
                onChange={(e) => setAcc({ ...acc, account_number: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveAccount}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trOpen} onOpenChange={setTrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحويل بين الحسابات</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>من حساب *</Label>
              <Select
                value={tr.from_account_id}
                onValueChange={(v) => setTr({ ...tr, from_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>إلى حساب *</Label>
              <Select
                value={tr.to_account_id}
                onValueChange={(v) => setTr({ ...tr, to_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
                value={tr.amount}
                onChange={(e) => setTr({ ...tr, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={tr.transfer_date}
                onChange={(e) => setTr({ ...tr, transfer_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={tr.notes}
                onChange={(e) => setTr({ ...tr, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveTransfer}>حفظ التحويل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
