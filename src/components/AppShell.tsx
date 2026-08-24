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
  Globe,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { canAccess } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";
import { roleLabels } from "@/lib/translations";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, loading: roleLoading } = useRole();
  const { lang, dir, setLang, t } = useI18n();

  const items = roleLoading
    ? []
    : [
        { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { to: "/clients", label: t("clients"), icon: Users },
        { to: "/transactions", label: t("transactions"), icon: FileStack },
        { to: "/invoices", label: t("invoices"), icon: ReceiptText },
        { to: "/gov-entities", label: t("govEntities"), icon: Landmark },
        { to: "/services", label: t("services"), icon: ListChecks },
        { to: "/expenses", label: t("expenses"), icon: Wallet },
        { to: "/treasury", label: t("treasury"), icon: Banknote },
        { to: "/employees", label: t("employees"), icon: UserCog },
        { to: "/accounting", label: t("accounting"), icon: BookOpenCheck },
        { to: "/reports", label: t("reports"), icon: BarChart3 },
        { to: "/settings", label: t("settings"), icon: Settings },
      ].filter((i) => canAccess(role, i.to));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel = role ? roleLabels[lang][role] : t("tagline");
  const isRtl = dir === "rtl";

  return (
    <div className="min-h-screen bg-background lg:flex" dir={dir}>
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          isRtl ? "right-0" : "left-0",
          open ? "translate-x-0" : isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{t("officeName")}</p>
            <p className="truncate text-xs opacity-60">{roleLabel}</p>
          </div>
          <button
            className="ms-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label={t("closeMenu")}
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

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
            aria-label={t("language")}
          >
            <Globe className="size-[18px]" />
            <span className="flex-1 text-start">{t("language")}</span>
            <span className="rounded bg-sidebar-primary/20 px-2 py-0.5 text-xs font-medium">
              {lang === "ar" ? t("arabic") : t("english")}
            </span>
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-[18px]" />
            {t("logout")}
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
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("menu")}>
            <Menu className="size-5" />
          </Button>
          <span className="font-bold">{t("officeName")}</span>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
