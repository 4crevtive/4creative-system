type AccessContext = { supabase: any; userId: string };

export async function computeAccess(context: AccessContext) {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");

  let isProduction = roles.includes("editor") || roles.includes("designer") || roles.includes("photographer");
  if (!isProduction) {
    const { data: prodDept } = await context.supabase
      .from("departments")
      .select("id")
      .eq("code", "production")
      .maybeSingle();
    if (prodDept?.id) {
      const { data: dm } = await context.supabase
        .from("department_members")
        .select("user_id")
        .eq("department_id", prodDept.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      isProduction = !!dm;
    }
  }

  const isReception = roles.includes("reception");
  return {
    isAdmin,
    hub: isAdmin,
    agency: isAdmin,
    studio: isAdmin,
    reception: isAdmin || isReception,
    production: isAdmin || isProduction,
    roles,
  };
}