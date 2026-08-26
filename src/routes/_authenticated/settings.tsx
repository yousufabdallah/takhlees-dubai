import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenCheck, Landmark, ListChecks, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSb } from "@/lib/queries";
import { PageHeader, StatCard, Badge } from "@/components/ui-kit";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { PermissionsPanel } from "@/components/PermissionsPanel";
import { OfficeSettingsCard } from "@/components/OfficeSettingsCard";
import { EmailSettingsCard } from "@/components/EmailSettingsCard";
import { NotificationLogCard } from "@/components/NotificationLogCard";
import { canManageCatalog, ROLE_DESC, ROLE_LABELS, ROLE_TONE } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — نظام مكتب التخليص" },
      {
        name: "description",
        content: "إعدادات النظام: الجهات الحكومية، الخدمات ورسومها، دليل الحسابات وبيانات الحساب.",
      },
      { property: "og:title", content: "الإعدادات — نظام مكتب التخليص" },
      { property: "og:description", content: "إعدادات النظام والبيانات الأساسية." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { role, isAdmin } = useRole();

  const entities = useSb<{ id: string }[]>(["gov-entities-count"], () =>
    supabase.from("gov_entities").select("id"),
  );
  const services = useSb<{ id: string }[]>(["services-count"], () =>
    supabase.from("transaction_types").select("id"),
  );
  const coa = useSb<{ id: string }[]>(["coa-count"], () =>
    supabase.from("chart_of_accounts").select("id"),
  );
  const employees = useSb<{ id: string }[]>(["employees-count"], () =>
    supabase.from("employees").select("id"),
  );

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="البيانات الأساسية التي يقوم عليها النظام" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="الجهات الحكومية"
          value={String((entities.data ?? []).length)}
          tone="gov"
          icon={<Landmark className="size-4" />}
        />
        <StatCard
          label="الخدمات"
          value={String((services.data ?? []).length)}
          icon={<ListChecks className="size-4" />}
        />
        <StatCard
          label="حسابات الدليل"
          value={String((coa.data ?? []).length)}
          icon={<BookOpenCheck className="size-4" />}
        />
        <StatCard
          label="الموظفون"
          value={String((employees.data ?? []).length)}
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link to="/gov-entities" className="surface block p-5 transition-colors hover:bg-muted/40">
          <h2 className="font-bold">الجهات الحكومية</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تسجيل أسماء الجهات وبيانات التواصل معها.
          </p>
        </Link>
        <Link to="/services" className="surface block p-5 transition-colors hover:bg-muted/40">
          <h2 className="font-bold">الخدمات والرسوم</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            خدمات كل جهة مع الرسوم الحكومية ورسوم المكتب.
          </p>
        </Link>
        <Link to="/accounting" className="surface block p-5 transition-colors hover:bg-muted/40">
          <h2 className="font-bold">دليل الحسابات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تصنيفات الأصول والالتزامات والإيرادات والمصروفات.
          </p>
        </Link>
      </div>

      <div className="surface mt-6 p-5">
        <h2 className="mb-3 font-bold">حسابي</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="text-muted-foreground">البريد الإلكتروني</dt>
            <dd className="num">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="text-muted-foreground">معرّف المستخدم</dt>
            <dd className="num text-xs">{user?.id ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">صلاحيتي</dt>
            <dd>
              {role ? <Badge label={ROLE_LABELS[role]} tone={ROLE_TONE[role]} /> : "—"}
            </dd>
          </div>
        </dl>
        {role && !isAdmin && (
          <p className="mt-3 text-xs text-muted-foreground">{ROLE_DESC[role]}</p>
        )}
      </div>

      {canManageCatalog(role) && <OfficeSettingsCard />}

      {isAdmin && <EmailSettingsCard />}

      <NotificationLogCard />

      {isAdmin && <PermissionsPanel />}
    </>
  );
}
