import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  LayoutDashboard,
  Users,
  FileStack,
  Landmark,
  ListChecks,
  ReceiptText,
  Wallet,
  Banknote,
  UserCog,
  BookOpenCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { canAccess, ROLE_LABELS } from "@/lib/permissions";

const NAV = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/clients", label: "العملاء", icon: Users },
  { to: "/transactions", label: "المعاملات", icon: FileStack },
  { to: "/invoices", label: "الفواتير", icon: ReceiptText },
  { to: "/gov-entities", label: "الجهات الحكومية", icon: Landmark },
  { to: "/services", label: "الخدمات والرسوم", icon: ListChecks },
  { to: "/expenses", label: "المصروفات", icon: Wallet },
  { to: "/treasury", label: "الصندوق والبنوك", icon: Banknote },
  { to: "/employees", label: "الموظفين والعمولات", icon: UserCog },
  { to: "/accounting", label: "القيود ودليل الحسابات", icon: BookOpenCheck },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, loading: roleLoading } = useRole();
  const items = roleLoading ? [] : NAV.filter((i) => canAccess(role, i.to));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">مكتب تخليص المعاملات</p>
            <p className="truncate text-xs opacity-60">
              {role ? ROLE_LABELS[role] : "دبي — الإمارات"}
            </p>
          </div>
          <button
            className="ms-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-[18px]" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <span className="font-bold">نظام المكتب</span>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
