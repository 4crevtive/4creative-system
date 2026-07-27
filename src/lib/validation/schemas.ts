// Central Zod schemas for the entire system (Arabic messages)
import { z } from "zod";
import { M } from "./messages";
import { zStr, zEmail, zPhoneEg, zUrl, zUuid, zPositive, zNonNeg, zInt, zDate, zOptStr, zOptPositiveInt } from "./common";

// ---------- Shared roles ----------
export const APP_ROLES = [
  "super_admin",
  "admin",
  "dept_manager",
  "dept_assistant",
  "reception",
  "staff",
  "viewer",
  "editor",
  "designer",
  "photographer",
] as const;

export const roleSchema = z.enum(APP_ROLES, {
  errorMap: () => ({ message: M.required("الصلاحية") }),
});

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, M.min("اسم المستخدم", 3))
  .max(32, M.max("اسم المستخدم", 32))
  .regex(/^[a-z0-9_.-]+$/, M.usernameInvalid);

export const passwordSchema = z.string().min(6, M.passwordShort).max(128, M.max("كلمة المرور", 128));

// ---------- Auth ----------
export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, M.required("كلمة المرور الحالية")),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "كلمة المرور غير متطابقة" });

export const userCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  display_name: zStr("الاسم الكامل", { min: 2, max: 120 }),
  name_ar: zOptStr(120),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  role: roleSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  user_id: zUuid,
  display_name: zStr("الاسم الكامل", { min: 2, max: 120 }),
  name_ar: zOptStr(120),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  role: roleSchema,
  password: z.string().min(6, M.passwordShort).max(128).optional().or(z.literal("")),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const profileUpdateSchema = z.object({
  display_name: zStr("الاسم بالإنجليزي", { min: 1, max: 120 }),
  name_ar: zOptStr(120),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  bio: zOptStr(1000),
  job_title: zOptStr(120),
  join_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح")]).optional(),
  birthday: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح")]).optional(),
  address: zOptStr(500),
  emergency_contact: zOptStr(200),
  skills: zOptStr(1000),
  avatar_url: zOptStr(500),
  cover_url: zOptStr(500),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ---------- Tasks ----------
export const taskCreateSchema = z.object({
  title: zStr("عنوان التاسك", { min: 2, max: 200 }),
  description: zOptStr(5000),
  type: z.enum(["shooting", "editing", "design", "programming", "marketing"], {
    errorMap: () => ({ message: M.required("نوع التاسك") }),
  }),
  assignees: z.array(zUuid).min(1, "يجب تعيين موظف واحد على الأقل"),
  contact_id: z.union([zUuid, z.literal("")]).optional(),
  priority: z.coerce.number().int().min(1).max(4),
  due_at: z.union([zDate, z.string().length(0)]).optional(),
  started_at: z.union([zDate, z.string().length(0)]).optional(),
  video_duration_pre_seconds: zOptPositiveInt("مدة الفيديو"),
  video_duration_post_seconds: zOptPositiveInt("مدة الفيديو بعد المونتاج"),
  estimated_minutes: zOptPositiveInt("الوقت المقدر"),
  client_name: zOptStr(200),
  project_name: zOptStr(200),
  video_type: zOptStr(100),
  aspect_ratio: zOptStr(50),
  resolution: zOptStr(50),
  platform: zOptStr(100),
  delivery_method: zOptStr(100),
  required_output: zOptStr(500),
  internal_notes: zOptStr(5000),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskCommentSchema = z.object({
  body: zStr("التعليق", { min: 1, max: 2000 }),
});

export const taskChecklistItemSchema = z.object({
  title: zStr("عنصر القائمة", { min: 1, max: 300 }),
});

export const taskReferenceSchema = z.object({
  label: zOptStr(200),
  url: zUrl,
});

export const taskInternalNoteSchema = z.object({
  notes: zStr("الملاحظات", { min: 1, max: 5000 }),
});

export const timeEntrySchema = z.object({
  task_id: zUuid,
  minutes: zPositive("عدد الدقائق"),
  note: zOptStr(500),
});

// ---------- Projects ----------
export const projectSchema = z
  .object({
    name: zStr("اسم المشروع", { min: 2, max: 200 }),
    client_id: z.union([zUuid, z.literal("")]).optional(),
    description: zOptStr(5000),
    status: zOptStr(50),
    start_date: z.union([zDate, z.string().length(0)]).optional(),
    end_date: z.union([zDate, z.string().length(0)]).optional(),
    budget: zOptPositiveInt("الميزانية").or(z.literal("")).optional(),
  })
  .refine(
    (d) => !d.start_date || !d.end_date || !(d.end_date instanceof Date) || !(d.start_date instanceof Date) || d.end_date >= d.start_date,
    { path: ["end_date"], message: M.endAfterStart },
  );

export const milestoneSchema = z.object({
  title: zStr("عنوان المرحلة", { min: 2, max: 200 }),
  description: zOptStr(2000),
  due_date: z.union([zDate, z.string().length(0)]).optional(),
});

export const projectExpenseSchema = z.object({
  title: zStr("وصف المصروف", { min: 2, max: 200 }),
  amount: zPositive("المبلغ"),
  spent_at: z.union([zDate, z.string().length(0)]).optional(),
  notes: zOptStr(1000),
});

// ---------- Contacts / Clients ----------
export const contactSchema = z.object({
  full_name: zStr("الاسم الكامل", { min: 2, max: 150 }),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  email: z.union([zEmail, z.literal("")]).optional(),
  company: zOptStr(150),
  notes: zOptStr(2000),
});

export const agencyClientSchema = z.object({
  name: zStr("اسم العميل", { min: 2, max: 200 }),
  contact_person: zOptStr(150),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  email: z.union([zEmail, z.literal("")]).optional(),
  notes: zOptStr(2000),
});

// ---------- Finance ----------
export const invoiceSchema = z
  .object({
    client_id: zUuid,
    amount: zPositive("قيمة الفاتورة"),
    due_date: z.union([zDate, z.string().length(0)]).optional(),
    notes: zOptStr(1000),
  });

export const paymentSchema = z.object({
  amount: zPositive("المبلغ"),
  method: zStr("طريقة الدفع", { max: 100 }),
  paid_at: z.union([zDate, z.string().length(0)]).optional(),
  notes: zOptStr(500),
});

export const cashMovementSchema = z.object({
  amount: zPositive("المبلغ"),
  type: z.enum(["in", "out"], { errorMap: () => ({ message: "اختر نوع الحركة" }) }),
  reason: zStr("السبب", { min: 2, max: 300 }),
  notes: zOptStr(1000),
});

// ---------- Studio / Bookings ----------
export const bookingSchema = z
  .object({
    room_id: zUuid,
    contact_id: z.union([zUuid, z.literal("")]).optional(),
    starts_at: zDate,
    ends_at: zDate,
    notes: zOptStr(1000),
  })
  .refine((d) => d.ends_at > d.starts_at, { path: ["ends_at"], message: M.endAfterStart });

export const studioPackageSchema = z.object({
  name: zStr("اسم الباقة", { min: 2, max: 150 }),
  price: zNonNeg("السعر"),
  duration_minutes: zPositive("مدة الباقة"),
  description: zOptStr(2000),
});

// ---------- HR / Departments ----------
export const freelancerSchema = z.object({
  full_name: zStr("الاسم الكامل", { min: 2, max: 150 }),
  phone: z.union([zPhoneEg, z.literal("")]).optional(),
  email: z.union([zEmail, z.literal("")]).optional(),
  specialty: zOptStr(150),
  hourly_rate: zOptPositiveInt("سعر الساعة"),
  notes: zOptStr(2000),
});

export const equipmentSchema = z.object({
  name: zStr("اسم المعدة", { min: 2, max: 150 }),
  code: zOptStr(100),
  status: zOptStr(50),
  notes: zOptStr(1000),
});

export const departmentSchema = z.object({
  name: zStr("اسم القسم", { min: 2, max: 100 }),
  code: zStr("كود القسم", { min: 2, max: 50 }),
});

// ---------- Attendance ----------
export const attendanceSchema = z.object({
  user_id: zUuid,
  kind: z.enum(["in", "out"], { errorMap: () => ({ message: "اختر نوع البصمة" }) }),
  notes: zOptStr(500),
});

// ---------- Helper: format Zod errors ----------
export function firstErrorMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? "بيانات غير صالحة";
}
