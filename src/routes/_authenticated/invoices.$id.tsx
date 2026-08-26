import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSpreadsheet, Languages, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import {
  dateAr,
  INVOICE_STATUS,
  INVOICE_STATUS_TONE,
  localName,
  money,
  PAYMENT_METHODS,
} from "@/lib/domain";
import { exportExcel } from "@/lib/excel";
import { useI18n } from "@/lib/i18n";
import { useOffice } from "@/lib/office";
import { InvoicePrint, type InvoiceLang, type PrintItem } from "@/components/InvoicePrint";
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

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل الفاتورة — نظام مكتب التخليص" },
      {
        name: "description",
        content: "عرض تفاصيل الفاتورة وتسجيل الدفعات والمتبقي على العميل.",
      },
      { property: "og:title", content: "تفاصيل الفاتورة — نظام مكتب التخليص" },
      { property: "og:description", content: "تفاصيل الفاتورة والدفعات." },
    ],
  }),
  component: InvoiceDetail,
});

type Invoice = {
  id: string;
  invoice_no: string;
  issue_date: string;
  due_date: string | null;
  gov_fees: number;
  office_fees: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  paid: number;
  status: string;
  notes: string | null;
  transaction_id: string | null;
  clients: { id: string; name: string; phone: string | null } | null;
  transactions: {
    ref_no: string;
    type_name: string;
    type_name_en: string | null;
    gov_entity: string | null;
    gov_entity_en: string | null;
  } | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  accounts: { name: string } | null;
};

