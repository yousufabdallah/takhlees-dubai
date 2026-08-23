import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { useRole } from "@/hooks/useRole";
import { canAccess, ROLE_DESC, ROLE_LABELS } from "@/lib/permissions";

/** يمنع فتح الأقسام غير المسموحة حتى عند كتابة الرابط مباشرة */
export function RoleGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        جارٍ التحقق من الصلاحيات…
      </div>
    );
  }

  const base = "/" + (pathname.split("/")[1] ?? "");
  if (!canAccess(role, base)) {
    return (
      <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 size-10 text-destructive" />
        <h1 className="text-lg font-bold">لا تملك صلاحية الدخول لهذا القسم</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          صلاحيتك الحالية: {role ? ROLE_LABELS[role] : "غير محددة"}
          {role ? ` — ${ROLE_DESC[role]}` : ""}
        </p>
        <Link
          to="/dashboard"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
