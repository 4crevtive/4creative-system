# خطة إضافة Validation شامل على كل السيستم

## الهدف
تطبيق فاليديشن Zod على كل الـ inputs في السيستم على مستويين:
- **Client-side**: React Hook Form + Zod resolver → رسائل خطأ فورية تحت كل حقل
- **Server-side**: `.inputValidator(zodSchema.parse)` في كل serverFn → طبقة أمان ثانية

كل الرسائل بالعربي.

---

## الهيكل المقترح

### 1) ملف Schemas مركزي
إنشاء `src/lib/validation/schemas.ts` يحتوي على كل الـ Zod schemas قابلة لإعادة الاستخدام (client + server):

```
src/lib/validation/
├── schemas.ts        // كل الـ schemas
├── messages.ts       // رسائل الخطأ العربية الموحدة
└── common.ts         // helpers: email, phone (مصري), uuid, positiveNumber, dateRange...
```

### 2) الفورمز المستهدفة (مقسمة على مراحل)

**المرحلة أ - Auth & Profile**
- تسجيل دخول / إنشاء حساب / نسيت الباسورد
- تعديل البروفايل / تغيير الباسورد

**المرحلة ب - Tasks & Projects**
- إنشاء/تعديل Task (title, description, due_at, assignee, priority)
- Checklist items, Comments, Internal notes, Time entries
- Projects, Milestones, Risks, Expenses, Notes

**المرحلة ج - CRM & Finance**
- Contacts, Clients, Agency clients
- Invoices, Payments, Cash movements, Daily closings
- Freelancers, Equipment

**المرحلة د - Studio & Reception**
- Bookings (مع تحقق التواريخ)
- Studio packages, Rooms

**المرحلة هـ - Departments & Members**
- Departments, Department members, Project members, Watchers

### 3) قواعد الفاليديشن العامة

| النوع | القاعدة |
|------|--------|
| نص مطلوب | trim + غير فارغ + max length محددة |
| Email | `z.string().email("بريد إلكتروني غير صالح")` |
| موبايل مصري | regex `/^01[0-2,5]\d{8}$/` |
| رقم موجب | `z.number().positive("يجب أن يكون رقم موجب")` |
| تاريخ | `z.coerce.date()` + تحقق مستقبلي حين يلزم |
| UUID | `z.string().uuid()` |
| Range تواريخ | `.refine(d => d.end > d.start, "تاريخ النهاية بعد البداية")` |
| السعر/المبلغ | `z.number().nonnegative().max(...)` |

### 4) الـ Server-side

كل `createServerFn` يستخدم `.inputValidator((raw) => schema.parse(raw))`. الأخطاء تُرجَع كـ `ZodError` وتظهر رسائلها للمستخدم عبر toast.

Helper مشترك:
```ts
// src/lib/validation/server.ts
export const validate = <T>(schema: ZodSchema<T>) => (raw: unknown) => {
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(r.error.issues[0].message);
  return r.data;
};
```

### 5) UI Pattern موحد

كل فورم:
```tsx
const form = useForm({ resolver: zodResolver(schema), defaultValues });
// <FormField> من shadcn — رسالة الخطأ تظهر تلقائيا تحت الحقل
```

---

## التفاصيل التقنية

- **مكتبات موجودة بالفعل**: `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`
- **لا حاجة لأي install جديد**
- **ما لن يتغير**: منطق السيرفر، الـ RLS، الـ DB schema
- **ما سيتغير**: فقط طبقة validation في الفورمز والـ serverFns

---

## الخطوات

1. إنشاء البنية الأساسية (`schemas.ts`, `messages.ts`, `common.ts`, `server.ts`)
2. البدء بالمرحلة أ (Auth) → التأكد من عمل الـ pattern
3. الانتقال للمراحل ب/ج/د/هـ بالتوازي (كل مرحلة في batch منفصل)
4. اختبار سريع لكل فورم بعد تعديله

---

## ملاحظة مهمة
ده شغل ضخم جدا (30+ فورم). هبدأ بالمرحلة **أ** (Auth) والمرحلة **ب** (Tasks) في هذه الجولة كنموذج، وبعدين أكمل الباقي في جولات لاحقة. لو عايز ترتيب مختلف أو تركيز على فورمز معينة قولي.
