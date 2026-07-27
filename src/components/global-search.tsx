import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/lib/global-search.functions";
import { ListTodo, FolderKanban, Building2, Users, UserCircle2, Briefcase } from "lucide-react";

const groupMeta: Record<SearchHit["kind"], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  task: { label: "المهام", icon: ListTodo },
  project: { label: "المشاريع", icon: FolderKanban },
  client: { label: "العملاء", icon: Building2 },
  contact: { label: "جهات الاتصال", icon: Users },
  freelancer: { label: "الفريلانسرز", icon: Briefcase },
  user: { label: "الموظفين", icon: UserCircle2 },
};

export function GlobalSearchProvider({ children }: { children: (open: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const searchFn = useServerFn(globalSearch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enabled = q.trim().length >= 2;
  const { data: hits, isFetching } = useQuery({
    queryKey: ["global-search", q.trim()],
    queryFn: () => searchFn({ data: { q: q.trim() } }),
    enabled,
    staleTime: 30_000,
  });

  const grouped = new Map<SearchHit["kind"], SearchHit[]>();
  (hits ?? []).forEach((h) => {
    const arr = grouped.get(h.kind) ?? [];
    arr.push(h);
    grouped.set(h.kind, arr);
  });

  const go = (h: SearchHit) => {
    setOpen(false);
    setQ("");
    // Router `navigate` requires typed params; cast is fine — routes exist.
    navigate({ to: h.route as never, params: (h.params ?? {}) as never });
  };

  return (
    <>
      {children(() => setOpen(true))}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="ابحث في المهام، المشاريع، العملاء، جهات الاتصال، الموظفين..."
        />
        <CommandList>
          {!enabled ? (
            <div className="py-8 text-center text-sm text-muted-foreground">اكتب حرفين على الأقل للبدء</div>
          ) : isFetching && !hits ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ البحث...</div>
          ) : (hits ?? []).length === 0 ? (
            <CommandEmpty>لا توجد نتائج</CommandEmpty>
          ) : (
            Array.from(grouped.entries()).map(([kind, items], i) => {
              const meta = groupMeta[kind];
              const Icon = meta.icon;
              return (
                <div key={kind}>
                  {i > 0 && <CommandSeparator />}
                  <CommandGroup heading={meta.label}>
                    {items.map((h) => (
                      <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind}-${h.id}-${h.title}`} onSelect={() => go(h)}>
                        <Icon className="ml-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{h.title}</div>
                          {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}