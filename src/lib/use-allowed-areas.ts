import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AreaKey = "hub" | "agency" | "studio" | "reception" | "production";

export type AllowedAreas = {
  hub: boolean;
  agency: boolean;
  studio: boolean;
  reception: boolean;
  production: boolean;
  editing: boolean;
  design: boolean;
  shooting: boolean;
  isAdmin: boolean;
  roles: string[];
};

const EMPTY: AllowedAreas = {
  hub: false, agency: false, studio: false, reception: false, production: false,
  editing: false, design: false, shooting: false, isAdmin: false, roles: [],
};

export function useAllowedAreas() {
  const q = useQuery({
    queryKey: ["allowed-areas"],
    queryFn: async (): Promise<AllowedAreas> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return EMPTY;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = (data ?? []).map((r) => r.role as string);
      const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");
      const { data: prodDept } = await supabase
        .from("departments")
        .select("id")
        .eq("code", "production" as never)
        .maybeSingle();
      let isProdRpc = false;
      if (prodDept?.id) {
        const { data: dm } = await supabase
          .from("department_members")
          .select("user_id")
          .eq("department_id", prodDept.id)
          .eq("user_id", u.user.id)
          .maybeSingle();
        isProdRpc = !!dm;
      }
      const isEditor = roles.includes("editor");
      const isDesigner = roles.includes("designer");
      const isPhotographer = roles.includes("photographer");
      const isProduction = !!isProdRpc || isEditor || isDesigner || isPhotographer;
      if (isAdmin) {
        return { hub: true, agency: true, studio: true, reception: true, production: true,
          editing: true, design: true, shooting: true, isAdmin: true, roles };
      }
      const isReception = roles.includes("reception");
      return {
        hub: false,
        agency: false,
        studio: false,
        reception: isReception,
        production: isProduction,
        editing: isEditor,
        design: isDesigner,
        shooting: isPhotographer,
        isAdmin: false,
        roles,
      };
    },
    staleTime: 60_000,
  });
  return { ...(q.data ?? EMPTY), isLoading: q.isLoading };
}

/** Default landing route for a user based on their allowed areas. */
export function defaultLandingFor(a: AllowedAreas): string {
  if (a.isAdmin || a.hub) return "/dashboard";
  if (a.reception) return "/reception";
  if (a.production) return "/production";
  if (a.studio) return "/studio";
  if (a.agency) return "/agency";
  return "/auth";
}