import { useState } from "react";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSb, useInvalidate } from "@/lib/queries";
import { Badge, EmptyState, TableWrap, Td, Th } from "@/components/ui-kit";
import { ROLES, ROLE_DESC, ROLE_LABELS, ROLE_TONE, ROUTE_ROLES, type AppRole } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";
import { createEmployeeAccount } from "@/lib/employees.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = { id: string; full_name: string | null; email: string | null };
type RoleRow = { user_id: string; role: AppRole };

export function PermissionsPanel() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const createEmployee = useServerFn(createEmployeeAccount);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("staff");

  const profiles = useSb<Profile[]>(["perm-profiles"], () =>
    supabase.from("profiles").select("id, full_name, email").order("created_at"),
  );
  const roles = useSb<RoleRow[]>(["perm-roles"], () =>
    supabase.from("user_roles").select("user_id, role"),
  );

  const roleOf = (id: string): AppRole =>
    (roles.data ?? []).find((r) => r.user_id === id)?.role ?? "staff";

  async function changeRole(userId: string, role: AppRole) {
    setSavingId(userId);
    const existing = (roles.data ?? []).find((r) => r.user_id === userId);
    const { error } = existing
      ? await supabase.from("user_roles").update({ role }).eq("user_id", userId)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    setSavingId(null);
    if (error) {
      toast.error("تعذّر تحديث الصلاحية: " + error.message);
      return;
    }
    toast.success("تم تحديث الصلاحية");
    invalidate("perm-roles");
  }

  async function addEmployee(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await createEmployee({ data: { fullName, email, password, role: newRole } });
      setFullName("");
      setEmail("");
      setPassword("");
      setNewRole("staff");
      invalidate("perm-profiles");
      invalidate("perm-roles");
      toast.success("تم إنشاء حساب الموظف وتفعيل دخوله");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إنشاء حساب الموظف");
    } finally {
      setCreating(false);
    }
  }

  const list = profiles.data ?? [];

  return (
    <div className="surface mt-6 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="font-bold">صلاحيات الموظفين</h2>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-lg border p-3">
            <Badge label={ROLE_LABELS[r]} tone={ROLE_TONE[r]} />
            <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESC[r]}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              الأقسام:{" "}
              {Object.entries(ROUTE_ROLES)
                .filter(([, allowed]) => allowed.includes(r))
                .length}{" "}
              قسم
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={addEmployee} className="mb-6 rounded-lg border p-4">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" />
          <h3 className="text-sm font-bold">إضافة حساب موظف</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="employee-name">الاسم الكامل</Label>
            <Input id="employee-name" required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-email">البريد الإلكتروني</Label>
            <Input id="employee-email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-password">كلمة المرور</Label>
            <Input id="employee-password" type="password" dir="ltr" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-role">الصلاحية</Label>
            <select id="employee-role" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)}>
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : <UserPlus />}
          إنشاء حساب الموظف
        </Button>
      </form>

      {list.length === 0 ? (
        <EmptyState text="لا يوجد موظفون بعد. أضف أول موظف من النموذج أعلاه." />
      ) : (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>الموظف</Th>
                <Th>البريد الإلكتروني</Th>
                <Th>الصلاحية الحالية</Th>
                <Th>تغيير الصلاحية</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const current = roleOf(p.id);
                const isSelf = p.id === user?.id;
                return (
                  <tr key={p.id} className="border-t">
                    <Td>
                      {p.full_name ?? "—"}
                      {isSelf && <span className="ms-2 text-xs text-muted-foreground">(أنت)</span>}
                    </Td>
                    <Td className="num text-xs">{p.email ?? "—"}</Td>
                    <Td>
                      <Badge label={ROLE_LABELS[current]} tone={ROLE_TONE[current]} />
                    </Td>
                    <Td>
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={current}
                        disabled={isSelf || savingId === p.id}
                        onChange={(e) => changeRole(p.id, e.target.value as AppRole)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        لا يمكنك تغيير صلاحيتك الخاصة لتفادي فقدان صلاحية الإدارة.
      </p>
    </div>
  );
}
