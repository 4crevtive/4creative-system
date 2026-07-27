export * from "./messages";
export * from "./common";
export * from "./schemas";

import { z } from "zod";
import { toast } from "sonner";

/**
 * Validate an object against a Zod schema. Returns { ok: true, data } on
 * success, or { ok: false, errors, message } on failure (and shows a toast).
 * Use in form save handlers to short-circuit before hitting the DB.
 */
export function validateForm<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; message: string } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const msg = r.error.issues[0]?.message ?? "بيانات غير صالحة";
  toast.error(msg);
  return { ok: false, message: msg };
}

/** For .inputValidator() in createServerFn — throws with Arabic message. */
export function serverValidate<T extends z.ZodTypeAny>(schema: T) {
  return (raw: unknown): z.infer<T> => {
    const r = schema.safeParse(raw);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "بيانات غير صالحة");
    return r.data;
  };
}
