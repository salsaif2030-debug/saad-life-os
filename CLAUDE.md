# نظام سعد — Life OS · دليل المشروع

نظام تشغيل شخصي للحياة. **موقع ثابت خالص**: HTML + CSS + JavaScript عادي، بلا إطار عمل،
بلا خطوة بناء، بلا Node في وقت التشغيل. Supabase للتخزين والدخول فقط.

## القواعد الأساسية

1. **لا تُدخل أي إطار عمل أو مكتبة بناء** (React / Next / Vite / Tailwind / TypeScript).
   قيمة هذا المشروع أنه يفتح بنقرة ويُنشر بسحب مجلد. أي أداة بناء تكسر ذلك.
2. **لا تُدخل مكتبات خارجية جديدة** إلا بطلب صريح. المسموح حالياً: `supabase-js` و`lucide` من CDN.
3. **الواجهة عربية RTL بالكامل.** كل نصّ جديد بالعربية الفصحى المبسّطة، بلا مصطلحات تقنية أمام المستخدم.
4. **لا تُعِد كتابة ملف كامل** لتغيير جزء منه. عدّل الدالة المعنية فقط.

## البنية

```
public/app/index.html    الهيكل + كل التنسيقات (نظام رموز CSS واحد، فاتح وداكن)
public/app/js/core.js    الحالة S · التخزين · مزامنة Supabase · النوافذ · الأدوات المشتركة
public/app/js/widgets.js ويدجتس اللوحة (كل ويدجت دالة في الكائن WG)
public/app/js/areas.js   جوانب الحياة · محرّك الأقسام · المهام
public/app/js/timebox.js تخطيط اليوم بالكتل الزمنية
public/app/js/app.js     التوجيه · اللوحة · المراجعة · الإعدادات · الدخول · الإقلاع
supabase/life_os.sql     الجداول وسياسات الحماية RLS
test/smoke.js            اختبار يشغّل كل الشاشات في DOM مصغّرة
```

الترتيب في `index.html` مهم: `core` ← `widgets` ← `areas` ← `timebox` ← `app`.

## نموذج البيانات

كل شيء في كائن عام واحد اسمه **`S`** يُحفظ كمستند JSON واحد:
محلياً في `localStorage`، وسحابياً في عمود `life_state.data`.

```
S.profile · S.settings · S.areas[] · S.tasks[] · S.blocks[] · S.priorities{}
S.habits{list,log} · S.goals[] · S.notes[] · S.capture[] · S.reviews{} · S.prayerLog{}
S.widgets[] · S.links[] · S.focus · S.prayer
```

**قواعد التعامل مع الحالة:**
- بعد أي تغيير على `S` نادِ **`save()`** — هي تحفظ محلياً وتجدول المزامنة السحابية.
- لإعادة رسم الشاشة الحالية: **`render()`**. لإعادة رسم ويدجت واحد: `repaintWidget('نوعه')`.
- أي حقل جديد **يجب أن يُضاف إلى `defaultState()`** في `core.js`، وإلا لن يظهر لمن عنده بيانات قديمة
  (`deepMerge` تدمج الافتراضي مع المحفوظ عند التحميل).
- المعرّفات تُولَّد بـ`uid('بادئة')`. التواريخ نصّية `YYYY-MM-DD` عبر `today()` و`dayShift()`.
- الأوقات داخل الكتل الزمنية **دقائق من منتصف الليل** (رقم)، لا نصوص.

## الجوانب والأقسام

كل جانب (`S.areas[]`) يحوي `sections[]`. أنواع الأقسام معرّفة في `SEC_TYPES` بـ`areas.js`:

`tasks` `habits` `goals` `notes` — عروض مفلترة على مجموعات عامة (لا تخزّن بياناتها داخل القسم)
`metric` `records` `checklist` `journal` — تخزّن عناصرها في `section.items[]`
`prayers` — يقرأ من `S.prayerLog`

**لإضافة نوع قسم جديد:** أضِفه إلى `SEC_TYPES`، ثم دالة عرض `secXxx(a,s)`، ثم سجّلها في
`secBody()` و`secAdd()`. لا تنسَ الحالة الفارغة عبر `emptySec('…')`.

## التنسيقات

- **لا تكتب ألواناً صريحة.** استخدم رموز CSS: `var(--accent)` `var(--ink)` `var(--muted)`
  `var(--surface)` `var(--line)` `var(--good)` `var(--bad)`. الوضع الداكن يشتغل تلقائياً بهذا.
- ألوان الجوانب فقط تُقرأ من `areaColor(id)`، وللشفافية `hexA(color, 0.12)`.
- استعمل الأصناف الموجودة: `.card .pad .btn .chip .item .sec .widget .field .row .between .grow`.
- الأيقونات من Lucide: `<i data-lucide="اسم"></i>` ثم نادِ `refreshIcons()` بعد أي حقن HTML.
- **الفلسفة: تقليل الحمل الذهني.** لا ألوان زائدة، لا حدود ثقيلة، لا حركات. المساحة البيضاء ميزة.

## الأمان

- `SUPA_KEY` في `core.js` هو مفتاح **publishable** — ظهوره طبيعي وآمن لأن الحماية في RLS.
- **لا تضع `service_role`** ولا كلمة مرور قاعدة البيانات في أي ملف واجهة أبداً.
- كل جدول جديد في Supabase **يجب** أن تُفعَّل عليه RLS بسياسة `auth.uid() = owner`
  على غرار `life_state` في `supabase/life_os.sql`.
- كل نصّ من المستخدم يُمرَّر عبر **`esc()`** قبل حقنه في HTML.

## قبل أن تنهي أي تعديل

```bash
node test/smoke.js     # لازم: كل الاختبارات نجحت ✓
```

وإن أضفت شاشة أو قسماً أو ويدجت — **أضف له اختباراً** في `test/tests-body.js`.

## التشغيل محلياً

```bash
cd public && python3 -m http.server 8080   # ثم افتح http://localhost:8080/app/
```
