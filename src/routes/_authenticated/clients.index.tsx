import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui-kit";
import { CLIENT_STATUS, CLIENT_TYPE, dateAr } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClientFormDialog,
  DeleteClientDialog,
  type ClientRecord,
} from "@/components/ClientDialogs";
import { useI18n } from "@/lib/i18n";
import { useRole } from "@/hooks/useRole";
import { canDeleteClient } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "العملاء — نظام مكتب التخليص" },
      { name: "description", content: "ملفات العملاء مع بياناتهم ومعاملاتهم ومستحقاتهم." },
      { property: "og:title", content: "العملاء — نظام مكتب التخليص" },
      { property: "og:description", content: "ملفات العملاء ومعاملاتهم ومستحقاتهم." },
    ],
  }),
  component: ClientsPage,
});

type Client = ClientRecord & { created_at: string };

function ClientsPage() {
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const { role } = useRole();
  const canDelete = canDeleteClient(role);
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const clients = useSb<Client[]>(["clients"], () =>
    supabase
      .from("clients")
      .select(
        "id, name, phone, email, id_number, nationality, client_type, status, notes, created_at",
      )
      .order("created_at", { ascending: false }),
  );

  const rows = (clients.data ?? []).filter(
    (c) => c.name.includes(q) || (c.phone ?? "").includes(q) || (c.id_number ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="ملف لكل عميل يشمل بياناته ومعاملاته ومستحقاته ومستنداته"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> عميل جديد
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الهاتف أو الهوية"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pe-9"
        />
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>الاسم</Th>
            <Th>الهاتف</Th>
            <Th>الهوية / الجواز</Th>
            <Th>النوع</Th>
            <Th>الحالة</Th>
            <Th>تاريخ التسجيل</Th>
            <Th> </Th>
            <Th>{tr("إجراءات", "Actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <Td className="font-medium">{c.name}</Td>
              <Td className="num">{c.phone ?? "—"}</Td>
              <Td className="num">{c.id_number ?? "—"}</Td>
              <Td>{CLIENT_TYPE[c.client_type]}</Td>
              <Td>
                <Badge label={CLIENT_STATUS[c.status] ?? c.status} />
              </Td>
              <Td className="num">{dateAr(c.created_at)}</Td>
              <Td>
                <Link
                  to="/clients/$id"
                  params={{ id: c.id }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  الملف
                </Link>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setEditClient(c)}
                    aria-label={tr("تعديل العميل", "Edit client")}
                    title={tr("تعديل", "Edit")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteClient(c)}
                      aria-label={tr("حذف العميل", "Delete client")}
                      title={tr("حذف", "Delete")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          {clients.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr("جارٍ تحميل العملاء…", "Loading clients…")}
            </div>
          ) : clients.error ? (
            <EmptyState
              text={tr(
                `تعذّر تحميل العملاء: ${clients.error.message}`,
                `Could not load clients: ${clients.error.message}`,
              )}
            />
          ) : (
            <EmptyState text="لا يوجد عملاء مطابقون." />
          )}
        </div>
      )}

      <ClientFormDialog open={open} onOpenChange={setOpen} onSaved={() => invalidate("clients")} />
      <ClientFormDialog
        open={!!editClient}
        onOpenChange={(v) => {
          if (!v) setEditClient(null);
        }}
        client={editClient}
        onSaved={() => invalidate("clients", "client", "clients-min", "transactions", "invoices")}
      />
      <DeleteClientDialog
        client={deleteClient}
        onClose={() => setDeleteClient(null)}
        onDeleted={() => {
          setDeleteClient(null);
          invalidate("clients", "clients-min", "dash-clients");
        }}
      />
    </>
  );
}
