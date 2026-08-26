import { BellRing } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";
import { Badge, EmptyState, Td, TableWrap, Th } from "@/components/ui-kit";

type LogRow = {
  id: string;
  channel: string;
  kind: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  created: "معاملة جديدة",
  status: "تحديث الحالة",
  test: "رسالة اختبار",
};

export function NotificationLogCard() {
  const logs = useSb<LogRow[]>(["notification-log"], () =>
    supabase
      .from("notification_log")
      .select("id, channel, kind, recipient, subject, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  );

  const rows = logs.data ?? [];

  return (
    <div className="surface mt-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="size-4 text-primary" />
        <h2 className="font-bold">سجل الإشعارات المرسلة</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="لا توجد إشعارات مرسلة بعد." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>التاريخ</Th>
              <Th>القناة</Th>
              <Th>النوع</Th>
              <Th>المستلم</Th>
              <Th>النتيجة</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <Td className="num text-xs">
                  {new Date(r.created_at).toLocaleString("en-GB")}
                </Td>
                <Td>{r.channel === "whatsapp" ? "واتساب" : "بريد"}</Td>
                <Td>{KIND_LABEL[r.kind] ?? r.kind}</Td>
                <Td className="num text-xs" >{r.recipient ?? "—"}</Td>
                <Td>
                  {r.status === "sent" ? (
                    <Badge label="تم الإرسال" tone="bg-gov/15 text-gov" />
                  ) : (
                    <span className="text-xs text-destructive" title={r.error ?? ""}>
                      فشل — {(r.error ?? "").slice(0, 60)}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
