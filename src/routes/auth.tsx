import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — نظام مكتب التخليص" },
      { name: "description", content: "دخول موظفي المكتب إلى نظام إدارة المعاملات والمحاسبة." },
      { property: "og:title", content: "تسجيل الدخول — نظام مكتب التخليص" },
      {
        property: "og:description",
        content: "دخول موظفي المكتب إلى نظام إدارة المعاملات والمحاسبة.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر تسجيل الدخول: " + error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center text-sidebar-foreground">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Building2 className="size-7" />
          </div>
          <h1 className="text-2xl font-bold">نظام مكتب تخليص المعاملات</h1>
          <p className="mt-1 text-sm opacity-70">دبي — محاسبة، معاملات، عملاء، موظفين</p>
        </div>

        <div className="surface p-6">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />} تسجيل الدخول
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                حسابات الموظفين ينشئها مدير النظام من صفحة الإعدادات.
              </p>
        </div>
      </div>
    </div>
  );
}
