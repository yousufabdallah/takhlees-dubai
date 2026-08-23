import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
  role: z.enum(["admin", "accountant", "staff"]),
});

export const createEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => employeeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: callerRole, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (roleError || callerRole?.role !== "admin") {
      throw new Error("غير مصرح لك بإنشاء حسابات الموظفين");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (createError || !created.user) {
      throw new Error(createError?.message ?? "تعذّر إنشاء حساب الموظف");
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", created.user.id);

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("تعذّر تعيين صلاحية الموظف");
    }

    return { id: created.user.id, email: data.email.toLowerCase() };
  });