import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  FileStack,
  Landmark,
  TrendingUp,
  Wallet,
  Users as UsersIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";
import { Badge, PageHeader, StatCard, TableWrap, Td, Th, EmptyState } from "@/components/ui-kit";
import { dateAr, money, TRX_STATUS, TRX_STATUS_TONE } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — نظام مكتب التخليص" },
      { name: "description", content: "نظرة عامة على المعاملات والإيرادات والمستحقات والصندوق." },
      { property: "og:title", content: "لوحة التحكم — نظام مكتب التخليص" },
      { property: "og:description", content: "نظرة عامة على المعاملات والإيرادات والمستحقات." },
    ],
  }),
  component: Dashboard,
});

type Trx = {
  id: string;
  ref_no: string;
  type_name: string;
  status: string;
  gov_fee: number;
  office_fee: number;
  opened_at: string;
  clients: { name: string } | null;
};

function Dashboard() {
  const trx = useSb<Trx[]>(["dash-trx"], () =>
    supabase
      .from("transactions")
      .select("id, ref_no, type_name, status, gov_fee, office_fee, opened_at, clients(name)")
      .order("created_at", { ascending: false }),
  );
  const invoices = useSb<{ total: number; paid: number; status: string; gov_fees: number }[]>(
    ["dash-inv"],
    () => supabase.from("invoices").select("total, paid, status, gov_fees"),
  );
  const expenses = useSb<{ amount: number }[]>(["dash-exp"], () =>
    supabase.from("expenses").select("amount"),
  );
  const clients = useSb<{ id: string }[]>(["dash-clients"], () =>
    supabase.from("clients").select("id"),
  );

  const list = trx.data ?? [];
  const inv = invoices.data ?? [];
  const officeRevenue = list.reduce((s, t) => s + Number(t.office_fee), 0);
  const govCollected = list.reduce((s, t) => s + Number(t.gov_fee), 0);
  const totalPaid = inv.reduce((s, i) => s + Number(i.paid), 0);
  // الرسوم الحكومية أمانات تُدفع مباشرة للجهة، فتُستبعد من النقد
  const govPaidThrough = inv.reduce(
    (s, i) => s + Math.min(Number(i.paid), Number(i.gov_fees)),
    0,
  );
  const receivables = inv.reduce((s, i) => s + Math.max(Number(i.total) - Number(i.paid), 0), 0);
  const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const cash = totalPaid - govPaidThrough - totalExpenses;
  const openCount = list.filter((t) => !["completed", "cancelled"].includes(t.status)).length;


  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        subtitle="ملخص أداء المكتب: المعاملات، الإيرادات، المستحقات والصندوق"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="أتعاب المكتب (دخل فعلي)"
          value={money(officeRevenue)}
          hint="لا تشمل الرسوم الحكومية"
          icon={<TrendingUp className="size-4" />}
          tone="success"
        />
        <StatCard
          label="رسوم حكومية محصّلة (أمانات)"
          value={money(govCollected)}
          hint="مبالغ للجهات الحكومية وليست دخلاً"
          icon={<Landmark className="size-4" />}
          tone="gov"
        />
        <StatCard
          label="مستحقات على العملاء"
          value={money(receivables)}
          hint="فواتير غير مسددة بالكامل"
          icon={<Wallet className="size-4" />}
          tone="warning"
        />
        <StatCard
          label="صافي النقد (بدون الرسوم الحكومية)"
          value={money(cash)}
          hint="الرسوم الحكومية تُدفع مباشرة للجهات ولا تدخل الصندوق"
          icon={<Banknote className="size-4" />}
        />

      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي المعاملات"
          value={String(list.length)}
          icon={<FileStack className="size-4" />}
        />
        <StatCard label="معاملات مفتوحة" value={String(openCount)} tone="warning" />
        <StatCard
          label="عدد العملاء"
          value={String((clients.data ?? []).length)}
          icon={<UsersIcon className="size-4" />}
        />
        <StatCard label="إجمالي المصروفات" value={money(totalExpenses)} tone="destructive" />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">أحدث المعاملات</h2>
      <TableWrap>
        <thead>
          <tr>
            <Th>الرقم المرجعي</Th>
            <Th>العميل</Th>
            <Th>نوع المعاملة</Th>
            <Th>التاريخ</Th>
            <Th>الحالة</Th>
            <Th>أتعاب المكتب</Th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 8).map((t) => (
            <tr key={t.id} className="hover:bg-muted/40">
              <Td className="num font-medium">{t.ref_no}</Td>
              <Td>{t.clients?.name ?? "—"}</Td>
              <Td>{t.type_name}</Td>
              <Td className="num">{dateAr(t.opened_at)}</Td>
              <Td>
                <Badge label={TRX_STATUS[t.status] ?? t.status} tone={TRX_STATUS_TONE[t.status]} />
              </Td>
              <Td className="num">{money(t.office_fee)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {list.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا توجد معاملات بعد — ابدأ بإضافة عميل ثم معاملة." />
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
          عرض كل المعاملات
        </Link>
        <Link to="/clients" className="text-sm font-medium text-primary hover:underline">
          إدارة العملاء
        </Link>
      </div>
    </>
  );
}
