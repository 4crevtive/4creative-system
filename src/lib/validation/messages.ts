// Arabic validation messages — reusable across schemas
export const M = {
  required: (field: string) => `${field} مطلوب`,
  min: (field: string, n: number) => `${field} يجب أن يكون على الأقل ${n} حروف`,
  max: (field: string, n: number) => `${field} يجب ألا يزيد عن ${n} حرف`,
  email: "البريد الإلكتروني غير صالح",
  url: "الرابط غير صالح",
  phoneEg: "رقم الموبايل غير صالح (يجب أن يبدأ بـ 01 ويكون 11 رقم)",
  positive: (field: string) => `${field} يجب أن يكون رقم موجب`,
  nonneg: (field: string) => `${field} يجب ألا يكون سالباً`,
  int: (field: string) => `${field} يجب أن يكون رقم صحيح`,
  date: "التاريخ غير صالح",
  futureDate: "يجب أن يكون التاريخ في المستقبل",
  endAfterStart: "تاريخ النهاية يجب أن يكون بعد البداية",
  uuid: "المعرف غير صالح",
  passwordShort: "كلمة المرور يجب أن تكون 6 حروف على الأقل",
  usernameInvalid: "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط",
};
