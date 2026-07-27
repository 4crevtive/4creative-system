import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAvatarSrc } from "@/components/avatar-image";
import {
  LayoutDashboard, ChevronsUpDown, LogOut, Camera, Megaphone,
  Sparkles, Menu, Search, Home, ConciergeBell, Clapperboard, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAllowedAreas } from "@/lib/use-allowed-areas";
import { NotificationsBell } from "@/components/notifications-bell";
import { GlobalSearchProvider } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; badge?: string };

export type AppShellProps = {
  children: ReactNode;
  nav: NavItem[];
  companyLabel: string;
  companyIcon?: ComponentType<{ className?: string }>;
  /** Which area is currently active (controls the workspace switcher highlight) */
  area: "hub" | "agency" | "studio";
};

export function AppShell({ children, nav, companyLabel, companyIcon, area }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const Icon = companyIcon ?? Home;

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-l bg-[var(--sidebar)] sticky top-0 h-screen">
        <SidebarContent nav={nav} companyLabel={companyLabel} CompanyIcon={Icon} area={area} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} title={companyLabel} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SidebarContent nav={nav} companyLabel={companyLabel} CompanyIcon={Icon} area={area} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({
  nav, companyLabel, CompanyIcon, area, onNavigate,
}: {
  nav: NavItem[];
  companyLabel: string;
  CompanyIcon: ComponentType<{ className?: string }>;
  area: "hub" | "agency" | "studio";
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const allowed = useAllowedAreas();
  const showSwitcher = allowed.isAdmin;
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <BrandLogo className="h-10 w-auto" />
        </Link>
      </div>

      <div className="p-3">
        {showSwitcher ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent transition-colors text-right">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground"
                     style={{ background: "var(--gradient-brand)" }}>
                  <CompanyIcon className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">المساحة الحالية</div>
                  <div className="text-sm font-semibold">{companyLabel}</div>
                </div>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuLabel>التبديل بين الشركات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allowed.hub && (
              <DropdownMenuItem asChild>
                <Link to="/dashboard" onClick={onNavigate}>
                  <Home className="h-4 w-4 ml-2" /> اللوحة الإدارية الرئيسية
                </Link>
              </DropdownMenuItem>
            )}
            {allowed.studio && (
              <DropdownMenuItem asChild>
                <Link to="/studio" onClick={onNavigate}>
                  <Camera className="h-4 w-4 ml-2" /> الاستوديو والتصوير
                </Link>
              </DropdownMenuItem>
            )}
            {allowed.agency && (
              <DropdownMenuItem asChild>
                <Link to="/agency" onClick={onNavigate}>
                  <Megaphone className="h-4 w-4 ml-2" /> الماركتنج والبرمجة
                </Link>
              </DropdownMenuItem>
            )}
            {!allowed.isAdmin && allowed.reception && (
              <DropdownMenuItem asChild>
                <Link to="/reception" onClick={onNavigate}>
                  <ConciergeBell className="h-4 w-4 ml-2" /> الاستقبال
                </Link>
              </DropdownMenuItem>
            )}
            {!allowed.isAdmin && allowed.production && (
              <DropdownMenuItem asChild>
                <Link to="/production" onClick={onNavigate}>
                  <Clapperboard className="h-4 w-4 ml-2" /> الإنتاج (مونتاج/تصوير)
                </Link>
              </DropdownMenuItem>
            )}
            {!allowed.hub && !allowed.studio && !allowed.agency && !allowed.reception && !allowed.production && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">لا توجد مساحات متاحة</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        ) : (
          <div className="w-full flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground"
                 style={{ background: "var(--gradient-brand)" }}>
              <CompanyIcon className="h-4 w-4" />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">المساحة الحالية</div>
              <div className="text-sm font-semibold">{companyLabel}</div>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {nav.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const ItemIcon = item.icon;
          return (
            <Link key={item.to} to={item.to} onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
              <ItemIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-right">{item.label}</span>
              {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <div className="rounded-lg bg-accent/40 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground block mb-1">4Creative ERP</strong>
            {area === "hub" ? "نظام موحّد لإدارة الشركتين" : area === "studio" ? "مساحة عمل الاستوديو" : "مساحة عمل الوكالة"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ onMenu, title }: { onMenu: () => void; title: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setUid(data.user?.id ?? null);
    });
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["me-avatar", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, name_ar")
        .eq("id", uid!)
        .maybeSingle();
      return data;
    },
  });
  const avatarSrc = useAvatarSrc(profile?.avatar_url ?? null);
  const initials = ((profile?.name_ar ?? profile?.display_name ?? email ?? "؟") as string).substring(0, 2).toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="h-16 border-b bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center gap-3">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <LayoutDashboard className="h-4 w-4" />
        <span>{title}</span>
      </div>
      <GlobalSearchProvider>
        {(openSearch) => (
          <>
            <div className="hidden md:flex items-center flex-1 max-w-md mr-auto">
              <button
                type="button"
                onClick={openSearch}
                className="relative w-full text-right rounded-lg bg-muted/40 border text-sm hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring pr-9 pl-3 py-2 flex items-center"
              >
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground flex-1">بحث في النظام...</span>
                <kbd className="hidden lg:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Ctrl K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-1 mr-auto md:mr-0">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={openSearch} aria-label="بحث">
                <Search className="h-5 w-5" />
              </Button>
              <NotificationsBell />
              <ThemeToggle />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                {avatarSrc && <AvatarImage src={avatarSrc} alt="avatar" />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={10} collisionPadding={20}>
            <DropdownMenuLabel className="font-normal">
              <div className="text-xs text-muted-foreground">مسجل الدخول كـ</div>
              <div className="text-sm font-medium" dir="ltr">{email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/me"><User className="h-4 w-4 ml-2" /> بروفايلي</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
            </div>
          </>
        )}
      </GlobalSearchProvider>
    </header>
  );
}