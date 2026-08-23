import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui-kit";
import { ACCOUNT_CLASSES, dateAr, money } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/accounting")({
  head: () => ({
    meta: [
      { title: "القيود ودليل الحسابات — نظام مكتب التخليص" },
      {
        name: "description",
        content: "القيود اليومية المزدوجة ودليل الحسابات مع التحقق من توازن المدين والدائن.",
      },
      { property: "og:title", content: "القيود ودليل الحسابات — نظام مكتب التخليص" },
      { property: "og:description", content: "القيود اليومية ودليل الحسابات." },
    ],
  }),
  component: AccountingPage,
});

type Coa = {
  id: string;
  code: string;
  name: string;
  account_class: string;
  parent_code: string | null;
  active: boolean;
};

type Entry = {
  id: string;
  entry_date: string;
  description: string | null;
  reference: string | null;
  journal_lines: { id: string; account_code: string; account_name: string | null; debit: number; credit: number }[];
};

type LineForm = { account_code: string; debit: string; credit: string };

function AccountingPage() {
  const invalidate = useInvalidate();
  const [coaOpen, setCoaOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [coa, setCoa] = useState({ code: "", name: "", account_class: "asset", parent_code: "" });
  const [entry, setEntry] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
  });
  const [lines, setLines] = useState<LineForm[]>([
    { account_code: "", debit: "0", credit: "0" },
    { account_code: "", debit: "0", credit: "0" },
  ]);

  const accountsCoa = useSb<Coa[]>(["coa"], () =>
    supabase
      .from("chart_of_accounts")
      .select("id, code, name, account_class, parent_code, active")
      .order("code"),
  );
  const entries = useSb<Entry[]>(["journal"], () =>
    supabase
      .from("journal_entries")
      .select(
        "id, entry_date, description, reference, journal_lines(id, account_code, account_name, debit, credit)",
      )
      .order("entry_date", { ascending: false }),
  );

  const coaList = accountsCoa.data ?? [];
  const entryList = entries.data ?? [];
  const totalDebit = entryList.reduce(
    (s, e) => s + e.journal_lines.reduce((x, l) => x + Number(l.debit), 0),
    0,
  );
  const totalCredit = entryList.reduce(
    (s, e) => s + e.journal_lines.reduce((x, l) => x + Number(l.credit), 0),
    0,
  );

  const formDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const formCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  async function saveCoa() {
    if (!coa.code.trim() || !coa.name.trim()) {
      toast.error("الرمز والاسم مطلوبان");
      return;
    }
    const { error } = await supabase.from("chart_of_accounts").insert({
      code: coa.code.trim(),
      name: coa.name.trim(),
      account_class: coa.account_class,
      parent_code: coa.parent_code || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تمت إضافة الحساب");
    setCoaOpen(false);
    setCoa({ code: "", name: "", account_class: "asset", parent_code: "" });
    invalidate("coa");
  }

  async function saveEntry() {
    const valid = lines.filter((l) => l.account_code && (Number(l.debit) || Number(l.credit)));
    if (valid.length < 2) {
      toast.error("القيد يحتاج سطرين على الأقل");
      return;
    }
    if (Math.abs(formDebit - formCredit) > 0.009) {
      toast.error("القيد غير متوازن: المدين لا يساوي الدائن");
      return;
    }
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        entry_date: entry.entry_date,
        description: entry.description || null,
        reference: entry.reference || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "تعذّر حفظ القيد");
      return;
    }
    const payload = valid.map((l) => ({
      entry_id: data.id,
      account_code: l.account_code,
      account_name: coaList.find((c) => c.code === l.account_code)?.name ?? null,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    }));
    const { error: lineError } = await supabase.from("journal_lines").insert(payload);
    if (lineError) {
      toast.error(lineError.message);
      return;
    }
    toast.success("تم حفظ القيد");
    setEntryOpen(false);
    setEntry({ entry_date: entry.entry_date, description: "", reference: "" });
    setLines([
      { account_code: "", debit: "0", credit: "0" },
      { account_code: "", debit: "0", credit: "0" },
    ]);
    invalidate("journal");
  }

  async function removeEntry(id: string) {
    await supabase.from("journal_lines").delete().eq("entry_id", id);
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("journal");
  }

  return (
    <>
      <PageHeader
        title="القيود ودليل الحسابات"
        subtitle="قيود مزدوجة متوازنة مع دليل حسابات قابل للتوسعة"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد القيود" value={String(entryList.length)} />
        <StatCard label="إجمالي المدين" value={money(totalDebit)} tone="gov" />
        <StatCard label="إجمالي الدائن" value={money(totalCredit)} tone="success" />
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">القيود اليومية</TabsTrigger>
          <TabsTrigger value="coa">دليل الحسابات</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setEntryOpen(true)}>
              <Plus className="size-4" /> قيد جديد
            </Button>
          </div>
          <div className="space-y-4">
            {entryList.map((e) => (
              <div key={e.id} className="surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.description ?? "قيد يومية"}</p>
                    <p className="num text-xs text-muted-foreground">
                      {dateAr(e.entry_date)} {e.reference ? `— ${e.reference}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف القيد"
                    onClick={() => void removeEntry(e.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-1 text-start">الحساب</th>
                      <th className="py-1 text-start">مدين</th>
                      <th className="py-1 text-start">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.journal_lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-1.5">
                          <span className="num text-muted-foreground">{l.account_code}</span>{" "}
                          {l.account_name ?? ""}
                        </td>
                        <td className="num py-1.5">{Number(l.debit) ? money(l.debit) : "—"}</td>
                        <td className="num py-1.5">{Number(l.credit) ? money(l.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {entryList.length === 0 && (
              <div className="surface">
                <EmptyState text="لا توجد قيود." />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coa" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setCoaOpen(true)}>
              <Plus className="size-4" /> حساب جديد
            </Button>
          </div>
          <TableWrap>
            <thead>
              <tr>
                <Th>الرمز</Th>
                <Th>الاسم</Th>
                <Th>التصنيف</Th>
                <Th>الحساب الأب</Th>
              </tr>
            </thead>
            <tbody>
              {coaList.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td className="num font-medium">{c.code}</Td>
                  <Td>{c.name}</Td>
                  <Td>{ACCOUNT_CLASSES[c.account_class] ?? c.account_class}</Td>
                  <Td className="num">{c.parent_code ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {coaList.length === 0 && (
            <div className="surface mt-3">
              <EmptyState text="دليل الحسابات فارغ." />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={coaOpen} onOpenChange={setCoaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حساب في الدليل</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الرمز *</Label>
              <Input
                dir="ltr"
                value={coa.code}
                onChange={(e) => setCoa({ ...coa, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={coa.name} onChange={(e) => setCoa({ ...coa, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <Select
                value={coa.account_class}
                onValueChange={(v) => setCoa({ ...coa, account_class: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_CLASSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>رمز الحساب الأب</Label>
              <Input
                dir="ltr"
                value={coa.parent_code}
                onChange={(e) => setCoa({ ...coa, parent_code: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveCoa}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>قيد يومية جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={entry.entry_date}
                onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>البيان</Label>
              <Input
                value={entry.description}
                onChange={(e) => setEntry({ ...entry, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>المرجع</Label>
              <Input
                value={entry.reference}
                onChange={(e) => setEntry({ ...entry, reference: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {lines.map((l, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px_120px]">
                <Select
                  value={l.account_code}
                  onValueChange={(v) =>
                    setLines(lines.map((x, i) => (i === idx ? { ...x, account_code: v } : x)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaList.map((c) => (
                      <SelectItem key={c.id} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  dir="ltr"
                  placeholder="مدين"
                  value={l.debit}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, i) => (i === idx ? { ...x, debit: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  type="number"
                  dir="ltr"
                  placeholder="دائن"
                  value={l.credit}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, i) => (i === idx ? { ...x, credit: e.target.value } : x)),
                    )
                  }
                />
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLines([...lines, { account_code: "", debit: "0", credit: "0" }])}
            >
              <Plus className="size-4" /> سطر
            </Button>
          </div>

          <div className="surface bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span>مدين</span>
              <span className="num font-bold">{money(formDebit)}</span>
            </div>
            <div className="flex justify-between">
              <span>دائن</span>
              <span className="num font-bold">{money(formCredit)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.abs(formDebit - formCredit) < 0.009 ? "القيد متوازن" : "القيد غير متوازن"}
            </p>
          </div>

          <DialogFooter>
            <Button onClick={saveEntry}>حفظ القيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
