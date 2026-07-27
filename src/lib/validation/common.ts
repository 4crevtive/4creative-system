// Common reusable Zod primitives (Arabic messages)
import { z } from "zod";
import { M } from "./messages";

export const zStr = (field: string, opts: { min?: number; max?: number; optional?: boolean } = {}) => {
  const { min = 1, max = 500, optional = false } = opts;
  let s = z.string().trim();
  if (min > 0) s = s.min(min, M.min(field, min));
  s = s.max(max, M.max(field, max));
  return optional ? s.optional().or(z.literal("")) : s;
};

export const zEmail = z.string().trim().toLowerCase().email(M.email).max(255);
export const zPhoneEg = z.string().trim().regex(/^01[0125]\d{8}$/, M.phoneEg);
export const zUrl = z.string().trim().url(M.url).max(2048);
export const zUuid = z.string().uuid(M.uuid);
export const zPositive = (field: string) => z.coerce.number({ invalid_type_error: M.int(field) }).positive(M.positive(field));
export const zNonNeg = (field: string) => z.coerce.number({ invalid_type_error: M.int(field) }).nonnegative(M.nonneg(field));
export const zInt = (field: string) => z.coerce.number({ invalid_type_error: M.int(field) }).int(M.int(field));
export const zDate = z.coerce.date({ invalid_type_error: M.date });

/** Optional string that maps "" → undefined for cleaner payloads */
export const zOptStr = (max = 1000) =>
  z.string().trim().max(max, M.max("الحقل", max)).optional().transform((v) => v || undefined);

/** Optional positive int from string/number input */
export const zOptPositiveInt = (field: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int(M.int(field)).positive(M.positive(field)).optional(),
  );
