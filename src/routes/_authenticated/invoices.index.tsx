import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { dateAr, INVOICE_STATUS, INVOICE_STATUS_TONE, money } from "@/lib/domain";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [
      { title: "الفواتير — نظام مكتب التخليص" },
      { name: "description", content: "فواتير العملاء مع الرسوم والخصم والضريبة والمدفوع والمتبقي." },
      { property: "og:title", content: "الفواتير — نظام مكتب التخليص" },
      { property: "og:description", content: "فواتير العملاء والمدفوعات والمتبقي." },
    ],
  }),
  component: InvoicesPage,
});

type Invoice = {
  id: string;
  invoice_no: string;
  issue_date: string;
  gov_fees: number;
  office_fees: number;
  vat_amount: number;
  total: number;
  paid: number;
  status: string;
  clients: { name: string } | null;
};

function InvoicesPage() {
  const [filter, setFilter] = useState("all");
  const invoices = useSb<Invoice[]>(["invoices"], () =>
    supabase
      .from("invoices")
      .select(
        "id, invoice_no, issue_date, gov_fees, office_fees, vat_amount, total, paid, status, clients(name)",
      )
      .order("created_at", { ascending: false }),
  );

  const rows = (invoices.data ?? []).filter((i) => filter === "all" || i.status === filter);
  const total = rows.reduce((s, i) => s + Number(i.total), 0);
  const paid = rows.reduce((s, i) => s + Number(i.paid), 0);

  async function exportXlsx() {
    if (rows.length === 0) {
      toast.error("لا توجد فواتير للتصدير");
      return;
    }
    await exportExcel(`الفواتير-${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "الفواتير",
        rows: [
          [
            "رقم الفاتورة",
            "العميل",
            "التاريخ",
            "رسوم حكومية",
            "أتعاب المكتب",
            "ضريبة",
            "الإجمالي",
            "المدفوع",
            "المتبقي",
            "الحالة",
          ],
          ...rows.map((i) => [
            i.invoice_no,
            i.clients?.name ?? "—",
            dateAr(i.issue_date),
            Number(i.gov_fees),
            Number(i.office_fees),
            Number(i.vat_amount),
            Number(i.total),
            Number(i.paid),
            Number(i.total) - Number(i.paid),
            INVOICE_STATUS[i.status] ?? i.status,
          ]),
          [
            "الإجمالي",
            "",
            "",
            rows.reduce((s, i) => s + Number(i.gov_fees), 0),
            rows.reduce((s, i) => s + Number(i.office_fees), 0),
            rows.reduce((s, i) => s + Number(i.vat_amount), 0),
            total,
            paid,
            total - paid,
            "",
          ],
        ],
      },
    ]);
    toast.success("تم تصدير ملف الإكسل");
  }

  return (
    <>
      <PageHeader
        title="الفواتير"
        subtitle="تُنشأ الفاتورة تلقائياً عند تسجيل كل معاملة"
        action={
          <Button variant="secondary" onClick={exportXlsx}>
            <FileSpreadsheet className="size-4" /> تصدير إكسل
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي الفواتير" value={money(total)} />
        <StatCard label="المحصّل" value={money(paid)} tone="success" />
        <StatCard label="المتبقي" value={money(total - paid)} tone="warning" />
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => (
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
            <Th>رقم الفاتورة</Th>
            <Th>العميل</Th>
            <Th>التاريخ</Th>
            <Th>رسوم حكومية</Th>
            <Th>أتعاب المكتب</Th>
            <Th>ضريبة</Th>
            <Th>الإجمالي</Th>
            <Th>المدفوع</Th>
            <Th>المتبقي</Th>
            <Th>الحالة</Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="hover:bg-muted/40">
              <Td className="num font-medium">{i.invoice_no}</Td>
              <Td>{i.clients?.name ?? "—"}</Td>
              <Td className="num">{dateAr(i.issue_date)}</Td>
              <Td className="num">{money(i.gov_fees)}</Td>
              <Td className="num">{money(i.office_fees)}</Td>
              <Td className="num">{money(i.vat_amount)}</Td>
              <Td className="num font-semibold">{money(i.total)}</Td>
              <Td className="num">{money(i.paid)}</Td>
              <Td className="num">{money(Number(i.total) - Number(i.paid))}</Td>
              <Td>
                <Badge
                  label={INVOICE_STATUS[i.status] ?? i.status}
                  tone={INVOICE_STATUS_TONE[i.status]}
                />
              </Td>
              <Td>
                <Link
                  to="/invoices/$id"
                  params={{ id: i.id }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  عرض
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد فواتير." />
        </div>
      )}
    </>
  );
}
