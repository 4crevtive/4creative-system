import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  ScriptOnce,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/components/theme-provider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متاحة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            الرجوع للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const message = error?.message ?? "";
  const isEnvError = message.includes("Missing Supabase environment variable");
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          تعذّر تحميل الصفحة
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isEnvError
            ? "إعدادات الاتصال بالباك إند غير موجودة في بيئة النشر. أضف متغيرات البيئة ثم أعد النشر."
            : "حدث خطأ غير متوقع. حاول إعادة المحاولة أو العودة للرئيسية."}
        </p>
        {isEnvError ? (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-start text-xs text-muted-foreground" dir="ltr">
            <div>Required on Vercel:</div>
            <div>VITE_SUPABASE_URL</div>
            <div>VITE_SUPABASE_PUBLISHABLE_KEY</div>
            <div>SUPABASE_URL</div>
            <div>SUPABASE_PUBLISHABLE_KEY</div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "4Creative — نظام الإدارة الداخلي" },
      { name: "description", content: "نظام ERP + CRM متكامل لإدارة استوديو 4Creative ووكالة الماركتنج والبرمجة." },
      { name: "author", content: "4Creative" },
      { property: "og:title", content: "4Creative — نظام الإدارة الداخلي" },
      { property: "og:description", content: "نظام ERP + CRM متكامل لإدارة استوديو 4Creative ووكالة الماركتنج والبرمجة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "4Creative — نظام الإدارة الداخلي" },
      { name: "twitter:description", content: "نظام ERP + CRM متكامل لإدارة استوديو 4Creative ووكالة الماركتنج والبرمجة." },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ScriptOnce>{`(function(){try{var t=localStorage.getItem('4c-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`}</ScriptOnce>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // The auth page owns navigation after SIGNED_IN. Invalidating the router
      // here remounts that form while it is still resolving the user's role,
      // which makes a successful first attempt look like it failed.
      if (event !== "SIGNED_IN") router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton dir="rtl" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
