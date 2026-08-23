import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, FileSpreadsheet, Landmark, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { EXPENSE_CATEGORIES, money } from "@/lib/domain";
import { exportExcel } from "@/lib/excel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "التقارير المالية — نظام مكتب التخليص" },
      {
        name: "description",
        content: "تقارير الإيرادات والمصروفات والأرباح مع فصل الرسوم الحكومية عن دخل المكتب.",
      },
      { property: "og:title", content: "التقارير المالية — نظام مكتب التخليص" },
      { property: "og:description", content: "تقارير الإيرادات والمصروفات والأرباح." },
    ],
  }),
  component: ReportsPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
function firstOfMonth() {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}

const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-gov)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-muted-foreground)",
];

function ReportsPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(iso(new Date()));

  const trx = useSb<
    {
      opened_at: string;
      gov_fee: number;
      office_fee: number;
      discount: number;
      status: string;
      type_name: string;
      gov_entity: string | null;
      employees: { name: string } | null;
    }[]
  >(["rep-trx"], () =>
    supabase
      .from("transactions")
      .select("opened_at, gov_fee, office_fee, discount, status, type_name, gov_entity, employees(name)"),
  );
  const invoices = useSb<{ issue_date: string; total: number; paid: number }[]>(["rep-inv"], () =>
    supabase.from("invoices").select("issue_date, total, paid"),
  );
  const expenses = useSb<{ expense_date: string; amount: number; category: string }[]>(
    ["rep-exp"],
    () => supabase.from("expenses").select("expense_date, amount, category"),
  );

  const inRange = (d: string) => d >= from && d <= to;

  const t = (trx.data ?? []).filter((x) => inRange(x.opened_at));
  const inv = (invoices.data ?? []).filter((x) => inRange(x.issue_date));
  const exp = (expenses.data ?? []).filter((x) => inRange(x.expense_date));

  const govFees = t.reduce((s, x) => s + Number(x.gov_fee), 0);
  const officeRevenue = t.reduce((s, x) => s + Number(x.office_fee) - Number(x.discount), 0);
  const invoiced = inv.reduce((s, x) => s + Number(x.total), 0);
  const collected = inv.reduce((s, x) => s + Number(x.paid), 0);
  const receivable = invoiced - collected;
  const totalExpenses = exp.reduce((s, x) => s + Number(x.amount), 0);
  const netProfit = officeRevenue - totalExpenses;
  const margin = officeRevenue ? (netProfit / officeRevenue) * 100 : 0;

  const byService = groupBy(t, (x) => x.type_name);
  const byEntity = groupBy(t, (x) => x.gov_entity ?? "غير محدد");
  const byEmployee = groupBy(t, (x) => x.employees?.name ?? "غير محدد");
  const byCategory = Object.entries(
    exp.reduce<Record<string, number>>((acc, x) => {
      acc[x.category] = (acc[x.category] ?? 0) + Number(x.amount);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  function setPreset(kind: "month" | "quarter" | "year") {
    const d = new Date();
    if (kind === "month") setFrom(firstOfMonth());
    if (kind === "quarter")
      setFrom(iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)));
    if (kind === "year") setFrom(iso(new Date(d.getFullYear(), 0, 1)));
    setTo(iso(d));
  }

  async function exportXlsx() {
    const groupSheet = (name: string, rows: Row[]) => ({
      name,
      rows: [
        ["البيان", "عدد المعاملات", "رسوم حكومية", "أتعاب المكتب"],
        ...rows.map((r) => [r.key, r.count, r.gov, r.office]),
        [
          "الإجمالي",
          rows.reduce((s, r) => s + r.count, 0),
          rows.reduce((s, r) => s + r.gov, 0),
          rows.reduce((s, r) => s + r.office, 0),
        ],
      ],
    });
    await exportExcel(`تقرير-${from}_${to}`, [
      {
        name: "الملخص",
        rows: [
          ["الفترة", `${from} — ${to}`],
          [],
          ["البند", "المبلغ"],
          ["دخل المكتب (أتعاب)", officeRevenue],
          ["رسوم حكومية محصّلة (أمانات)", govFees],
          ["المصروفات", totalExpenses],
          ["صافي الربح", netProfit],
          ["إجمالي الفواتير", invoiced],
          ["المحصّل", collected],
          ["مديونيات العملاء", receivable],
        ],
      },
      groupSheet("حسب الخدمة", byService),
      groupSheet("حسب الجهة", byEntity),
      groupSheet("إنتاجية الموظفين", byEmployee),
      {
        name: "المصروفات",
        rows: [
          ["البند", "المبلغ"],
          ...byCategory.map(([k, v]) => [EXPENSE_CATEGORIES[k] ?? k, v]),
          ["الإجمالي", totalExpenses],
        ],
      },
    ]);
    toast.success("تم تصدير التقرير إلى إكسل");
  }

  const chartData = byService.slice(0, 7).map((r) => ({ name: r.key, office: r.office, gov: r.gov }));

  return (
    <>
      <PageHeader
        title="التقارير المالية"
        subtitle="أرباح المكتب محسوبة من الأتعاب فقط دون الرسوم الحكومية المحصّلة"
        action={
          <Button variant="secondary" onClick={exportXlsx}>
            <FileSpreadsheet className="size-4" /> تصدير إكسل
          </Button>
        }
      />

      <div className="surface mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label>من تاريخ</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>إلى تاريخ</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 pb-0.5">
          <Button size="sm" variant="outline" onClick={() => setPreset("month")}>
            هذا الشهر
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPreset("quarter")}>
            هذا الربع
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPreset("year")}>
            هذه السنة
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="دخل المكتب (أتعاب)"
          value={money(officeRevenue)}
          tone="success"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="رسوم حكومية محصّلة"
          value={money(govFees)}
          tone="gov"
          hint="أمانات وليست دخلاً"
          icon={<Landmark className="size-4" />}
        />
        <StatCard
          label="المصروفات"
          value={money(totalExpenses)}
          tone="destructive"
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="صافي الربح"
          value={money(netProfit)}
          hint={`هامش الربح ${margin.toFixed(1)}%`}
          tone={netProfit >= 0 ? "success" : "destructive"}
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي الفواتير" value={money(invoiced)} />
        <StatCard label="المحصّل" value={money(collected)} tone="success" />
        <StatCard label="مديونيات العملاء" value={money(receivable)} tone="warning" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section className="surface p-5 lg:col-span-3">
          <h2 className="mb-4 font-bold">أعلى الخدمات إيراداً</h2>
          {chartData.length === 0 ? (
            <EmptyState text="لا توجد بيانات في الفترة المحددة." />
          ) : (
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={50} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      direction: "rtl",
                    }}
                  />
                  <Bar dataKey="office" name="أتعاب المكتب" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="gov" name="رسوم حكومية" fill="var(--color-gov)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">توزيع المصروفات</h2>
          {byCategory.length === 0 ? (
            <EmptyState text="لا توجد مصروفات في الفترة." />
          ) : (
            <>
              <div className="h-52" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory.map(([k, v]) => ({ name: EXPENSE_CATEGORIES[k] ?? k, value: v }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {byCategory.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => money(v)}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        direction: "rtl",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {byCategory.slice(0, 6).map(([k, v], idx) => (
                  <li key={k} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{EXPENSE_CATEGORIES[k] ?? k}</span>
                    <span className="num text-muted-foreground">
                      {totalExpenses ? ((v / totalExpenses) * 100).toFixed(1) : "0.0"}%
                    </span>
                    <span className="num font-medium">{money(v)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <Section title="الإيراد حسب الخدمة">
        <GroupTable rows={byService} />
      </Section>

      <Section title="الإيراد حسب الجهة الحكومية">
        <GroupTable rows={byEntity} />
      </Section>

      <Section title="إنتاجية الموظفين">
        <GroupTable rows={byEmployee} />
      </Section>

      <Section title="المصروفات حسب البند">
        {byCategory.length === 0 ? (
          <div className="surface">
            <EmptyState text="لا توجد مصروفات في الفترة." />
          </div>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>البند</Th>
                <Th>المبلغ</Th>
                <Th>النسبة</Th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([k, v]) => {
                const pct = totalExpenses ? (v / totalExpenses) * 100 : 0;
                return (
                  <tr key={k} className="hover:bg-muted/40">
                    <Td>{EXPENSE_CATEGORIES[k] ?? k}</Td>
                    <Td className="num">{money(v)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="num text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-semibold">
                <Td>الإجمالي</Td>
                <Td className="num">{money(totalExpenses)}</Td>
                <Td className="num">100%</Td>
              </tr>
            </tbody>
          </TableWrap>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <span className="h-4 w-1 rounded-full bg-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

type Row = { key: string; count: number; gov: number; office: number };

function groupBy<T extends { gov_fee: number; office_fee: number; discount: number }>(
  items: T[],
  keyOf: (x: T) => string,
): Row[] {
  const map = new Map<string, Row>();
  for (const item of items) {
    const key = keyOf(item);
    const row = map.get(key) ?? { key, count: 0, gov: 0, office: 0 };
    row.count += 1;
    row.gov += Number(item.gov_fee);
    row.office += Number(item.office_fee) - Number(item.discount);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.office - a.office);
}

function GroupTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0)
    return (
      <div className="surface">
        <EmptyState text="لا توجد بيانات في الفترة المحددة." />
      </div>
    );
  const max = Math.max(...rows.map((r) => r.office), 1);
  const totals = rows.reduce(
    (s, r) => ({ count: s.count + r.count, gov: s.gov + r.gov, office: s.office + r.office }),
    { count: 0, gov: 0, office: 0 },
  );
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>البيان</Th>
          <Th>عدد المعاملات</Th>
          <Th>رسوم حكومية</Th>
          <Th>أتعاب المكتب</Th>
          <Th className="w-40">المساهمة</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-muted/40">
            <Td className="font-medium">{r.key}</Td>
            <Td className="num">{r.count}</Td>
            <Td className="num text-muted-foreground">{money(r.gov)}</Td>
            <Td className="num font-semibold">{money(r.office)}</Td>
            <Td>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(0, (r.office / max) * 100)}%` }}
                />
              </div>
            </Td>
          </tr>
        ))}
        <tr className="bg-muted/40 font-semibold">
          <Td>الإجمالي</Td>
          <Td className="num">{totals.count}</Td>
          <Td className="num">{money(totals.gov)}</Td>
          <Td className="num">{money(totals.office)}</Td>
          <Td>{""}</Td>
        </tr>
      </tbody>
    </TableWrap>
  );
}