function InvoiceDetail() {
  const { id } = Route.useParams();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [printLang, setPrintLang] = useState<InvoiceLang>("ar");
  const [form, setForm] = useState({
    amount: "",
    method: "cash",
    account_id: "",
    paid_at: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
  });

  const inv = useSb<Invoice>(["invoice", id], () =>
    supabase
      .from("invoices")
      .select(
        "id, invoice_no, issue_date, due_date, gov_fees, office_fees, discount, vat_rate, vat_amount, total, paid, status, notes, transaction_id, clients(id, name, phone), transactions(ref_no, type_name, type_name_en, gov_entity, gov_entity_en)",
      )
      .eq("id", id)
      .single(),
  );

  const trxId = inv.data?.transaction_id ?? null;
  const trxItems = useSb<PrintItem[]>(["trx-items", trxId ?? "none"], () =>
    supabase
      .from("transaction_items")
      .select("id, gov_entity, gov_entity_en, type_name, type_name_en, gov_fee, office_fee, qty")
      .eq("transaction_id", trxId ?? "00000000-0000-0000-0000-000000000000")
      .order("sort_order"),
  );



  const payments = useSb<Payment[]>(["payments", id], () =>
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, reference, notes, accounts(name)")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
  );

  const accounts = useSb<{ id: string; name: string }[]>(["accounts-min"], () =>
    supabase.from("accounts").select("id, name").eq("active", true).order("name"),
  );

  const office = useOffice();
  const { lang } = useI18n();
  const i = inv.data;
  const remaining = Number(i?.total ?? 0) - Number(i?.paid ?? 0);

  async function addPayment() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const { error } = await supabase.from("payments").insert({
      invoice_id: id,
      amount,
      method: form.method,
      account_id: form.account_id || null,
      paid_at: form.paid_at,
      reference: form.reference || null,
      notes: form.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل الدفعة");
    setOpen(false);
    setForm({ ...form, amount: "", reference: "", notes: "" });
    invalidate("invoice", "payments", "payments-all", "invoices", "invoices-gov", "dash-inv", "accounts");
  }

  async function exportXlsx() {
    if (!i) return;
    await exportExcel(`فاتورة-${i.invoice_no}`, [
      {
        name: "الفاتورة",
        rows: [
          [office.data?.legal_name ?? ""],
          [office.data?.trn ? `الرقم الضريبي (TRN): ${office.data.trn}` : ""],
          [],
          ["رقم الفاتورة", i.invoice_no],
          ["العميل", i.clients?.name ?? "—"],
          ["هاتف العميل", i.clients?.phone ?? "—"],
          ["المعاملة", i.transactions?.ref_no ?? "—"],
          ["الخدمة", localName(lang, i.transactions?.type_name, i.transactions?.type_name_en)],
          ["الجهة الحكومية", localName(lang, i.transactions?.gov_entity, i.transactions?.gov_entity_en)],
          ["تاريخ الإصدار", dateAr(i.issue_date)],
          ["تاريخ الاستحقاق", dateAr(i.due_date)],
          ["الحالة", INVOICE_STATUS[i.status] ?? i.status],
          [],
          ["البند", "المبلغ"],
          ["رسوم حكومية (أمانات)", Number(i.gov_fees)],
          ["أتعاب المكتب", Number(i.office_fees)],
          ["الخصم", Number(i.discount)],
          [`ضريبة القيمة المضافة (${Number(i.vat_rate ?? 0)}%)`, Number(i.vat_amount)],
          ["الإجمالي", Number(i.total)],
          ["المدفوع", Number(i.paid)],
          ["المتبقي", remaining],
        ],
      },
      {
        name: "الدفعات",
        rows: [
          ["التاريخ", "المبلغ", "الطريقة", "الحساب", "المرجع", "ملاحظات"],
          ...(payments.data ?? []).map((p) => [
            dateAr(p.paid_at),
            Number(p.amount),
            PAYMENT_METHODS[p.method] ?? p.method,
            p.accounts?.name ?? "—",
            p.reference ?? "—",
            p.notes ?? "—",
          ]),
        ],
      },
    ]);
    toast.success("تم تصدير الفاتورة إلى إكسل");
  }

  return (
    <>
      {i && (
        <InvoicePrint
          office={office.data}
          invoice={i}
          payments={payments.data ?? []}
          items={trxItems.data ?? []}
          lang={printLang}
        />
      )}

      <PageHeader
        title={`فاتورة ${i?.invoice_no ?? ""}`}
        subtitle={i?.clients?.name ?? ""}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportXlsx}>
              <FileSpreadsheet className="size-4" /> تصدير إكسل
            </Button>
            <Select value={printLang} onValueChange={(v) => setPrintLang(v as InvoiceLang)}>
              <SelectTrigger className="w-36">
                <Languages className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">فاتورة بالعربية</SelectItem>
                <SelectItem value="en">Invoice in English</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> طباعة
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> تسجيل دفعة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>تسجيل دفعة</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
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
                    <Label>طريقة الدفع</Label>
                    <Select
                      value={form.method}
                      onValueChange={(v) => setForm({ ...form, method: v })}
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
                    <Label>التاريخ</Label>
                    <Input
                      type="date"
                      value={form.paid_at}
                      onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>المرجع</Label>
                    <Input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addPayment}>حفظ الدفعة</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي الفاتورة" value={money(i?.total)} />
        <StatCard label="رسوم حكومية" value={money(i?.gov_fees)} tone="gov" />
        <StatCard label="المدفوع" value={money(i?.paid)} tone="success" />
        <StatCard label="المتبقي" value={money(remaining)} tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="surface p-5">
          <h2 className="mb-3 font-bold">تفاصيل الفاتورة</h2>
          <dl className="space-y-2 text-sm">
            <Line label="الحالة">
              <Badge
                label={INVOICE_STATUS[i?.status ?? ""] ?? "—"}
                tone={INVOICE_STATUS_TONE[i?.status ?? ""]}
              />
            </Line>
            <Line label="تاريخ الإصدار">{dateAr(i?.issue_date)}</Line>
            <Line label="تاريخ الاستحقاق">{dateAr(i?.due_date)}</Line>
            <Line label="المعاملة">{i?.transactions?.ref_no ?? "—"}</Line>
            <Line label="الخدمة">{localName(lang, i?.transactions?.type_name, i?.transactions?.type_name_en)}</Line>
            <Line label="الجهة الحكومية">{localName(lang, i?.transactions?.gov_entity, i?.transactions?.gov_entity_en)}</Line>
            <Line label="هاتف العميل">{i?.clients?.phone ?? "—"}</Line>
          </dl>
          {i?.clients && (
            <Link
              to="/clients/$id"
              params={{ id: i.clients.id }}
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              فتح ملف العميل
            </Link>
          )}
        </div>

        <div className="surface p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">تفصيل المبالغ</h2>
          <dl className="space-y-2 text-sm">
            <Line label="رسوم حكومية (أمانات)">{money(i?.gov_fees)}</Line>
            <Line label="أتعاب المكتب">{money(i?.office_fees)}</Line>
            <Line label="الخصم">{money(i?.discount)}</Line>
            <Line label={`ضريبة القيمة المضافة (${Number(i?.vat_rate ?? 0)}%)`}>
              {money(i?.vat_amount)}
            </Line>
            <Line label="الإجمالي">
              <span className="font-bold">{money(i?.total)}</span>
            </Line>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            الرسوم الحكومية تُحصَّل لصالح الجهات الحكومية ولا تُحتسب ضمن دخل المكتب.
          </p>
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-bold">الدفعات</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>التاريخ</Th>
            <Th>المبلغ</Th>
            <Th>الطريقة</Th>
            <Th>الحساب</Th>
            <Th>المرجع</Th>
            <Th>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {(payments.data ?? []).map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td className="num">{dateAr(p.paid_at)}</Td>
              <Td className="num font-medium">{money(p.amount)}</Td>
              <Td>{PAYMENT_METHODS[p.method] ?? p.method}</Td>
              <Td>{p.accounts?.name ?? "—"}</Td>
              <Td className="num">{p.reference ?? "—"}</Td>
              <Td>{p.notes ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {(payments.data ?? []).length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد دفعات مسجلة." />
        </div>
      )}
    </>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}
