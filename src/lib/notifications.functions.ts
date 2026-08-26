import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const settingsSchema = z.object({
  provider: z.enum(["resend", "brevo", "sendgrid"]),
  api_key: z.string().trim().max(300).optional().default(""),
  from_email: z.string().trim().email().max(254),
  from_name: z.string().trim().max(120).optional().default(""),
  notify_on_create: z.boolean(),
  notify_on_status: z.boolean(),
  enabled: z.boolean(),
});

const sendSchema = z.object({
  transactionId: z.string().uuid(),
  kind: z.enum(["created", "status"]),
  statusText: z.string().trim().max(120).optional().default(""),
});

type Settings = {
  id: string;
  provider: string;
  api_key: string | null;
  from_email: string | null;
  from_name: string | null;
  notify_on_create: boolean;
  notify_on_status: boolean;
  enabled: boolean;
};

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (data?.role !== "admin") throw new Error("هذه الإعدادات متاحة لمدير النظام فقط");
}

async function deliver(
  s: Settings,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const key = (s.api_key ?? "").trim();
  const from = (s.from_email ?? "").trim();
  if (!key) throw new Error("مفتاح المزوّد غير محفوظ في الإعدادات");
  if (!from) throw new Error("بريد المُرسل غير محفوظ في الإعدادات");
  const fromName = (s.from_name ?? "").trim();

  let res: Response;
  if (s.provider === "brevo") {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: from, name: fromName || from },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
  } else if (s.provider === "sendgrid") {
    res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: fromName || undefined },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
  } else {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${from}>` : from,
        to: [to],
        subject,
        html,
      }),
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${body.slice(0, 300)}`);
  }
}

function wrapHtml(title: string, lines: string[]) {
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f6f7f9;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;color:#0f2c4c">${title}</h2>
    ${lines.map((l) => `<p style="margin:6px 0;color:#334155;font-size:14px">${l}</p>`).join("")}
  </div>
</div>`;
}

export const loadEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_settings")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const s = data as Settings | null;
    return {
      provider: s?.provider ?? "resend",
      from_email: s?.from_email ?? "",
      from_name: s?.from_name ?? "",
      notify_on_create: s?.notify_on_create ?? true,
      notify_on_status: s?.notify_on_status ?? true,
      enabled: s?.enabled ?? false,
      has_key: Boolean((s?.api_key ?? "").trim()),
    };
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("email_settings")
      .select("id, api_key")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const patch = {
      provider: data.provider,
      from_email: data.from_email,
      from_name: data.from_name,
      notify_on_create: data.notify_on_create,
      notify_on_status: data.notify_on_status,
      enabled: data.enabled,
      ...(data.api_key ? { api_key: data.api_key } : {}),
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("email_settings")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("email_settings").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ to: z.string().trim().email() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("email_settings")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const s = row as Settings | null;
    if (!s) throw new Error("لم يتم حفظ إعدادات البريد بعد");

    const subject = "رسالة اختبار — نظام مكتب التخليص";
    try {
      await deliver(s, data.to, subject, wrapHtml("رسالة اختبار", ["تم ضبط إعدادات البريد بنجاح."]));
      await supabaseAdmin.from("notification_log").insert({
        kind: "test",
        channel: "email",
        recipient: data.to,
        subject,
        status: "sent",
        created_by: context.userId,
      });
      return { sent: true as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل الإرسال";
      await supabaseAdmin.from("notification_log").insert({
        kind: "test",
        channel: "email",
        recipient: data.to,
        subject,
        status: "failed",
        error: message,
        created_by: context.userId,
      });
      throw new Error(message);
    }
  });

export const notifyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("email_settings")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const s = row as Settings | null;
    if (!s || !s.enabled) return { sent: false as const, reason: "disabled" };
    if (data.kind === "created" && !s.notify_on_create)
      return { sent: false as const, reason: "disabled" };
    if (data.kind === "status" && !s.notify_on_status)
      return { sent: false as const, reason: "disabled" };

    const { data: trx } = await context.supabase
      .from("transactions")
      .select("id, ref_no, type_name, status, client_id, clients(name, email)")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!trx) return { sent: false as const, reason: "not_found" };

    const client = (trx as any).clients as { name: string; email: string | null } | null;
    const to = (client?.email ?? "").trim();
    if (!to) return { sent: false as const, reason: "no_email" };

    const subject =
      data.kind === "created"
        ? `تم تسجيل معاملة جديدة — ${trx.ref_no}`
        : `تحديث حالة المعاملة — ${trx.ref_no}`;
    const html = wrapHtml(subject, [
      `عزيزنا ${client?.name ?? ""}،`,
      data.kind === "created"
        ? `تم تسجيل معاملتكم <b>${trx.type_name}</b> برقم مرجعي <b>${trx.ref_no}</b>.`
        : `تم تحديث حالة معاملتكم <b>${trx.type_name}</b> (رقم <b>${trx.ref_no}</b>) إلى: <b>${data.statusText || trx.status}</b>.`,
      "شكراً لثقتكم بنا.",
    ]);

    try {
      await deliver(s, to, subject, html);
      await supabaseAdmin.from("notification_log").insert({
        transaction_id: trx.id,
        client_id: trx.client_id,
        kind: data.kind,
        channel: "email",
        recipient: to,
        subject,
        status: "sent",
        created_by: context.userId,
      });
      return { sent: true as const, to };
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل الإرسال";
      await supabaseAdmin.from("notification_log").insert({
        transaction_id: trx.id,
        client_id: trx.client_id,
        kind: data.kind,
        channel: "email",
        recipient: to,
        subject,
        status: "failed",
        error: message,
        created_by: context.userId,
      });
      return { sent: false as const, reason: "error", error: message };
    }
  });

export const logWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transactionId: z.string().uuid(),
        kind: z.enum(["created", "status"]),
        recipient: z.string().trim().max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_log").insert({
      transaction_id: data.transactionId,
      kind: data.kind,
      channel: "whatsapp",
      recipient: data.recipient,
      status: "sent",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
