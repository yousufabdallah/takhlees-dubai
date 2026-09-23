import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Banknote,
  Loader2,
  Pencil,
  Plus,
  Power,
  RotateCcw,
} from "lucide-react";
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
import { useI18n } from "@/lib/i18n";

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
  from: { name: string; active: boolean } | null;
  to: { name: string; active: boolean } | null;
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
  account: { name: string; active: boolean } | null;
};

const EMPTY_ACC = {
  name: "",
  account_type: "cash",
  bank_name: "",
  account_number: "",
  opening_balance: "0",
};

/** كل ما يعرض الحسابات أو أسماءها أو أرصدتها */
const ACCOUNT_KEYS = [
  "accounts",
  "accounts-min",
  "expenses",
  "payments",
  "transfers",
  "withdrawals",
];

function TreasuryPage() {
  const invalidate = useInvalidate();
  const [accOpen, setAccOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [acc, setAcc] = useState(EMPTY_ACC);
  const { lang } = useI18n();
  const tl = (ar: string, en: string) => (lang === "en" ? en : ar);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [savingAcc, setSavingAcc] = useState(false);
  const [toggleAcc, setToggleAcc] = useState<Account | null>(null);
  const [toggling, setToggling] = useState(false);
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
        "id, account_id, kind, amount, withdraw_date, gov_entity, reference, notes, account:account_id(name, active)",
      )
      .order("withdraw_date", { ascending: false }),
  );

  const transfers = useSb<Transfer[]>(["transfers"], () =>
    supabase
      .from("transfers")
      .select(
        "id, amount, transfer_date, notes, from:from_account_id(name, active), to:to_account_id(name, active)",
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
  // الحسابات الموقوفة تبقى في الأرصدة والسجلات، لكنها لا تُختار لحركات جديدة
  const activeList = list.filter((a) => a.active);

  /** للحساب حركات مالية؟ عندها يُقفل الرصيد الافتتاحي والنوع (تفرضه قاعدة البيانات أيضاً) */
  function hasRecords(a: Account): boolean {
    return (
      (payments.data ?? []).some((p) => p.account_id === a.id) ||
      (expenses.data ?? []).some((e) => e.account_id === a.id) ||
      wdList.some((w) => w.account_id === a.id) ||
      (transferSums.data ?? []).some((t) => t.from_account_id === a.id || t.to_account_id === a.id)
    );
  }

  function accName(a: { name: string; active: boolean } | null | undefined): string {
    if (!a) return "—";
    return a.active ? a.name : `${a.name} (${tl("موقوف", "inactive")})`;
  }
  const totalCash = list
    .filter((a) => a.account_type === "cash")
    .reduce((s, a) => s + balanceOf(a), 0);
  const totalBank = list
    .filter((a) => a.account_type === "bank")
    .reduce((s, a) => s + balanceOf(a), 0);
  const totalIn = (payments.data ?? []).reduce((s, p) => s + officeOf(p), 0);
  const totalGov = (payments.data ?? []).reduce((s, p) => s + (split.get(p.id)?.gov ?? 0), 0);
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

  function openEditAccount(a: Account) {
    setEditingAcc(a);
    setAcc({
      name: a.name,
      account_type: a.account_type,
      bank_name: a.bank_name ?? "",
      account_number: a.account_number ?? "",
      opening_balance: String(a.opening_balance),
    });
    setAccOpen(true);
  }

  function handleAccOpenChange(next: boolean) {
    if (savingAcc) return;
    setAccOpen(next);
    // نموذج التعديل لا يبقى معبأً بعد الإغلاق حتى لا يختلط بحساب جديد
    if (!next && editingAcc) {
      setEditingAcc(null);
      setAcc(EMPTY_ACC);
    }
  }

  async function saveAccount() {
    if (!acc.name.trim()) {
      toast.error("اسم الحساب مطلوب");
      return;
    }
    const opening = Number(acc.opening_balance);
    if (!Number.isFinite(opening)) {
      toast.error(tl("الرصيد الافتتاحي يجب أن يكون رقماً", "Opening balance must be a number"));
      return;
    }
    const details = {
      name: acc.name.trim(),
      bank_name: acc.bank_name || null,
      account_number: acc.account_number || null,
    };
    const locked = !!editingAcc && hasRecords(editingAcc);
    const payload = locked
      ? details
      : { ...details, account_type: acc.account_type, opening_balance: opening };
    setSavingAcc(true);
    try {
      if (editingAcc) {
        const { data, error } = await supabase
          .from("accounts")
          .update(payload)
          .eq("id", editingAcc.id)
          .select("id");
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data || data.length === 0) {
          toast.error(
            tl(
              "تعذّر التعديل: الحساب غير موجود أو لا تملك الصلاحية",
              "Could not update: the account no longer exists or you are not allowed",
            ),
          );
          return;
        }
        toast.success(tl("تم تحديث بيانات الحساب", "Account updated"));
      } else {
        const { error } = await supabase.from("accounts").insert(payload);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("تمت إضافة الحساب");
      }
      setAccOpen(false);
      setEditingAcc(null);
      setAcc(EMPTY_ACC);
      invalidate(...ACCOUNT_KEYS);
    } finally {
      setSavingAcc(false);
    }
  }

  async function confirmToggle() {
    if (!toggleAcc) return;
    const target = toggleAcc;
    setToggling(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .update({ active: !target.active })
        .eq("id", target.id)
        .select("id");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error(
          tl(
            "تعذّر التحديث: الحساب غير موجود أو لا تملك الصلاحية",
            "Could not update: the account no longer exists or you are not allowed",
          ),
        );
        return;
      }
      toast.success(
        target.active
          ? tl(`تم إيقاف الحساب ${target.name}`, `Account ${target.name} deactivated`)
          : tl(`تمت إعادة تفعيل الحساب ${target.name}`, `Account ${target.name} reactivated`),
      );
      setToggleAcc(null);
      invalidate(...ACCOUNT_KEYS);
    } finally {
      setToggling(false);
    }
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
            <Button onClick={() => handleAccOpenChange(true)}>
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
            <Th>{tl("إجراءات", "Actions")}</Th>
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
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEditAccount(a)}
                    aria-label={tl("تعديل الحساب", "Edit account")}
                    title={tl("تعديل", "Edit")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setToggleAcc(a)}
                    aria-label={
                      a.active
                        ? tl("إيقاف الحساب", "Deactivate account")
                        : tl("إعادة تفعيل الحساب", "Reactivate account")
                    }
                    title={a.active ? tl("إيقاف", "Deactivate") : tl("إعادة تفعيل", "Reactivate")}
                  >
                    <Power
                      className={
                        a.active ? "size-4 text-warning-foreground" : "size-4 text-success"
                      }
                    />
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {list.length === 0 && (
        <div className="surface mt-3">
          {accounts.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tl("جارٍ تحميل الحسابات…", "Loading accounts…")}
            </div>
          ) : accounts.error ? (
            <EmptyState
              text={tl(
                `تعذّر تحميل الحسابات: ${accounts.error.message}`,
                `Could not load accounts: ${accounts.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا توجد حسابات." />
          )}
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
              <Td>{accName(t.from)}</Td>
              <Td>{accName(t.to)}</Td>
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
              <Td>{accName(w.account)}</Td>
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
              <Select value={wd.account_id} onValueChange={(v) => setWd({ ...wd, account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {activeList.map((a) => (
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

      <Dialog open={accOpen} onOpenChange={handleAccOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAcc
                ? tl(`تعديل الحساب ${editingAcc.name}`, `Edit account ${editingAcc.name}`)
                : "حساب جديد"}
            </DialogTitle>
          </DialogHeader>
          {editingAcc && hasRecords(editingAcc) && (
            <p className="surface bg-muted/40 p-3 text-xs text-muted-foreground">
              {tl(
                "على هذا الحساب حركات مالية مسجلة، لذلك لا يمكن تغيير نوعه أو رصيده الافتتاحي حتى لا تتغير الأرصدة السابقة.",
                "This account has financial records, so its type and opening balance can't be changed without rewriting past balances.",
              )}
            </p>
          )}
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
                disabled={!!editingAcc && hasRecords(editingAcc)}
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
                disabled={!!editingAcc && hasRecords(editingAcc)}
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
            {editingAcc && (
              <Button
                variant="outline"
                onClick={() => handleAccOpenChange(false)}
                disabled={savingAcc}
              >
                {tl("إلغاء", "Cancel")}
              </Button>
            )}
            <Button onClick={saveAccount} disabled={savingAcc}>
              {savingAcc && <Loader2 className="size-4 animate-spin" />}
              {editingAcc ? tl("حفظ التعديلات", "Save changes") : "حفظ"}
            </Button>
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
                  {activeList.map((a) => (
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
                  {activeList.map((a) => (
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

      <AlertDialog
        open={!!toggleAcc}
        onOpenChange={(v) => {
          if (!v && !toggling) setToggleAcc(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleAcc?.active
                ? tl(`إيقاف الحساب ${toggleAcc.name}؟`, `Deactivate account ${toggleAcc.name}?`)
                : tl(
                    `إعادة تفعيل الحساب ${toggleAcc?.name ?? ""}؟`,
                    `Reactivate account ${toggleAcc?.name ?? ""}?`,
                  )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {toggleAcc?.active ? (
                  <>
                    <p>
                      {tl(
                        "لن يظهر الحساب في اختيار الدفعات والمصروفات والسحوبات والتحويلات الجديدة. تبقى كل الحركات السابقة عليه كما هي، ويبقى رصيده ضمن إجماليات الخزينة.",
                        "The account will no longer be offered for new payments, expenses, withdrawals or transfers. All its past records stay as they are, and its balance stays in the treasury totals.",
                      )}
                    </p>
                    {Math.abs(balanceOf(toggleAcc)) >= 0.005 && (
                      <p className="surface bg-warning/10 p-3 text-warning-foreground">
                        {tl(
                          `تنبيه: رصيد هذا الحساب الحالي ${money(balanceOf(toggleAcc))}. لن تتمكن من تحويله أو السحب منه وهو موقوف؛ حوّل الرصيد أولاً إذا كنت تريد تصفيره.`,
                          `Warning: this account's current balance is ${money(balanceOf(toggleAcc))}. You won't be able to transfer or withdraw it while the account is inactive; transfer the balance first if you want to empty it.`,
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    {tl(
                      "سيعود الحساب متاحاً للاختيار في الدفعات والمصروفات والسحوبات والتحويلات الجديدة.",
                      "The account will be available again for new payments, expenses, withdrawals and transfers.",
                    )}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>{tl("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggling}
              onClick={(e) => {
                e.preventDefault();
                void confirmToggle();
              }}
            >
              {toggling && <Loader2 className="size-4 animate-spin" />}
              {toggleAcc?.active
                ? tl("إيقاف الحساب", "Deactivate")
                : tl("إعادة التفعيل", "Reactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
