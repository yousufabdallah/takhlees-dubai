import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSb } from "@/lib/queries";
import { Badge, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui-kit";
import { CLIENT_STATUS, CLIENT_TYPE, dateAr } from "@/lib/domain";
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

type Client = {
  id: string;
  name: string;
  phone: string | null;
  id_number: string | null;
  client_type: string;
  status: string;
  created_at: string;
};

function ClientsPage() {
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    id_number: "",
    nationality: "",
    client_type: "individual",
    status: "new",
    notes: "",
  });

  const clients = useSb<Client[]>(["clients"], () =>
    supabase
      .from("clients")
      .select("id, name, phone, id_number, client_type, status, created_at")
      .order("created_at", { ascending: false }),
  );

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم العميل مطلوب");
      return;
    }
    const { error } = await supabase.from("clients").insert(form);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ العميل");
    setOpen(false);
    setForm({
      name: "",
      phone: "",
      email: "",
      id_number: "",
      nationality: "",
      client_type: "individual",
      status: "new",
      notes: "",
    });
    invalidate("clients");
  }

  const rows = (clients.data ?? []).filter(
    (c) =>
      c.name.includes(q) || (c.phone ?? "").includes(q) || (c.id_number ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="ملف لكل عميل يشمل بياناته ومعاملاته ومستحقاته ومستنداته"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> عميل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة عميل</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>الاسم *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الهاتف</Label>
                  <Input
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم الهوية / الجواز</Label>
                  <Input
                    dir="ltr"
                    value={form.id_number}
                    onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الجنسية</Label>
                  <Input
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>النوع</Label>
                  <Select
                    value={form.client_type}
                    onValueChange={(v) => setForm({ ...form, client_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLIENT_TYPE).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>حالة العميل</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
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
                <Button onClick={save}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {rows.length === 0 && (
        <div className="surface mt-3">
          <EmptyState text="لا يوجد عملاء مطابقون." />
        </div>
      )}
    </>
  );
}
