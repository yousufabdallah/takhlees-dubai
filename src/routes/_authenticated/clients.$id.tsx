import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import {
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui-kit";
import {
  CLIENT_STATUS,
  CLIENT_TYPE,
  dateAr,
  money,
  TRX_STATUS,
  TRX_STATUS_TONE,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "ملف العميل — نظام مكتب التخليص" },
      { name: "description", content: "بيانات العميل وسجل معاملاته ومستحقاته ومستنداته." },
      { property: "og:title", content: "ملف العميل — نظام مكتب التخليص" },
      { property: "og:description", content: "بيانات العميل وسجل معاملاته ومستنداته." },
    ],
  }),
  component: ClientProfile,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  nationality: string | null;
  client_type: string;
  status: string;
  notes: string | null;
};

function ClientProfile() {
  const { id } = Route.useParams();
  const invalidate = useInvalidate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const client = useSb<Client>(["client", id], () =>
    supabase.from("clients").select("*").eq("id", id).single(),
  );
  const trx = useSb<
    {
      id: string;
      ref_no: string;
      type_name: string;
      status: string;
      opened_at: string;
      gov_fee: number;
      office_fee: number;
    }[]
  >(["client-trx", id], () =>
    supabase
      .from("transactions")
      .select("id, ref_no, type_name, status, opened_at, gov_fee, office_fee")
      .eq("client_id", id)
      .order("opened_at", { ascending: false }),
  );
  const invoices = useSb<{ id: string; invoice_no: string; total: number; paid: number }[]>(
    ["client-inv", id],
    () => supabase.from("invoices").select("id, invoice_no, total, paid").eq("client_id", id),
  );
  const docs = useSb<{ id: string; file_name: string; file_path: string; created_at: string }[]>(
    ["client-docs", id],
    () =>
      supabase
        .from("documents")
        .select("id, file_name, file_path, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
  );

  const inv = invoices.data ?? [];
  const totalDue = inv.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = inv.reduce((s, i) => s + Number(i.paid), 0);

  async function changeStatus(status: string) {
    const { error } = await supabase.from("clients").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث حالة العميل");
    invalidate("client", "clients");
  }

  async function upload(file: File) {
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("documents").insert({ client_id: id, file_name: file.name, file_path: path });
    setUploading(false);
    toast.success("تم رفع المستند");
    invalidate("client-docs");
  }

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const c = client.data;

  return (
    <>
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" /> رجوع للعملاء
      </Link>

      <PageHeader
        title={c?.name ?? "ملف العميل"}
        subtitle={c ? `${CLIENT_TYPE[c.client_type]} • ${c.phone ?? "بدون هاتف"}` : ""}
        action={
          c && (
            <Select value={c.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="عدد المعاملات" value={String((trx.data ?? []).length)} />
        <StatCard label="إجمالي الفواتير" value={money(totalDue)} />
        <StatCard label="المدفوع" value={money(totalPaid)} tone="success" />
        <StatCard label="المتبقي" value={money(totalDue - totalPaid)} tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-1">
          <h2 className="mb-3 font-bold">البيانات</h2>
          <dl className="space-y-2 text-sm">
            <Row label="الهاتف" value={c?.phone} ltr />
            <Row label="البريد" value={c?.email} ltr />
            <Row label="الهوية / الجواز" value={c?.id_number} ltr />
            <Row label="الجنسية" value={c?.nationality} />
            <Row label="الحالة" value={c ? CLIENT_STATUS[c.status] : null} />
            <Row label="ملاحظات" value={c?.notes} />
          </dl>

          <h2 className="mt-6 mb-3 font-bold">المستندات</h2>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" /> رفع مستند
          </Button>
          <ul className="mt-3 space-y-2">
            {(docs.data ?? []).map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => openDoc(d.file_path)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{d.file_name}</span>
                </button>
              </li>
            ))}
            {(docs.data ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground">لا توجد مستندات.</li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 font-bold">سجل المعاملات</h2>
          <TableWrap>
            <thead>
              <tr>
                <Th>الرقم المرجعي</Th>
                <Th>النوع</Th>
                <Th>التاريخ</Th>
                <Th>الحالة</Th>
                <Th>رسوم حكومية</Th>
                <Th>أتعاب المكتب</Th>
              </tr>
            </thead>
            <tbody>
              {(trx.data ?? []).map((t) => (
                <tr key={t.id}>
                  <Td className="num font-medium">{t.ref_no}</Td>
                  <Td>{t.type_name}</Td>
                  <Td className="num">{dateAr(t.opened_at)}</Td>
                  <Td>
                    <Badge
                      label={TRX_STATUS[t.status] ?? t.status}
                      tone={TRX_STATUS_TONE[t.status]}
                    />
                  </Td>
                  <Td className="num">{money(t.gov_fee)}</Td>
                  <Td className="num">{money(t.office_fee)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {(trx.data ?? []).length === 0 && (
            <div className="surface mt-3">
              <EmptyState text="لا توجد معاملات لهذا العميل." />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value?: string | null | undefined;
  ltr?: boolean | undefined;
}) {
  return (
    <div className="flex justify-between gap-3 border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={ltr ? "num" : ""}>{value || "—"}</dd>
    </div>
  );
}
