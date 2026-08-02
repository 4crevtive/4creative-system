-- 1) Seed companies
INSERT INTO public.companies (code, name_ar, name_en)
SELECT 'studio'::company_code, 'الاستوديو', 'Studio'
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE code = 'studio');

INSERT INTO public.companies (code, name_ar, name_en)
SELECT 'agency'::company_code, '4Creative', '4Creative Agency'
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE code = 'agency');

-- 2) Seed one cashbox per company
INSERT INTO public.cashboxes (company_id, name)
SELECT c.id, 'خزنة الاستوديو' FROM public.companies c
WHERE c.code = 'studio'
  AND NOT EXISTS (SELECT 1 FROM public.cashboxes b WHERE b.company_id = c.id);

INSERT INTO public.cashboxes (company_id, name)
SELECT c.id, 'خزنة 4Creative' FROM public.companies c
WHERE c.code = 'agency'
  AND NOT EXISTS (SELECT 1 FROM public.cashboxes b WHERE b.company_id = c.id);

-- 3) Record the studio expenses
WITH box AS (
  SELECT b.id FROM public.cashboxes b
  JOIN public.companies c ON c.id = b.company_id
  WHERE c.code = 'studio'
  LIMIT 1
), items(amount, category, description) AS (
  VALUES
    (70,   'خامات وطباعة',  'أكياس زبالة'),
    (30,   'صيانة',         'فيشة كهرباء'),
    (30,   'بوفيه وضيافة',  'مناديل'),
    (30,   'بوفيه وضيافة',  'قهوة'),
    (50,   'بوفيه وضيافة',  'قهوة وحاجة ساقعة'),
    (150,  'كهرباء ومياه',  'شحن مياه'),
    (800,  'كهرباء ومياه',  'شحن كهرباء'),
    (800,  'إنترنت وهاتف',  'شحن نت'),
    (1000, 'صيانة',         'تصليح تلاجة — (علينا)'),
    (500,  'مواصلات',       'نقل — (علينا)'),
    (300,  'مصاريف نثرية',  'أنبوبة غاز — (علينا)'),
    (55,   'بوفيه وضيافة',  'شاي — (علينا)'),
    (100,  'بوفيه وضيافة',  'قهوة مدرسين — (علينا)'),
    (500,  'كهرباء ومياه',  'كهرباء — (علينا)'),
    (200,  'مصاريف نثرية',  'شمع ودبل وشاي وسكر — (علينا)')
)
INSERT INTO public.cash_movements (cashbox_id, business_date, direction, amount, category, description)
SELECT box.id, CURRENT_DATE, 'out'::cash_direction, i.amount, i.category, i.description
FROM box, items i;