import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { BrandLogo } from "@/components/brand-logo";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validation";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — 4Creative" },
      { name: "description", content: "الدخول إلى نظام الإدارة الداخلي لـ 4Creative." },
    ],
  }),
  component: AuthPage,
});

const USERNAME_DOMAIN = "4creative.local";

function AuthPage() {
  const navigate = useNavigate();
  // Until React hydrates, a click on the submit button triggers a native form
  // GET submission that reloads the page and clears the fields (forcing the
  // user to type credentials twice). Gate submission on hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    // Clean credentials leaked into the URL by any earlier native submit.
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const email = `${values.username}@${USERNAME_DOMAIN}`;
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password: values.password });
    if (error) {
      toast.error("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    const uid = signIn.user?.id;
    const cacheKey = uid ? `4c-roles:${uid}` : null;
    const decideDest = (list: string[]): string => {
      if (list.some((r) => ["admin", "super_admin"].includes(r))) return "/dashboard";
      if (list.includes("reception")) return "/reception";
      if (["editor", "designer", "photographer"].some((r) => list.includes(r))) return "/production";
      return "/production";
    };
    let dest = "/production";
    if (uid) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles").select("role").eq("user_id", uid);
      const list = (roles ?? []).map((r: { role: string }) => r.role);
      if (!rolesError) {
        dest = decideDest(list);
        if (cacheKey) {
          try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* ignore */ }
        }
      } else if (cacheKey) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) dest = decideDest(JSON.parse(cached) as string[]);
        } catch { /* ignore */ }
      }
    }
    toast.success("مرحباً بك");
    navigate({ to: dest, replace: true });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4"
      dir="rtl"
      style={{ backgroundImage: "radial-gradient(ellipse at top, hsl(var(--primary)/0.08), transparent 60%)" }}
    >
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="flex flex-col items-center gap-3 mb-8">
          <BrandLogo className="h-16 w-auto" />
          <p className="text-sm text-muted-foreground">نظام الإدارة الداخلي — 4Creative</p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!hydrated) return;
              void form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>اسم المستخدم</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      autoComplete="username"
                      dir="ltr"
                      placeholder="username"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>كلمة المرور</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={!hydrated || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </Form>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <span>
            هذا نظام داخلي مغلق — لا يوجد تسجيل ذاتي. الحسابات يُنشئها المسؤول فقط.
          </span>
        </div>
      </Card>
    </div>
  );
}
