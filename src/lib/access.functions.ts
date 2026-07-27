import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeAccess } from "./access.server";

/** Server-verified: throws 403 when the caller cannot access `area`. */
export const assertAreaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ area: z.enum(["hub", "agency", "studio", "reception", "production"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await computeAccess(context);
    // نُرجع الحالة كبيانات بدل رمي خطأ عشان ما يظهرش
    // كـuncaught runtime error في المتصفح — الـbeforeLoad
    // بيقرر إعادة التوجيه بناءً على القيمة.
    return { ok: !!access[data.area] };
  });

/** Server-verified list of allowed areas for the current user. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => computeAccess(context));