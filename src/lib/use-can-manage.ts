import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Who may edit/delete shared records (tasks, packages…).
 * Reception and regular staff get read-only cards.
 */
export function useCanManage() {
  const { data } = useQuery({
    queryKey: ["can-manage-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as string[];
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (rows ?? []).map((r) => r.role as string);
    },
    staleTime: 5 * 60 * 1000,
  });
  const roles = data ?? [];
  const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");
  const canManage = isAdmin || roles.includes("dept_manager");
  return { roles, isAdmin, canManage };
}
